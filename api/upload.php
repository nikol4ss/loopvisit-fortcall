<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';
require_once '../config/jwt.php';

$user = JWT::getCurrentUser();
if (!$user) {
    http_response_code(401);
    echo json_encode(['error' => 'TOKEN INVÁLIDO']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'MÉTODO NÃO PERMITIDO']);
    exit;
}

try {
    // Verificar se foi enviado um arquivo
    if (!isset($_FILES['attachment']) || $_FILES['attachment']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('NENHUM ARQUIVO ENVIADO OU ERRO NO UPLOAD');
    }

    $file = $_FILES['attachment'];
    $visitaId = $_POST['visita_id'] ?? null;

    if (!$visitaId) {
        throw new Exception('ID DA VISITA É OBRIGATÓRIO');
    }

    // Validar tipo de arquivo
    $allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
    ];

    $fileType = $file['type'];
    if (!in_array($fileType, $allowedTypes)) {
        throw new Exception('TIPO DE ARQUIVO NÃO PERMITIDO');
    }

    // Validar tamanho (máximo 5MB)
    $maxSize = 5 * 1024 * 1024; // 5MB
    if ($file['size'] > $maxSize) {
        throw new Exception('ARQUIVO MUITO GRANDE (MÁXIMO 5MB)');
    }

    // Criar diretório de uploads se não existir
    $uploadDir = '../uploads/checkins/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Gerar nome único para o arquivo
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $fileName = 'checkin_' . $visitaId . '_' . time() . '_' . uniqid() . '.' . $extension;
    $filePath = $uploadDir . $fileName;

    // Mover arquivo para diretório de uploads
    if (!move_uploaded_file($file['tmp_name'], $filePath)) {
        throw new Exception('ERRO AO SALVAR ARQUIVO');
    }

    // Salvar informações no banco de dados
    $database = new Database();
    $db = $database->getConnection();

    // Verificar se já existe um checkin para esta visita
    $checkQuery = "SELECT id FROM checkin WHERE visita_id = ?";
    $checkStmt = $db->prepare($checkQuery);
    $checkStmt->execute([$visitaId]);
    $existing = $checkStmt->fetch();

    if ($existing) {
        // Verificar se existe arquivo anterior e removê-lo
        $oldFileQuery = "SELECT attachment FROM checkin WHERE visita_id = ?";
        $oldFileStmt = $db->prepare($oldFileQuery);
        $oldFileStmt->execute([$visitaId]);
        $oldFile = $oldFileStmt->fetch();
        
        if ($oldFile && $oldFile['attachment']) {
            $oldFilePath = $uploadDir . $oldFile['attachment'];
            if (file_exists($oldFilePath)) {
                unlink($oldFilePath);
            }
        }

        // Atualizar registro existente
        $updateQuery = "UPDATE checkin SET 
                        attachment = ?, 
                        attachment_original_name = ?, 
                        attachment_size = ?, 
                        attachment_type = ?, 
                        has_attachment = 1, 
                        updated_at = CURRENT_TIMESTAMP 
                        WHERE visita_id = ?";
        $updateStmt = $db->prepare($updateQuery);
        $updateStmt->execute([
            $fileName, 
            $file['name'], 
            $file['size'], 
            $fileType, 
            $visitaId
        ]);
    } else {
        // Criar novo registro
        $insertQuery = "INSERT INTO checkin (
                        visita_id, 
                        attachment, 
                        attachment_original_name, 
                        attachment_size, 
                        attachment_type, 
                        has_attachment
                        ) VALUES (?, ?, ?, ?, ?, 1)";
        $insertStmt = $db->prepare($insertQuery);
        $insertStmt->execute([
            $visitaId, 
            $fileName, 
            $file['name'], 
            $file['size'], 
            $fileType
        ]);
    }

    echo json_encode([
        'success' => true,
        'filename' => $fileName,
        'original_name' => $file['name'],
        'size' => $file['size'],
        'type' => $fileType
    ]);

} catch (Exception $e) {
    // Remover arquivo se foi criado mas houve erro no banco
    if (isset($filePath) && file_exists($filePath)) {
        unlink($filePath);
    }
    
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
