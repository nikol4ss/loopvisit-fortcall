<?php
require_once '../config/database.php';
require_once '../config/jwt.php';

$user = JWT::getCurrentUser();
if (!$user) {
    http_response_code(401);
    echo json_encode(['error' => 'TOKEN INVÁLIDO']);
    exit;
}

$visitaId = $_GET['visita_id'] ?? null;

if (!$visitaId) {
    http_response_code(400);
    echo json_encode(['error' => 'ID DA VISITA É OBRIGATÓRIO']);
    exit;
}

try {
    $database = new Database();
    $db = $database->getConnection();

    // Buscar informações do anexo
    $query = "SELECT c.attachment, c.attachment_original_name, c.attachment_type, v.company_id, e.name as empresa_nome 
              FROM checkin c 
              LEFT JOIN visitas v ON c.visita_id = v.id 
              LEFT JOIN empresas e ON v.company_id = e.id 
              WHERE c.visita_id = ? AND c.attachment IS NOT NULL";
    
    $stmt = $db->prepare($query);
    $stmt->execute([$visitaId]);
    $result = $stmt->fetch();

    if (!$result || !$result['attachment']) {
        http_response_code(404);
        echo json_encode(['error' => 'ANEXO NÃO ENCONTRADO']);
        exit;
    }

    $fileName = $result['attachment'];
    $filePath = '../uploads/checkins/' . $fileName;

    if (!file_exists($filePath)) {
        http_response_code(404);
        echo json_encode(['error' => 'ARQUIVO NÃO ENCONTRADO NO SERVIDOR']);
        exit;
    }

    // Verificar permissão (consultores só podem baixar anexos de suas próprias visitas)
    if ($user['role'] === 'CONSULTOR') {
        $permissionQuery = "SELECT v.created_by FROM visitas v WHERE v.id = ?";
        $permissionStmt = $db->prepare($permissionQuery);
        $permissionStmt->execute([$visitaId]);
        $visita = $permissionStmt->fetch();

        if (!$visita || $visita['created_by'] != $user['user_id']) {
            http_response_code(403);
            echo json_encode(['error' => 'SEM PERMISSÃO PARA BAIXAR ESTE ANEXO']);
            exit;
        }
    }

    // Usar nome original se disponível, senão usar o nome do arquivo
    $downloadName = $result['attachment_original_name'] ?: $fileName;
    
    // Determinar tipo MIME
    $mimeType = $result['attachment_type'];
    if (!$mimeType) {
        $mimeType = mime_content_type($filePath);
        if (!$mimeType) {
            $mimeType = 'application/octet-stream';
        }
    }

    // Headers para download
    header('Content-Type: ' . $mimeType);
    header('Content-Disposition: attachment; filename="' . $downloadName . '"');
    header('Content-Length: ' . filesize($filePath));
    header('Cache-Control: no-cache, must-revalidate');
    header('Pragma: no-cache');

    // Enviar arquivo
    readfile($filePath);
    exit;

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'ERRO AO BAIXAR ARQUIVO: ' . $e->getMessage()]);
}
?>
