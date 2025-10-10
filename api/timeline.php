<?php
// ========================================
// API TIMELINE DA EMPRESA - CORRIGIDA
// Seguindo padrão das outras APIs do sistema
// ========================================

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Tratar requisições OPTIONS (CORS preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';
require_once '../config/jwt.php';

try {
    // Verificar autenticação seguindo padrão das outras APIs
    $user = JWT::getCurrentUser();
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido ou expirado']);
        exit;
    }
    
    // Verificar se é GET
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        throw new Exception('Método não permitido');
    }
    
    // Obter parâmetros
    $empresaId = $_GET['empresa_id'] ?? null;
    $dataInicio = $_GET['data_inicio'] ?? null;
    $dataFim = $_GET['data_fim'] ?? null;
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = max(1, min(50, intval($_GET['limit'] ?? 10)));
    $offset = ($page - 1) * $limit;
    
    if (!$empresaId) {
        throw new Exception('ID da empresa é obrigatório');
    }
    
    // Conectar ao banco usando classe Database
    $database = new Database();
    $pdo = $database->getConnection();
    
    // Verificar se a empresa existe
    $stmtEmpresa = $pdo->prepare("SELECT id, name FROM empresas WHERE id = ?");
    $stmtEmpresa->execute([$empresaId]);
    $empresa = $stmtEmpresa->fetch(PDO::FETCH_ASSOC);
    
    if (!$empresa) {
        throw new Exception('Empresa não encontrada');
    }
    
    // Construir condições de filtro de data para visitas
    $visitaDateConditions = [];
    $visitaParams = [$empresaId];
    
    if ($dataInicio) {
        $visitaDateConditions[] = "DATE(v.date) >= ?";
        $visitaParams[] = $dataInicio;
    }
    
    if ($dataFim) {
        $visitaDateConditions[] = "DATE(v.date) <= ?";
        $visitaParams[] = $dataFim;
    }
    
    $visitaWhereClause = !empty($visitaDateConditions) ? ' AND ' . implode(' AND ', $visitaDateConditions) : '';
    
    // Construir condições de filtro de data para checkins
    $checkinDateConditions = [];
    $checkinParams = [$empresaId];
    
    if ($dataInicio) {
        $checkinDateConditions[] = "DATE(c.created_at) >= ?";
        $checkinParams[] = $dataInicio;
    }
    
    if ($dataFim) {
        $checkinDateConditions[] = "DATE(c.created_at) <= ?";
        $checkinParams[] = $dataFim;
    }
    
    $checkinWhereClause = !empty($checkinDateConditions) ? ' AND ' . implode(' AND ', $checkinDateConditions) : '';
    
    // Query para buscar visitas e checkins com filtros separados
    $sql = "
        (
            SELECT 
                v.id,
                v.date as data,
                v.objetivo as resumo,
                v.status,
                v.type as tipo_visita,
                u.name as consultor_nome,
                'visita' as tipo,
                v.id as visita_id,
                NULL as oportunidade
            FROM visitas v
            LEFT JOIN usuarios u ON v.created_by = u.id
            WHERE v.company_id = ?{$visitaWhereClause}
        )
        UNION ALL
        (
            SELECT 
                c.visita_id as id,
                c.created_at as data,
                c.summary as resumo,
                'REALIZADA' as status,
                NULL as tipo_visita,
                u.name as consultor_nome,
                'checkin' as tipo,
                c.visita_id,
                c.opportunity as oportunidade
            FROM checkin c
            INNER JOIN visitas v ON c.visita_id = v.id
            LEFT JOIN usuarios u ON v.created_by = u.id
            WHERE v.company_id = ?{$checkinWhereClause}
        )
        ORDER BY data DESC
        LIMIT {$limit} OFFSET {$offset}
    ";
    
    // Combinar parâmetros
    $allParams = array_merge($visitaParams, $checkinParams);
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($allParams);
    $eventos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Contar total de registros para paginação
    $countSql = "
        SELECT COUNT(*) as total FROM (
            (
                SELECT v.id
                FROM visitas v
                WHERE v.company_id = ?{$visitaWhereClause}
            )
            UNION ALL
            (
                SELECT c.visita_id as id
                FROM checkin c
                INNER JOIN visitas v ON c.visita_id = v.id
                WHERE v.company_id = ?{$checkinWhereClause}
            )
        ) as combined
    ";
    
    $countParams = array_merge($visitaParams, $checkinParams);
    
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($countParams);
    $totalRecords = $countStmt->fetchColumn();
    
    // Calcular paginação
    $totalPages = ceil($totalRecords / $limit);
    
    // Formatar dados dos eventos seguindo padrão das outras APIs
    $eventosFormatados = array_map(function($evento) {
        return [
            'id' => $evento['id'],
            'data' => $evento['data'],
            'resumo' => $evento['resumo'] ?: 'Sem informações adicionais',
            'observacoes' => $evento['resumo'] ?: 'Sem informações adicionais',
            'status' => $evento['status'] ?: 'N/A',
            'tipo_visita' => $evento['tipo_visita'],
            'consultor_nome' => $evento['consultor_nome'] ?: 'N/A',
            'tipo' => $evento['tipo'],
            'visita_id' => $evento['visita_id'],
            'oportunidade' => $evento['oportunidade']
        ];
    }, $eventos);
    
    // Log para debug
    error_log("Timeline API - Empresa: $empresaId, Filtros: " . json_encode(['data_inicio' => $dataInicio, 'data_fim' => $dataFim]) . ", Eventos encontrados: " . count($eventos));
    
    // Resposta de sucesso seguindo padrão das outras APIs
    echo json_encode([
        'success' => true,
        'data' => $eventosFormatados,
        'pagination' => [
            'current_page' => $page,
            'total_pages' => $totalPages,
            'total_items' => $totalRecords,
            'items_per_page' => $limit,
            'pages' => $totalPages
        ],
        'empresa' => $empresa,
        'user_role' => $user['role'],
        'debug_info' => [
            'filtros_aplicados' => [
                'data_inicio' => $dataInicio,
                'data_fim' => $dataFim
            ],
            'total_encontrado' => count($eventos),
            'sql_usado' => $sql,
            'parametros' => $allParams
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Erro na API Timeline: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
