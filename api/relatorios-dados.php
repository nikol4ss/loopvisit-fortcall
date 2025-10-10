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
    // Usar a função getCurrentUser da classe JWT
    $user = JWT::getCurrentUser();
    
    if (!$user) {
        throw new Exception('Token inválido ou expirado');
    }
    
    // Verificar se é gestor
    if ($user['role'] !== 'GESTOR') {
        throw new Exception('Acesso negado - apenas gestores');
    }
    
    $database = new Database();
    $db = $database->getConnection();
    
    $tipo = $_GET['tipo'] ?? '';
    
    if ($tipo === 'visitas') {
        // Buscar visitas com status calculado baseado na existência de checkin
        $sql = "SELECT 
                    v.id,
                    v.date,
                    v.type,
                    v.status,
                    v.objetivo,
                    v.meta_estabelecida,
                    v.created_at,
                    e.name as empresa_nome,
                    e.cnpj as empresa_cnpj,
                    e.segment as empresa_segmento,
                    e.address as empresa_endereco,
                    e.phone as empresa_telefone,
                    e.email as empresa_email,
                    e.responsible as empresa_responsavel,
                    u.name as consultor_nome,
                    c.nome as cidade_nome,
                    est.nome as estado_nome,
                    CASE 
                        WHEN v.date < CURDATE() AND v.status = 'AGENDADA' THEN 'PERDIDA'
                        WHEN EXISTS(SELECT 1 FROM checkin ch WHERE ch.visita_id = v.id) THEN 'REALIZADA'
                        ELSE v.status
                    END as status_calculado
                FROM visitas v
                LEFT JOIN empresas e ON v.company_id = e.id
                LEFT JOIN usuarios u ON v.created_by = u.id
                LEFT JOIN cidades c ON e.city_id = c.id_cidade
                LEFT JOIN estados est ON e.state_id = est.id_estado";
        
        $params = [];
        $conditions = [];
        
        // Filtros de data
        if (isset($_GET['data_inicio']) && !empty($_GET['data_inicio'])) {
            $conditions[] = "DATE(v.date) >= ?";
            $params[] = $_GET['data_inicio'];
        }
        
        if (isset($_GET['data_fim']) && !empty($_GET['data_fim'])) {
            $conditions[] = "DATE(v.date) <= ?";
            $params[] = $_GET['data_fim'];
        }
        
        if (!empty($conditions)) {
            $sql .= " WHERE " . implode(" AND ", $conditions);
        }
        
        $sql .= " ORDER BY v.date DESC";
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $visitas = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $visitas,
            'total' => count($visitas)
        ]);
        
    } elseif ($tipo === 'checkins') {
        // Buscar check-ins com todas as colunas que existem na tabela
        $sql = "SELECT 
                    v.id as visita_id,
                    v.date,
                    v.type as tipo_visita,
                    v.status,
                    v.objetivo,
                    v.meta_estabelecida,
                    e.name as empresa_nome,
                    e.cnpj as empresa_cnpj,
                    e.segment as empresa_segmento,
                    e.address as empresa_endereco,
                    e.phone as empresa_telefone,
                    e.email as empresa_email,
                    e.responsible as empresa_responsavel,
                    u.name as consultor_nome,
                    c.nome as cidade_nome,
                    est.nome as estado_nome,
                    ch.id as checkin_id,
                    ch.summary as resumo,
                    ch.opportunity as oportunidade,
                    ch.tipo_equipamento,
                    ch.marca_equipamento,
                    ch.modelo_equipamento,
                    ch.status_equipamento,
                    ch.tipo_operacao,
                    ch.tipo_sucata,
                    ch.qtd_producao_mes,
                    ch.ton_vendida,
                    ch.fundo_baia,
                    ch.qtd_crescimento,
                    ch.cliente_fornece_para,
                    ch.preco_venda_ton,
                    ch.tipo_cliente,
                    ch.expansao_equipamentos,
                    ch.prazo_expansao,
                    ch.tipo_equipamento_interesse,
                    CASE WHEN ch.contato_comprador = 1 THEN 'SIM' ELSE 'NÃO' END as contato_comprador,
                    CASE WHEN ch.contato_operador = 1 THEN 'SIM' ELSE 'NÃO' END as contato_operador,
                    CASE WHEN ch.contato_encarregado = 1 THEN 'SIM' ELSE 'NÃO' END as contato_encarregado,
                    CASE WHEN ch.contato_diretor = 1 THEN 'SIM' ELSE 'NÃO' END as contato_diretor,
                    CASE WHEN ch.has_attachment = 1 THEN 'SIM' ELSE 'NÃO' END as tem_anexo,
                    ch.attachment_original_name as nome_anexo,
                    ch.created_at as data_checkin
                FROM visitas v
                INNER JOIN checkin ch ON v.id = ch.visita_id
                LEFT JOIN empresas e ON v.company_id = e.id
                LEFT JOIN usuarios u ON v.created_by = u.id
                LEFT JOIN cidades c ON e.city_id = c.id_cidade
                LEFT JOIN estados est ON e.state_id = est.id_estado";
        
        $params = [];
        $conditions = [];
        
        // Filtros de data
        if (isset($_GET['data_inicio']) && !empty($_GET['data_inicio'])) {
            $conditions[] = "DATE(v.date) >= ?";
            $params[] = $_GET['data_inicio'];
        }
        
        if (isset($_GET['data_fim']) && !empty($_GET['data_fim'])) {
            $conditions[] = "DATE(v.date) <= ?";
            $params[] = $_GET['data_fim'];
        }
        
        if (!empty($conditions)) {
            $sql .= " WHERE " . implode(" AND ", $conditions);
        }
        
        $sql .= " ORDER BY v.date DESC";
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $checkins = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $checkins,
            'total' => count($checkins)
        ]);
        
    } else {
        throw new Exception('Tipo de relatório não especificado');
    }
    
} catch (Exception $e) {
    error_log("Erro em relatorios-dados.php: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
