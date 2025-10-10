<?php
require_once '../config/database.php';
require_once '../config/jwt.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    // Verificar autenticação
    $headers = getallheaders();
    $token = null;
    
    if (isset($headers['Authorization'])) {
        $token = str_replace('Bearer ', '', $headers['Authorization']);
    }
    
    if (!$token) {
        throw new Exception('Token não fornecido');
    }
    
    $decoded = JWT::decode($token, JWT_SECRET, ['HS256']);
    $user = (array) $decoded;
    
    // Apenas gestores podem acessar relatórios
    if ($user['role'] !== 'GESTOR') {
        throw new Exception('Acesso negado - apenas gestores');
    }
    
    $pdo = getConnection();
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Construir query com filtros
        $sql = "
            SELECT 
                v.*,
                e.name as empresa_nome,
                e.city as empresa_cidade,
                e.state as empresa_estado,
                u.name as consultor_nome,
                CASE 
                    WHEN v.status = 'AGENDADA' AND v.date < CURDATE() THEN 'ATRASADA'
                    WHEN v.status = 'AGENDADA' AND v.date = CURDATE() THEN 'HOJE'
                    WHEN v.status = 'AGENDADA' AND v.date > CURDATE() THEN 'AGENDADA'
                    ELSE v.status
                END as status_calculado
            FROM visits v
            LEFT JOIN companies e ON v.company_id = e.id
            LEFT JOIN users u ON v.user_id = u.id
            WHERE 1=1
        ";
        
        $params = [];
        
        // Filtro por data
        if (isset($_GET['data_inicio']) && !empty($_GET['data_inicio'])) {
            $sql .= " AND v.date >= ?";
            $params[] = $_GET['data_inicio'];
        }
        
        if (isset($_GET['data_fim']) && !empty($_GET['data_fim'])) {
            $sql .= " AND v.date <= ?";
            $params[] = $_GET['data_fim'];
        }
        
        // Filtro por consultor
        if (isset($_GET['consultor']) && !empty($_GET['consultor'])) {
            $sql .= " AND v.user_id = ?";
            $params[] = $_GET['consultor'];
        }
        
        $sql .= " ORDER BY v.date DESC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $visitas = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $visitas
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
