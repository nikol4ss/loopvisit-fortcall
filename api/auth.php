<?php
// Desabilitar qualquer output antes dos headers
ob_start();

// Configurar headers primeiro
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Limpar qualquer output anterior
ob_clean();

// Tratar OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Verificar método
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'MÉTODO NÃO PERMITIDO']);
    exit();
}

try {
    // Incluir dependências
    require_once dirname(__DIR__) . '/config/database.php';
    require_once dirname(__DIR__) . '/config/jwt.php';
    
    // Ler input JSON
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('JSON INVÁLIDO');
    }
    
    if (empty($data['email']) || empty($data['password'])) {
        throw new Exception('EMAIL E SENHA SÃO OBRIGATÓRIOS');
    }
    
    // Conectar ao banco
    $database = new Database();
    $db = $database->getConnection();
    
    // Buscar usuário
    $stmt = $db->prepare("SELECT id, name, email, pass_hash, role, active FROM usuarios WHERE email = ? AND active = 1");
    $stmt->execute([$data['email']]);
    $user = $stmt->fetch();
    
    if (!$user) {
        throw new Exception('USUÁRIO NÃO ENCONTRADO');
    }
    
    // Verificar senha
    if (!password_verify($data['password'], $user['pass_hash'])) {
        throw new Exception('SENHA INCORRETA');
    }
    
    // Gerar token
    $payload = [
        'user_id' => (int)$user['id'],
        'name' => strtoupper($user['name']),
        'email' => strtoupper($user['email']),
        'role' => $user['role'],
        'exp' => time() + (24 * 60 * 60)
    ];
    
    $token = JWT::encode($payload);
    
    // Resposta de sucesso
    echo json_encode([
        'success' => true,
        'token' => $token,
        'user' => [
            'id' => (int)$user['id'],
            'name' => strtoupper($user['name']),
            'email' => strtoupper($user['email']),
            'role' => $user['role']
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

// Finalizar output
ob_end_flush();
?>
