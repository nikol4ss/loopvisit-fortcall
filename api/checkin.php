<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
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

// Extrair ID da visita da URL
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$pathParts = explode('/', $path);
$visitaId = (int)$pathParts[count($pathParts) - 1];

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        try {
            $query = "SELECT c.*, 
                             CASE WHEN c.attachment IS NOT NULL AND c.attachment != '' THEN 1 ELSE 0 END as has_attachment
                      FROM checkin c 
                      WHERE c.visita_id = :visita_id";

            $stmt = $db->prepare($query);
            $stmt->bindParam(':visita_id', $visitaId);
            $stmt->execute();

            $checkin = $stmt->fetch();
            if (!$checkin) {
                // Criar checkin vazio se não existir
                $insertQuery = "INSERT INTO checkin (visita_id, opportunity, negociacao, termometro, numero_os) 
                               VALUES (:visita_id, 0, 0, 5, '')";
                $insertStmt = $db->prepare($insertQuery);
                $insertStmt->bindParam(':visita_id', $visitaId);
                $insertStmt->execute();
                
                $checkin = [
                    'id' => $db->lastInsertId(),
                    'visita_id' => $visitaId,
                    'is_draft' => 1,
                    'has_attachment' => 0,
                    'opportunity' => 0,
                    'negociacao' => 0,
                    'termometro' => 5,
                    'numero_os' => ''
                ];
            }

            echo json_encode(['success' => true, 'data' => $checkin]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'ERRO AO BUSCAR CHECK-IN: ' . $e->getMessage()]);
        }
        break;

    case 'POST':
    case 'PUT':
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            error_log("=== CHECKIN SIMPLES API DEBUG ===");
            error_log("Dados recebidos: " . json_encode($input));
            
            // Verificar se checkin já existe
            $checkQuery = "SELECT id FROM checkin WHERE visita_id = :visita_id";
            $checkStmt = $db->prepare($checkQuery);
            $checkStmt->bindParam(':visita_id', $visitaId);
            $checkStmt->execute();
            $existing = $checkStmt->fetch();

            if ($existing) {
                // Update
                $fields = [];
                $params = [':visita_id' => $visitaId];

                // Campos permitidos incluindo os novos campos de negociação
                $allowedFields = ['summary', 'opportunity', 'negociacao', 'termometro', 'numero_os', 'is_draft'];

                foreach ($allowedFields as $field) {
                    if (array_key_exists($field, $input)) {
                        $fields[] = "$field = :$field";
                        $params[":$field"] = $input[$field];
                    }
                }

                if (!empty($fields)) {
                    $query = "UPDATE checkin SET " . implode(', ', $fields) . ", updated_at = CURRENT_TIMESTAMP 
                          WHERE visita_id = :visita_id";
                    
                    error_log("Query UPDATE: " . $query);
                    error_log("Parâmetros: " . json_encode($params));
                    
                    $stmt = $db->prepare($query);
                    
                    foreach ($params as $key => $value) {
                        $stmt->bindValue($key, $value);
                    }

                    if ($stmt->execute()) {
                        // CORREÇÃO: Se não é mais rascunho, atualizar status da visita
                        if (isset($input['is_draft']) && $input['is_draft'] == 0) {
                            error_log("🔄 Atualizando status da visita para REALIZADA");
                            
                            $updateVisitQuery = "UPDATE visitas SET status = 'REALIZADA', updated_at = CURRENT_TIMESTAMP 
                                                WHERE id = :visita_id";
                            $updateVisitStmt = $db->prepare($updateVisitQuery);
                            $updateVisitStmt->bindParam(':visita_id', $visitaId);
                            
                            if ($updateVisitStmt->execute()) {
                                error_log("✅ Status da visita atualizado para REALIZADA");
                            } else {
                                error_log("❌ Erro ao atualizar status da visita: " . json_encode($updateVisitStmt->errorInfo()));
                            }
                        }

                        echo json_encode([
                            'success' => true,
                            'message' => isset($input['is_draft']) && $input['is_draft'] == 0 ? 'CHECK-IN FINALIZADO E VISITA MARCADA COMO REALIZADA' : 'CHECK-IN SALVO'
                        ]);
                    } else {
                        $errorInfo = $stmt->errorInfo();
                        error_log("Erro na execução da query: " . json_encode($errorInfo));
                        throw new Exception('Erro ao atualizar check-in: ' . $errorInfo[2]);
                    }
                } else {
                    echo json_encode(['success' => true, 'message' => 'Nenhum campo para atualizar']);
                }
            } else {
                // Insert
                $input['visita_id'] = $visitaId;
                
                // Garantir valores padrão para os novos campos
                if (!isset($input['opportunity'])) {
                    $input['opportunity'] = 0;
                }
                if (!isset($input['negociacao'])) {
                    $input['negociacao'] = 0;
                }
                if (!isset($input['termometro'])) {
                    $input['termometro'] = 5;
                }
                if (!isset($input['numero_os'])) {
                    $input['numero_os'] = '';
                }
                if (!isset($input['is_draft'])) {
                    $input['is_draft'] = 1;
                }
                
                $fields = array_keys($input);
                $placeholders = array_map(function($field) { return ":$field"; }, $fields);
                
                $query = "INSERT INTO checkin (" . implode(', ', $fields) . ") 
                          VALUES (" . implode(', ', $placeholders) . ")";
                
                error_log("Query INSERT: " . $query);
                error_log("Dados para INSERT: " . json_encode($input));
                
                $stmt = $db->prepare($query);
                foreach ($input as $key => $value) {
                    $stmt->bindValue(":$key", $value);
                }

                if ($stmt->execute()) {
                    // CORREÇÃO: Se não é rascunho, atualizar status da visita
                    if (isset($input['is_draft']) && $input['is_draft'] == 0) {
                        error_log("🔄 Atualizando status da visita para REALIZADA (INSERT)");
                        
                        $updateVisitQuery = "UPDATE visitas SET status = 'REALIZADA', updated_at = CURRENT_TIMESTAMP 
                                            WHERE id = :visita_id";
                        $updateVisitStmt = $db->prepare($updateVisitQuery);
                        $updateVisitStmt->bindParam(':visita_id', $visitaId);
                        
                        if ($updateVisitStmt->execute()) {
                            error_log("✅ Status da visita atualizado para REALIZADA (INSERT)");
                        } else {
                            error_log("❌ Erro ao atualizar status da visita (INSERT): " . json_encode($updateVisitStmt->errorInfo()));
                        }
                    }
                    
                    echo json_encode([
                        'success' => true, 
                        'id' => $db->lastInsertId(),
                        'message' => isset($input['is_draft']) && $input['is_draft'] == 0 ? 'CHECK-IN FINALIZADO E VISITA MARCADA COMO REALIZADA' : 'CHECK-IN SALVO'
                    ]);
                } else {
                    $errorInfo = $stmt->errorInfo();
                    error_log("Erro na execução da query INSERT: " . json_encode($errorInfo));
                    throw new Exception('Erro ao criar check-in: ' . $errorInfo[2]);
                }
            }
        } catch (Exception $e) {
            error_log("Erro geral no checkin.php: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'ERRO AO SALVAR CHECK-IN: ' . $e->getMessage()]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'MÉTODO NÃO PERMITIDO']);
        break;
}
?>
