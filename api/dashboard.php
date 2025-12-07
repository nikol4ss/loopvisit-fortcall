<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
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

$database = new Database();
$db = $database->getConnection();

try {
    $whereClause = "WHERE 1=1";
    $params = [];

    if ($user['role'] === 'CONSULTOR') {
        $whereClause .= " AND v.created_by = :user_id";
        $params[':user_id'] = $user['user_id'];
    }

    // Filtros de data
    if (isset($_GET['data_inicio'])) {
        $whereClause .= " AND DATE(v.date) >= :data_inicio";
        $params[':data_inicio'] = $_GET['data_inicio'];
    }

    if (isset($_GET['data_fim'])) {
        $whereClause .= " AND DATE(v.date) <= :data_fim";
        $params[':data_fim'] = $_GET['data_fim'];
    }

    // Filtro por consultor (para gestores)
    if (isset($_GET['consultor']) && !empty($_GET['consultor'])) {
        $whereClause .= " AND v.created_by = :consultor_id";
        $params[':consultor_id'] = $_GET['consultor'];
    }

    // Filtro por status
    if (isset($_GET['status']) && !empty($_GET['status'])) {
        $whereClause .= " AND v.status = :status";
        $params[':status'] = $_GET['status'];
    }

    // Se for requisição para visitas detalhadas
    if (isset($_GET['action']) && $_GET['action'] === 'visitas') {
        // CORREÇÃO: Adicionar JOIN com checkin e usar campos corretos
        $query = "
           SELECT
            v.id,
            v.date,
            v.type,
            v.visit_sequence,
            v.status,
            v.objetivo,
            v.meta_estabelecida,

            /* REGRA DE EXIBIÇÃO DO NOME */
            CASE
                WHEN v.company_id IS NOT NULL AND e.name IS NOT NULL THEN e.name
                WHEN v.is_prospeccao = 1 AND v.empresa_livre IS NOT NULL THEN v.empresa_livre
                ELSE 'EMPRESA NÃO REGISTRADA'
            END AS empresa_nome,

            /* CNPJ – só se tiver empresa */
            CASE
                WHEN v.company_id IS NOT NULL THEN e.cnpj
                ELSE NULL
            END AS empresa_cnpj,

            e.segment AS empresa_segmento,
            e.region AS empresa_regiao,
            e.rating AS empresa_rating,

            u.name AS consultor_nome,
            c.created_at AS checkin_data,
            c.updated_at AS checkin_updated,
            c.summary AS checkin_summary,
            c.opportunity AS checkin_opportunity,

            CASE
                WHEN v.status = 'AGENDADA' AND v.date < NOW() THEN 'ATRASADA'
                ELSE v.status
            END AS status_calculado

        FROM visitas v
        LEFT JOIN empresas e ON v.company_id = e.id
        LEFT JOIN usuarios u ON v.created_by = u.id
        LEFT JOIN checkin c ON v.id = c.visita_id
        $whereClause
        ORDER BY v.date DESC
        ";

        $stmt = $db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $visitas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Converter para maiúsculo (mesma lógica do visitas.php)
        foreach ($visitas as &$visita) {
            foreach ($visita as $key => &$value) {
                if (is_string($value) && !in_array($key, ['date', 'created_at', 'updated_at', 'checkin_data', 'checkin_updated'])) {
                    $value = strtoupper($value);
                }
            }
        }

        echo json_encode([
            'success' => true,
            'data' => $visitas
        ]);
        exit;
    }

    // Cards de resumo
    $cards = [];

    $statusList = ['AGENDADA', 'REALIZADA', 'REMARCADA', 'CANCELADA'];
    foreach ($statusList as $status) {
        $query = "SELECT COUNT(*) as total FROM visitas v $whereClause AND v.status = :status";
        $stmt = $db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':status', $status);
        $stmt->execute();
        $cards[$status] = $stmt->fetch()['total'];
    }

    // Visitas atrasadas (agendadas com data passada)
    $atrasadasQuery = "SELECT COUNT(*) as total FROM visitas v $whereClause AND v.status = 'AGENDADA' AND v.date < NOW()";
    $atrasadasStmt = $db->prepare($atrasadasQuery);
    foreach ($params as $key => $value) {
        $atrasadasStmt->bindValue($key, $value);
    }
    $atrasadasStmt->execute();
    $cards['ATRASADAS'] = $atrasadasStmt->fetch()['total'];

    echo json_encode([
        'success' => true,
        'cards' => $cards
    ]);

} catch (Exception $e) {
    error_log("Erro no dashboard: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'ERRO AO BUSCAR DADOS DO DASHBOARD: ' . $e->getMessage()]);
}
?>
