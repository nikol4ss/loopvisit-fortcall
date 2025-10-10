<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';
require_once '../config/jwt.php';

try {
    // Verificar autenticação
    $user = JWT::getCurrentUser();
    
    if (!$user) {
        throw new Exception('Token inválido ou expirado');
    }
    
    $database = new Database();
    $db = $database->getConnection();
    
    // Query base para buscar checkins
    $sql = "SELECT 
                v.id as visita_id,
                v.date,
                v.type as tipo_visita,
                v.status,
                v.objetivo,
                e.name as empresa_nome,
                e.cnpj as empresa_cnpj,
                u.name as consultor_nome,
                c.nome as cidade_nome,
                est.nome as estado_nome,
                ch.id as checkin_id,
                ch.summary as resumo,
                ch.opportunity as oportunidade,
                ch.negociacao_comercial,
                ch.termometro_negociacao,
                ch.numero_os,
                ch.created_at as data_checkin
            FROM visitas v
            INNER JOIN checkin ch ON v.id = ch.visita_id
            LEFT JOIN empresas e ON v.company_id = e.id
            LEFT JOIN usuarios u ON v.created_by = u.id
            LEFT JOIN cidades c ON e.city_id = c.id_cidade
            LEFT JOIN estados est ON e.state_id = est.id_estado
            WHERE 1=1";
    
    $params = [];
    
    // Filtros
    if (isset($_GET['data_inicio']) && !empty($_GET['data_inicio'])) {
        $sql .= " AND DATE(v.date) >= ?";
        $params[] = $_GET['data_inicio'];
    }
    
    if (isset($_GET['data_fim']) && !empty($_GET['data_fim'])) {
        $sql .= " AND DATE(v.date) <= ?";
        $params[] = $_GET['data_fim'];
    }
    
    if (isset($_GET['empresa']) && !empty($_GET['empresa'])) {
        $sql .= " AND e.name LIKE ?";
        $params[] = '%' . $_GET['empresa'] . '%';
    }
    
    if (isset($_GET['consultor']) && !empty($_GET['consultor'])) {
        $sql .= " AND u.name LIKE ?";
        $params[] = '%' . $_GET['consultor'] . '%';
    }
    
    // Se não for gestor, mostrar apenas checkins do próprio usuário
    if ($user['role'] !== 'GESTOR') {
        $sql .= " AND v.created_by = ?";
        $params[] = $user['id'];
    }
    
    $sql .= " ORDER BY v.date DESC, ch.created_at DESC";
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $checkins = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'data' => $checkins,
        'total' => count($checkins),
        'user_role' => $user['role']
    ]);
    
} catch (Exception $e) {
    error_log("Erro em checkins-list.php: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
