<?php
require_once '../config/database.php';
require_once '../config/jwt.php';

// Usar a classe Database
$database = new Database();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Verificar autenticação
$headers = getallheaders();
$token = null;

if (isset($headers['Authorization'])) {
    $token = str_replace('Bearer ', '', $headers['Authorization']);
}

if (!$token) {
    http_response_code(401);
    echo json_encode(['error' => 'Token não fornecido']);
    exit;
}

try {
    global $jwt_secret;
    $decoded = JWT::decode($token, $jwt_secret, ['HS256']);
    $user_id = isset($decoded->user_id) ? $decoded->user_id : null;
    $user_role = isset($decoded->role) ? $decoded->role : 'CONSULTOR';
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['error' => 'Token inválido: ' . $e->getMessage()]);
    exit;
}

try {
    $pdo = $database->getConnection();
    
    // Parâmetros de filtro
    $data_inicio = $_GET['data_inicio'] ?? null;
    $data_fim = $_GET['data_fim'] ?? null;
    $page = intval($_GET['page'] ?? 1);
    $limit = intval($_GET['limit'] ?? 10);
    $offset = ($page - 1) * $limit;
    
    // Construir query base
    $whereConditions = [];
    $params = [];
    
    // Filtros de data
    if ($data_inicio) {
        $whereConditions[] = "DATE(d.updated_at) >= ?";
        $params[] = $data_inicio;
    }
    
    if ($data_fim) {
        $whereConditions[] = "DATE(d.updated_at) <= ?";
        $params[] = $data_fim;
    }
    
    $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';
    
    // Query com JOINs incluindo o consultor responsável pela empresa
    $sql = "
        SELECT 
            d.id,
            d.empresa_id,
            d.created_at,
            d.updated_at,
            e.name as empresa_nome,
            e.cnpj,
            e.consultant as consultor_id,
            COALESCE(u.name, 'Não atribuído') as consultor_nome,
            c.nome as cidade_nome,
            est.nome as estado_nome,
            
            -- Contadores do parque
            COALESCE((SELECT COUNT(*) FROM parque_itens pi WHERE pi.diagnostico_id = d.id AND pi.tipo_item = 'EQUIPAMENTO'), 0) as total_equipamentos,
            COALESCE((SELECT COUNT(*) FROM parque_itens pi WHERE pi.diagnostico_id = d.id AND pi.tipo_item = 'IMPLEMENTO'), 0) as total_implementos,
            
            -- Dados da operação
            COALESCE((SELECT op.tipo_operacao FROM diagnostico_operacao op WHERE op.diagnostico_id = d.id LIMIT 1), '') as tipo_operacao,
            COALESCE((SELECT op.tipo_sucata FROM diagnostico_operacao op WHERE op.diagnostico_id = d.id LIMIT 1), '') as tipo_sucata,
            
            -- Dados da previsão
            COALESCE((SELECT pr.tipo_cliente FROM diagnostico_previsao pr WHERE pr.diagnostico_id = d.id LIMIT 1), '') as tipo_cliente,
            COALESCE((SELECT pr.prazo_expansao FROM diagnostico_previsao pr WHERE pr.diagnostico_id = d.id LIMIT 1), '') as prazo_expansao,
            
            -- Relacionamento
            COALESCE((SELECT CASE 
                WHEN (rel.contato_comprador = 1 OR rel.contato_operador = 1 OR rel.contato_encarregado = 1 OR rel.contato_diretor = 1) 
                THEN 1 
                ELSE 0 
            END FROM diagnostico_relacionamento rel WHERE rel.diagnostico_id = d.id LIMIT 1), 0) as tem_relacionamento
            
        FROM diagnosticos d
        INNER JOIN empresas e ON d.empresa_id = e.id
        LEFT JOIN usuarios u ON e.consultant = u.id
        LEFT JOIN cidades c ON e.city_id = c.id_cidade
        LEFT JOIN estados est ON e.state_id = est.id_estado
        
        $whereClause
        
        ORDER BY d.updated_at DESC
        LIMIT ? OFFSET ?
    ";
    
    $params[] = $limit;
    $params[] = $offset;
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $diagnosticos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Query para contar total
    $countSql = "
        SELECT COUNT(DISTINCT d.id) as total
        FROM diagnosticos d
        INNER JOIN empresas e ON d.empresa_id = e.id
        LEFT JOIN usuarios u ON e.consultant = u.id
        LEFT JOIN cidades c ON e.city_id = c.id_cidade
        LEFT JOIN estados est ON e.state_id = est.id_estado
        $whereClause
    ";
    
    $countParams = array_slice($params, 0, -2); // Remove limit e offset
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($countParams);
    $total = $countStmt->fetchColumn();
    
    $totalPages = ceil($total / $limit);
    
    echo json_encode([
        'success' => true,
        'data' => $diagnosticos,
        'pagination' => [
            'current_page' => $page,
            'total_pages' => $totalPages,
            'total_items' => $total,
            'items_per_page' => $limit,
            'pages' => $totalPages
        ]
    ]);
    
} catch (Exception $e) {
    error_log("ERRO na listagem de diagnósticos: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Erro interno: ' . $e->getMessage()]);
}
?>
