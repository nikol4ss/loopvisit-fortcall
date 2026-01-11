<?php
/**
 * DASHBOARD SEMANAL – API
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';
require_once '../config/jwt.php';

/**
 * Validação do token
 */
$user = JWT::getCurrentUser();
if (!$user) {
    http_response_code(401);
    echo json_encode(['error' => 'TOKEN INVÁLIDO']);
    exit;
}

/**
 * Conexão com banco
 */
$db = (new Database())->getConnection();

try {

    /**
     * ==================================================
     * WHERE BASE
     * ==================================================
     */
    $baseWhere = "WHERE 1=1";
    $baseParams = [];

    // Regra de perfil
    if ($user['role'] === 'CONSULTOR') {
        $baseWhere .= " AND v.created_by = :user_id";
        $baseParams[':user_id'] = $user['user_id'];
    }

    // Filtros de data (SEM DATE())
    if (!empty($_GET['data_inicio'])) {
        $baseWhere .= " AND v.date >= :data_inicio";
        $baseParams[':data_inicio'] = $_GET['data_inicio'];
    }

    if (!empty($_GET['data_fim'])) {
        $baseWhere .= " AND v.date <= :data_fim";
        $baseParams[':data_fim'] = $_GET['data_fim'];
    }

    /**
     * ==================================================
     * LISTAGEM DE VISITAS
     * ==================================================
     */
    if (($_GET['action'] ?? '') === 'visitas') {

        $whereVisitas = $baseWhere;
        $paramsVisitas = $baseParams;

        // Filtro de status
        if (!empty($_GET['status'])) {
            switch ($_GET['status']) {

                case 'ATRASADA':
                    $whereVisitas .= "
                        AND v.status = 'AGENDADA'
                        AND v.date < CURDATE()
                    ";
                    break;

                case 'AGENDADA':
                    $whereVisitas .= "
                        AND v.status = 'AGENDADA'
                        AND v.date >= CURDATE()
                    ";
                    break;

                default:
                    $whereVisitas .= " AND v.status = :status";
                    $paramsVisitas[':status'] = $_GET['status'];
                    break;
            }
        }

        $sql = "
            SELECT
                v.id,
                v.date,
                v.type,
                v.visit_sequence,
                v.status,
                v.objetivo,
                v.meta_estabelecida,
                v.is_retroativa,
                v.is_prospeccao,
                v.empresa_livre,

                CASE
                    WHEN v.company_id IS NOT NULL AND e.name IS NOT NULL THEN e.name
                    WHEN v.is_prospeccao = 1 AND v.empresa_livre IS NOT NULL THEN v.empresa_livre
                    ELSE 'EMPRESA NÃO REGISTRADA'
                END AS empresa_nome,

                e.cnpj AS empresa_cnpj,
                e.segment AS empresa_segmento,
                e.region AS empresa_regiao,
                e.rating AS empresa_rating,

                u.name AS consultor_nome,

                c.created_at AS checkin_data,
                c.updated_at AS checkin_updated,
                c.summary AS checkin_summary,
                c.opportunity AS checkin_opportunity,

                CASE
                    WHEN v.status = 'AGENDADA' AND v.date < CURDATE() THEN 'ATRASADA'
                    ELSE v.status
                END AS status_calculado

            FROM visitas v
            LEFT JOIN empresas e ON v.company_id = e.id
            LEFT JOIN usuarios u ON v.created_by = u.id
            LEFT JOIN checkin c ON v.id = c.visita_id
            $whereVisitas
            ORDER BY v.date DESC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($paramsVisitas);
        $visitas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Padronização de strings (SEM str_contains)
        foreach ($visitas as &$row) {
            foreach ($row as $k => &$v) {
                if (is_string($v) && strpos($k, 'date') === false) {
                    $v = mb_strtoupper($v);
                }
            }
        }

        echo json_encode([
            'success' => true,
            'data' => $visitas
        ]);
        exit;
    }

    /**
     * ==================================================
     * CARDS DE RESUMO
     * ==================================================
     */
    $cards = [];
    $statusList = ['AGENDADA', 'REALIZADA', 'REMARCADA', 'CANCELADA'];

    foreach ($statusList as $st) {

        if ($st === 'AGENDADA') {
            $sql = "
                SELECT COUNT(*)
                FROM visitas v
                $baseWhere
                AND v.status = 'AGENDADA'
                AND v.date >= CURDATE()
            ";
            $stmt = $db->prepare($sql);
            $stmt->execute($baseParams);
        } else {
            $sql = "
                SELECT COUNT(*)
                FROM visitas v
                $baseWhere
                AND v.status = :status
            ";
            $stmt = $db->prepare($sql);
            $params = $baseParams;
            $params[':status'] = $st;
            $stmt->execute($params);
        }

        $cards[$st] = (int) $stmt->fetchColumn();
    }

    // Card atrasadas
    $sqlAtrasadas = "
        SELECT COUNT(*)
        FROM visitas v
        $baseWhere
        AND v.status = 'AGENDADA'
        AND v.date < CURDATE()
    ";

    $stmt = $db->prepare($sqlAtrasadas);
    $stmt->execute($baseParams);
    $cards['ATRASADAS'] = (int) $stmt->fetchColumn();

    echo json_encode([
        'success' => true,
        'cards' => $cards
    ]);

} catch (Throwable $e) {

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'ERRO AO BUSCAR DADOS DO DASHBOARD',
        'details' => $e->getMessage()
    ]);
}
