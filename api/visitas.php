<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
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

// Extrair ID e ação da URL
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$pathParts = explode('/', $path);
$visitaId = null;
$action = null;

// Procurar por ID e ação na URL
for ($i = 0; $i < count($pathParts); $i++) {
    if (is_numeric($pathParts[$i])) {
        $visitaId = (int)$pathParts[$i];
        if (isset($pathParts[$i + 1])) {
            $action = $pathParts[$i + 1];
        }
        break;
    }
}

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        try {
            if ($visitaId) {
                // Buscar visita específica
                $query = "SELECT v.*, e.name as empresa_nome, e.address as empresa_endereco,
                                 e.phone as empresa_telefone, e.whatsapp as empresa_whatsapp,
                                 e.responsible as empresa_responsavel,
                                 c.nome as cidade_nome, u.name as consultor_nome
                          FROM visitas v
                          LEFT JOIN empresas e ON v.company_id = e.id
                          LEFT JOIN cidades c ON v.city_id = c.id_cidade
                          LEFT JOIN usuarios u ON v.created_by = u.id
                          WHERE v.id = ?";
                
                $stmt = $db->prepare($query);
                $stmt->execute([$visitaId]);
                $visita = $stmt->fetch();

                if (!$visita) {
                    http_response_code(404);
                    echo json_encode(['error' => 'VISITA NÃO ENCONTRADA']);
                    exit;
                }

                // Converter para maiúsculo
                foreach ($visita as $key => &$value) {
                    if (is_string($value) && !in_array($key, ['date', 'created_at', 'updated_at'])) {
                        $value = strtoupper($value);
                    }
                }

                echo json_encode(['success' => true, 'data' => $visita]);
            } else {
                // Listar visitas
                $whereClause = "WHERE 1=1";
                $params = [];

                // 🔥 NOVA LÓGICA: Consultor vê visitas de empresas onde é principal OU secundário
                if ($user['role'] === 'CONSULTOR') {
                    $whereClause .= " AND (v.created_by = ? OR EXISTS (
                        SELECT 1 FROM empresas e2 
                        WHERE e2.id = v.company_id 
                        AND (e2.consultant = ? OR e2.consultant_secondary = ?)
                    ))";
                    $params[] = $user['user_id'];
                    $params[] = $user['user_id'];
                    $params[] = $user['user_id'];
                }

                // Filtros
                if (isset($_GET['status'])) {
                    $whereClause .= " AND v.status = ?";
                    $params[] = $_GET['status'];
                }

                if (isset($_GET['data_inicio'])) {
                    $whereClause .= " AND DATE(v.date) >= ?";
                    $params[] = $_GET['data_inicio'];
                }

                if (isset($_GET['data_fim'])) {
                    $whereClause .= " AND DATE(v.date) <= ?";
                    $params[] = $_GET['data_fim'];
                }

                if (isset($_GET['city_id'])) {
                    $whereClause .= " AND v.city_id = ?";
                    $params[] = $_GET['city_id'];
                }

                if (isset($_GET['type'])) {
                    $whereClause .= " AND v.type = ?";
                    $params[] = $_GET['type'];
                }

                if (isset($_GET['consultor']) && $user['role'] === 'GESTOR') {
                    $whereClause .= " AND v.created_by = ?";
                    $params[] = $_GET['consultor'];
                }

                $query = "SELECT v.*, e.name as empresa_nome, c.nome as cidade_nome,
                                 u.name as consultor_nome,
                                 CASE 
                                    WHEN v.status = 'AGENDADA' AND v.date < NOW() THEN 'ATRASADA'
                                    ELSE v.status
                                 END as status_calculado
                          FROM visitas v
                          LEFT JOIN empresas e ON v.company_id = e.id
                          LEFT JOIN cidades c ON v.city_id = c.id_cidade
                          LEFT JOIN usuarios u ON v.created_by = u.id
                          $whereClause
                          ORDER BY v.date DESC";

                $stmt = $db->prepare($query);
                $stmt->execute($params);
                $visitas = $stmt->fetchAll();

                // Converter para maiúsculo
                foreach ($visitas as &$visita) {
                    foreach ($visita as $key => &$value) {
                        if (is_string($value) && !in_array($key, ['date', 'created_at', 'updated_at'])) {
                            $value = strtoupper($value);
                        }
                    }
                }

                echo json_encode(['success' => true, 'data' => $visitas]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'ERRO AO BUSCAR VISITAS: ' . $e->getMessage()]);
        }
        break;

    case 'POST':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            $required = ['company_id', 'city_id', 'date', 'type'];
            foreach ($required as $field) {
                if (!isset($input[$field]) || empty($input[$field])) {
                    http_response_code(400);
                    echo json_encode(['error' => "CAMPO $field É OBRIGATÓRIO"]);
                    exit;
                }
            }

            // Validar tipos de visita permitidos
            $tiposPermitidos = ['COMERCIAL', 'TÉCNICA', 'RELACIONAMENTO', 'TRABALHO INTERNO', 'OUTROS'];
            if (!in_array($input['type'], $tiposPermitidos)) {
                http_response_code(400);
                echo json_encode(['error' => 'TIPO DE VISITA INVÁLIDO']);
                exit;
            }

            // Validação especial para trabalho interno
            if ($input['type'] === 'TRABALHO INTERNO') {
                if (!isset($input['objetivo']) || strlen(trim($input['objetivo'])) < 10) {
                    http_response_code(400);
                    echo json_encode(['error' => 'PARA TRABALHO INTERNO É OBRIGATÓRIO DESCREVER DETALHADAMENTE O OBJETIVO (MÍNIMO 10 CARACTERES)']);
                    exit;
                }
            }

            // 🔥 NOVA LÓGICA: Verificar se empresa existe e se usuário tem permissão (principal OU secundário)
            $empresaQuery = "SELECT id, consultant, consultant_secondary FROM empresas WHERE id = ?";
            $empresaStmt = $db->prepare($empresaQuery);
            $empresaStmt->execute([$input['company_id']]);
            $empresa = $empresaStmt->fetch();

            if (!$empresa) {
                http_response_code(400);
                echo json_encode(['error' => 'EMPRESA NÃO ENCONTRADA']);
                exit;
            }

            // Para trabalho interno, permitir qualquer consultor (flexibilidade para CHB)
            if ($input['type'] !== 'TRABALHO INTERNO') {
                if ($user['role'] === 'CONSULTOR') {
                    // 🔥 VERIFICAR SE É CONSULTOR PRINCIPAL OU SECUNDÁRIO
                    $temPermissao = ($empresa['consultant'] == $user['user_id']) || 
                                   ($empresa['consultant_secondary'] == $user['user_id']);
                    
                    if (!$temPermissao) {
                        http_response_code(403);
                        echo json_encode([
                            'error' => 'SEM PERMISSÃO PARA CRIAR VISITA PARA ESTA EMPRESA',
                            'debug' => [
                                'user_id' => $user['user_id'],
                                'consultant' => $empresa['consultant'],
                                'consultant_secondary' => $empresa['consultant_secondary']
                            ]
                        ]);
                        exit;
                    }
                }
            }

            // Verificar se é visita retroativa (data no passado)
            $visitaDate = new DateTime($input['date']);
            $now = new DateTime();
            $isRetroativa = $visitaDate < $now;

            // Iniciar transação para sequenciamento
            $db->beginTransaction();

            try {
                // Buscar próximo número de sequência
                $seqQuery = "SELECT COALESCE(MAX(visit_sequence), 0) + 1 as next_seq 
                            FROM visitas 
                            WHERE company_id = ? AND type = ? 
                            FOR UPDATE";
                $seqStmt = $db->prepare($seqQuery);
                $seqStmt->execute([$input['company_id'], $input['type']]);
                $nextSeq = $seqStmt->fetch()['next_seq'];

                // Definir status baseado na data
                $status = $input['status'] ?? ($isRetroativa ? 'AGENDADA' : 'AGENDADA');

                // Inserir visita
                $query = "INSERT INTO visitas (company_id, city_id, date, type, visit_sequence, 
                          objetivo, meta_estabelecida, status, created_by)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

                $stmt = $db->prepare($query);
                $result = $stmt->execute([
                    $input['company_id'],
                    $input['city_id'],
                    $input['date'],
                    $input['type'],
                    $nextSeq,
                    $input['objetivo'] ?? null,
                    $input['meta_estabelecida'] ?? null,
                    $status,
                    $user['user_id']
                ]);

                if ($result) {
                    $visitaId = $db->lastInsertId();
                    $db->commit();
                    
                    $response = [
                        'success' => true, 
                        'id' => $visitaId, 
                        'sequence' => $nextSeq
                    ];
                    
                    // Adicionar aviso se for retroativa
                    if ($isRetroativa) {
                        $response['warning'] = 'VISITA RETROATIVA CRIADA - Data no passado';
                        $response['retroativa'] = true;
                    }

                    // Adicionar mensagem especial para trabalho interno
                    if ($input['type'] === 'TRABALHO INTERNO') {
                        $response['message'] = 'TRABALHO INTERNO CHB AGENDADO COM SUCESSO';
                        $response['trabalho_interno'] = true;
                    }

                    // 🔥 INDICAR SE FOI CRIADA POR CONSULTOR SECUNDÁRIO
                    if ($user['role'] === 'CONSULTOR' && $empresa['consultant_secondary'] == $user['user_id'] && $empresa['consultant'] != $user['user_id']) {
                        $response['consultor_secundario'] = true;
                        $response['message'] = 'VISITA CRIADA COMO CONSULTOR SECUNDÁRIO';
                    }
                    
                    echo json_encode($response);
                } else {
                    throw new Exception('Erro ao inserir visita');
                }
            } catch (Exception $e) {
                $db->rollBack();
                throw $e;
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'ERRO AO CRIAR VISITA: ' . $e->getMessage()]);
        }
        break;

    case 'PATCH':
        try {
            if (!$visitaId) {
                http_response_code(400);
                echo json_encode(['error' => 'ID DA VISITA É OBRIGATÓRIO']);
                exit;
            }

            // 🔥 NOVA LÓGICA: Verificar se visita existe e se usuário tem permissão (criador OU consultor da empresa)
            $checkQuery = "SELECT v.id, v.created_by, v.status, v.type, v.company_id,
                                  e.consultant, e.consultant_secondary
                           FROM visitas v
                           LEFT JOIN empresas e ON v.company_id = e.id
                           WHERE v.id = ?";
            $checkStmt = $db->prepare($checkQuery);
            $checkStmt->execute([$visitaId]);
            $visita = $checkStmt->fetch();

            if (!$visita) {
                http_response_code(404);
                echo json_encode(['error' => 'VISITA NÃO ENCONTRADA']);
                exit;
            }

            // 🔥 VERIFICAR PERMISSÃO: Criador OU consultor principal OU secundário da empresa
            if ($user['role'] === 'CONSULTOR') {
                $temPermissao = ($visita['created_by'] == $user['user_id']) ||
                               ($visita['consultant'] == $user['user_id']) ||
                               ($visita['consultant_secondary'] == $user['user_id']);
                
                if (!$temPermissao) {
                    http_response_code(403);
                    echo json_encode([
                        'error' => 'SEM PERMISSÃO PARA ALTERAR ESTA VISITA',
                        'debug' => [
                            'user_id' => $user['user_id'],
                            'created_by' => $visita['created_by'],
                            'consultant' => $visita['consultant'],
                            'consultant_secondary' => $visita['consultant_secondary']
                        ]
                    ]);
                    exit;
                }
            }

            if ($action === 'remarcar') {
                // Verificar se a visita pode ser remarcada
                if ($visita['status'] === 'REMARCADA') {
                    http_response_code(400);
                    echo json_encode(['error' => 'VISITAS REMARCADAS NÃO PODEM SER REMARCADAS NOVAMENTE']);
                    exit;
                }
                
                if ($visita['status'] === 'REALIZADA') {
                    http_response_code(400);
                    echo json_encode(['error' => 'VISITAS REALIZADAS NÃO PODEM SER REMARCADAS']);
                    exit;
                }
                
                if ($visita['status'] === 'CANCELADA') {
                    http_response_code(400);
                    echo json_encode(['error' => 'VISITAS CANCELADAS NÃO PODEM SER REMARCADAS']);
                    exit;
                }

                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!isset($input['date'])) {
                    http_response_code(400);
                    echo json_encode(['error' => 'NOVA DATA É OBRIGATÓRIA']);
                    exit;
                }

                // Permitir remarcar para qualquer data (passado ou futuro)
                $query = "UPDATE visitas SET date = ?, status = 'REMARCADA', updated_at = CURRENT_TIMESTAMP 
                          WHERE id = ?";
                $stmt = $db->prepare($query);
                $result = $stmt->execute([$input['date'], $visitaId]);

                if ($result) {
                    $response = ['success' => true];
                    
                    // Mensagem especial para trabalho interno
                    if ($visita['type'] === 'TRABALHO INTERNO') {
                        $response['message'] = 'TRABALHO INTERNO CHB REMARCADO COM SUCESSO';
                    }
                    
                    echo json_encode($response);
                } else {
                    throw new Exception('Erro ao remarcar visita');
                }

            } elseif ($action === 'cancelar') {
                // Verificar se a visita pode ser cancelada
                if ($visita['status'] === 'REALIZADA') {
                    http_response_code(400);
                    echo json_encode(['error' => 'VISITAS REALIZADAS NÃO PODEM SER CANCELADAS']);
                    exit;
                }

                $query = "UPDATE visitas SET status = 'CANCELADA', updated_at = CURRENT_TIMESTAMP 
                          WHERE id = ?";
                $stmt = $db->prepare($query);
                $result = $stmt->execute([$visitaId]);

                if ($result) {
                    $response = ['success' => true];
                    
                    // Mensagem especial para trabalho interno
                    if ($visita['type'] === 'TRABALHO INTERNO') {
                        $response['message'] = 'TRABALHO INTERNO CHB CANCELADO';
                    }
                    
                    echo json_encode($response);
                } else {
                    throw new Exception('Erro ao cancelar visita');
                }
            } else {
                http_response_code(400);
                echo json_encode(['error' => 'AÇÃO INVÁLIDA']);
            }

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'ERRO AO ATUALIZAR VISITA: ' . $e->getMessage()]);
        }
        break;
}
?>
