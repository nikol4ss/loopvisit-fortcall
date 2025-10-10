<?php
require_once '../config/database.php';
require_once '../config/jwt.php';

// Usar a classe Database em vez de getConnection()
$database = new Database();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Verificar autenticação
$headers = getallheaders();
$token = null;

if (isset($headers['Authorization'])) {
    $token = str_replace('Bearer ', '', $headers['Authorization']);
} elseif (isset($_GET['token'])) {
    $token = $_GET['token'];
}

if (!$token) {
    http_response_code(401);
    echo json_encode(['error' => 'Token não fornecido']);
    exit;
}

try {
    // Usar a variável global do JWT
    global $jwt_secret;
    $decoded = JWT::decode($token, $jwt_secret, ['HS256']);
    $user_id = isset($decoded->user_id) ? $decoded->user_id : null;
    $user_role = isset($decoded->role) ? $decoded->role : 'CONSULTOR';
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['error' => 'Token inválido: ' . $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$request_uri = $_SERVER['REQUEST_URI'];

// Extrair ID da empresa - suporta tanto URL path quanto query parameter
$empresa_id = null;

// Método 1: Query parameter (?empresa_id=123)
if (isset($_GET['empresa_id'])) {
    $empresa_id = intval($_GET['empresa_id']);
}

// Método 2: URL path (/diagnosticos.php/123)
if (!$empresa_id && preg_match('/\/diagnosticos\.php\/(\d+)/', $request_uri, $matches)) {
    $empresa_id = intval($matches[1]);
}

try {
    $pdo = $database->getConnection();
    
    switch ($method) {
        case 'GET':
            if ($empresa_id) {
                getDiagnostico($pdo, $empresa_id, $user_id, $user_role);
            } else {
                http_response_code(400);
                echo json_encode(['error' => 'ID da empresa é obrigatório (use ?empresa_id=123 ou /diagnosticos.php/123)']);
            }
            break;
            
        case 'POST':
            salvarDiagnostico($pdo, $user_id, $user_role);
            break;
            
        case 'DELETE':
            if ($empresa_id) {
                excluirDiagnostico($pdo, $empresa_id, $user_id, $user_role);
            } else {
                http_response_code(400);
                echo json_encode(['error' => 'ID da empresa é obrigatório']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Método não permitido']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro interno: ' . $e->getMessage()]);
}

function getDiagnostico($pdo, $empresa_id, $user_id, $user_role) {
    // Verificar se o usuário pode acessar esta empresa
    if ($user_role !== 'GESTOR') {
        $stmt = $pdo->prepare("SELECT id FROM empresas WHERE id = ?");
        $stmt->execute([$empresa_id]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Empresa não encontrada']);
            return;
        }
    }
    
    // Buscar diagnóstico
    $stmt = $pdo->prepare("SELECT * FROM diagnosticos WHERE empresa_id = ?");
    $stmt->execute([$empresa_id]);
    $diagnostico = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$diagnostico) {
        // Retornar estrutura vazia para novo diagnóstico
        echo json_encode([
            'success' => true, 
            'data' => [
                'parque' => [],
                'operacao' => [],
                'previsao' => [],
                'relacionamento' => []
            ],
            'message' => 'Novo diagnóstico'
        ]);
        return;
    }
    
    $diagnostico_id = $diagnostico['id'];
    $result = [
        'parque' => [],
        'operacao' => [],
        'previsao' => [],
        'relacionamento' => []
    ];
    
    // ✅ CORREÇÃO: Buscar parque instalado com ordenação correta
    $stmt = $pdo->prepare("
        SELECT * FROM parque_itens 
        WHERE diagnostico_id = ? 
        ORDER BY 
            CASE WHEN tipo_item = 'EQUIPAMENTO' THEN 0 ELSE 1 END,
            id
    ");
    $stmt->execute([$diagnostico_id]);
    $parque_items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    error_log("=== GET DIAGNÓSTICO DEBUG ===");
    error_log("Itens encontrados no banco: " . count($parque_items));
    error_log("Dados do banco: " . print_r($parque_items, true));
    
    // ✅ CORREÇÃO: Organizar parque mantendo IDs reais e relacionamentos
    $temp_id_map = [];
    $next_temp_id = 1;
    
    // Primeiro passo: Mapear equipamentos
    foreach ($parque_items as $item) {
        if ($item['tipo_item'] === 'EQUIPAMENTO') {
            $temp_id_map[$item['id']] = $next_temp_id;
            $item['id_tmp'] = $next_temp_id;
            $item['id_real'] = $item['id'];
            
            unset($item['id'], $item['parent_id'], $item['diagnostico_id'], $item['created_at'], $item['updated_at']);
            $result['parque'][] = $item;
            $next_temp_id++;
        }
    }
    
    // Segundo passo: Mapear implementos
    foreach ($parque_items as $item) {
        if ($item['tipo_item'] === 'IMPLEMENTO') {
            $temp_id_map[$item['id']] = $next_temp_id;
            $item['id_tmp'] = $next_temp_id;
            $item['id_real'] = $item['id'];
            
            // ✅ CORREÇÃO: Mapear parent_id para parent_tmp
            if ($item['parent_id'] && isset($temp_id_map[$item['parent_id']])) {
                $item['parent_tmp'] = $temp_id_map[$item['parent_id']];
            } else {
                error_log("AVISO: Implemento órfão encontrado - ID: " . $item['id'] . ", parent_id: " . $item['parent_id']);
                $item['parent_tmp'] = null; // Implemento órfão
            }
            
            unset($item['id'], $item['parent_id'], $item['diagnostico_id'], $item['created_at'], $item['updated_at']);
            $result['parque'][] = $item;
            $next_temp_id++;
        }
    }
    
    error_log("Resultado final do parque: " . print_r($result['parque'], true));
    
    // Buscar operação
    $stmt = $pdo->prepare("SELECT * FROM diagnostico_operacao WHERE diagnostico_id = ?");
    $stmt->execute([$diagnostico_id]);
    $operacao = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($operacao) {
        unset($operacao['id'], $operacao['diagnostico_id'], $operacao['created_at'], $operacao['updated_at']);
        $result['operacao'] = $operacao;
    }
    
    // Buscar previsão
    $stmt = $pdo->prepare("SELECT * FROM diagnostico_previsao WHERE diagnostico_id = ?");
    $stmt->execute([$diagnostico_id]);
    $previsao = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($previsao) {
        unset($previsao['id'], $previsao['diagnostico_id'], $previsao['created_at'], $previsao['updated_at']);
        $result['previsao'] = $previsao;
    }
    
    // Buscar relacionamento
    $stmt = $pdo->prepare("SELECT * FROM diagnostico_relacionamento WHERE diagnostico_id = ?");
    $stmt->execute([$diagnostico_id]);
    $relacionamento = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($relacionamento) {
        unset($relacionamento['id'], $relacionamento['diagnostico_id'], $relacionamento['created_at'], $relacionamento['updated_at']);
        $result['relacionamento'] = $relacionamento;
    }
    
    echo json_encode(['success' => true, 'data' => $result]);
}

function salvarDiagnostico($pdo, $user_id, $user_role) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // DEBUG: Log dos dados recebidos
    error_log("=== DIAGNÓSTICO SAVE DEBUG ===");
    error_log("Dados recebidos: " . print_r($input, true));
    
    if (!$input || !isset($input['empresa_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Dados inválidos']);
        return;
    }
    
    $empresa_id = intval($input['empresa_id']);
    error_log("Empresa ID: " . $empresa_id);
    
    // Verificar se o usuário pode acessar esta empresa
    if ($user_role !== 'GESTOR') {
        $stmt = $pdo->prepare("SELECT id FROM empresas WHERE id = ?");
        $stmt->execute([$empresa_id]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Empresa não encontrada']);
            return;
        }
    }
    
    $pdo->beginTransaction();
    
    try {
        // Criar ou buscar diagnóstico
        $stmt = $pdo->prepare("SELECT id FROM diagnosticos WHERE empresa_id = ?");
        $stmt->execute([$empresa_id]);
        $diagnostico = $stmt->fetch();
        
        if ($diagnostico) {
            $diagnostico_id = $diagnostico['id'];
            $stmt = $pdo->prepare("UPDATE diagnosticos SET updated_at = CURRENT_TIMESTAMP WHERE id = ?");
            $stmt->execute([$diagnostico_id]);
            error_log("Diagnóstico atualizado ID: " . $diagnostico_id);
        } else {
            $stmt = $pdo->prepare("INSERT INTO diagnosticos (empresa_id) VALUES (?)");
            $stmt->execute([$empresa_id]);
            $diagnostico_id = $pdo->lastInsertId();
            error_log("Novo diagnóstico criado ID: " . $diagnostico_id);
        }
        
        // ✅ CORREÇÃO: Salvar parque com lógica DEFINITIVA anti-duplicação
        if (isset($input['parque']) && is_array($input['parque'])) {
            salvarParqueDefinitivo($pdo, $diagnostico_id, $input['parque']);
        }
        
        // Salvar operação (mantém lógica atual)
        salvarOperacao($pdo, $diagnostico_id, $input['operacao'] ?? []);
        
        // Salvar previsão (mantém lógica atual)
        salvarPrevisao($pdo, $diagnostico_id, $input['previsao'] ?? []);
        
        // Salvar relacionamento (mantém lógica atual)
        salvarRelacionamento($pdo, $diagnostico_id, $input['relacionamento'] ?? []);
        
        $pdo->commit();
        error_log("=== DIAGNÓSTICO SALVO COM SUCESSO ===");
        echo json_encode(['success' => true, 'message' => 'Diagnóstico salvo com sucesso']);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Erro ao salvar diagnóstico: " . $e->getMessage());
        throw $e;
    }
}

// ✅ NOVA FUNÇÃO: Salvar parque com lógica DEFINITIVA
function salvarParqueDefinitivo($pdo, $diagnostico_id, $parque_items) {
    error_log("=== SALVANDO PARQUE DEFINITIVO ===");
    error_log("Itens recebidos: " . count($parque_items));
    
    // ✅ ESTRATÉGIA RADICAL: Limpar tudo e recriar
    // Isso garante que não haverá duplicatas nem problemas de sincronização
    
    // 1. EXCLUIR TODOS os itens existentes do diagnóstico
    error_log("Excluindo todos os itens existentes...");
    $stmt = $pdo->prepare("DELETE FROM parque_itens WHERE diagnostico_id = ?");
    $stmt->execute([$diagnostico_id]);
    $itens_excluidos = $stmt->rowCount();
    error_log("Itens excluídos: " . $itens_excluidos);
    
    // 2. RECRIAR TODOS os itens baseado no frontend
    $temp_to_real_map = [];
    
    // Primeiro: Inserir equipamentos
    foreach ($parque_items as $item) {
        if ($item['tipo_item'] === 'EQUIPAMENTO') {
            error_log("Inserindo equipamento: " . $item['equipamento_impl']);
            
            $stmt = $pdo->prepare("
                INSERT INTO parque_itens (diagnostico_id, parent_id, tipo_item, equipamento_impl, marca, modelo, situacao) 
                VALUES (?, NULL, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $diagnostico_id,
                $item['tipo_item'],
                $item['equipamento_impl'],
                $item['marca'],
                $item['modelo'],
                $item['situacao']
            ]);
            
            $novo_id = $pdo->lastInsertId();
            $temp_to_real_map[$item['id_tmp']] = $novo_id;
            error_log("Equipamento inserido - temp_id: {$item['id_tmp']} -> real_id: {$novo_id}");
        }
    }
    
    // Segundo: Inserir implementos
    foreach ($parque_items as $item) {
        if ($item['tipo_item'] === 'IMPLEMENTO') {
            $parent_real_id = $temp_to_real_map[$item['parent_tmp']] ?? null;
            
            if (!$parent_real_id) {
                error_log("ERRO: Parent não encontrado para implemento - parent_tmp: " . $item['parent_tmp']);
                continue;
            }
            
            error_log("Inserindo implemento: " . $item['equipamento_impl'] . " (parent: {$parent_real_id})");
            
            $stmt = $pdo->prepare("
                INSERT INTO parque_itens (diagnostico_id, parent_id, tipo_item, equipamento_impl, marca, modelo, situacao) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $diagnostico_id,
                $parent_real_id,
                $item['tipo_item'],
                $item['equipamento_impl'],
                $item['marca'],
                $item['modelo'],
                $item['situacao']
            ]);
            
            $novo_id = $pdo->lastInsertId();
            error_log("Implemento inserido - temp_id: {$item['id_tmp']} -> real_id: {$novo_id}");
        }
    }
    
    // 3. Verificar resultado final
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM parque_itens WHERE diagnostico_id = ?");
    $stmt->execute([$diagnostico_id]);
    $total_final = $stmt->fetchColumn();
    
    error_log("Total de itens após inserção: " . $total_final);
    error_log("=== PARQUE SALVO DEFINITIVAMENTE ===");
}

// ✅ NOVA FUNÇÃO: Salvar operação com UPSERT
function salvarOperacao($pdo, $diagnostico_id, $operacao) {
    if (!is_array($operacao) || empty($operacao)) return;
    
    $tem_dados = false;
    foreach ($operacao as $key => $value) {
        if (!empty($value) && $value !== '' && $value !== null) {
            $tem_dados = true;
            break;
        }
    }
    
    if (!$tem_dados) return;
    
    error_log("=== SALVANDO OPERAÇÃO INTELIGENTE ===");
    
    // ✅ Verificar se já existe registro
    $stmt = $pdo->prepare("SELECT id FROM diagnostico_operacao WHERE diagnostico_id = ?");
    $stmt->execute([$diagnostico_id]);
    $existe = $stmt->fetch();
    
    if ($existe) {
        // ✅ UPDATE - mantém o mesmo ID
        error_log("Atualizando operação existente ID: " . $existe['id']);
        $stmt = $pdo->prepare("
            UPDATE diagnostico_operacao 
            SET tipo_operacao = ?, tipo_sucata = ?, qtd_producao_mes_ton = ?, ton_vendida = ?, 
                fundo_baia = ?, qtd_cliente_quer_crescer = ?, cliente_fornece_para = ?, preco_venda_ton = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE diagnostico_id = ?
        ");
        $stmt->execute([
            $operacao['tipo_operacao'] ?? '',
            $operacao['tipo_sucata'] ?? '',
            !empty($operacao['qtd_producao_mes_ton']) ? floatval($operacao['qtd_producao_mes_ton']) : null,
            !empty($operacao['ton_vendida']) ? floatval($operacao['ton_vendida']) : null,
            isset($operacao['fundo_baia']) ? intval($operacao['fundo_baia']) : 0,
            !empty($operacao['qtd_cliente_quer_crescer']) ? intval($operacao['qtd_cliente_quer_crescer']) : null,
            $operacao['cliente_fornece_para'] ?? '',
            !empty($operacao['preco_venda_ton']) ? floatval($operacao['preco_venda_ton']) : null,
            $diagnostico_id
        ]);
    } else {
        // ✅ INSERT - novo registro
        error_log("Inserindo nova operação");
        $stmt = $pdo->prepare("
            INSERT INTO diagnostico_operacao 
            (diagnostico_id, tipo_operacao, tipo_sucata, qtd_producao_mes_ton, ton_vendida, 
             fundo_baia, qtd_cliente_quer_crescer, cliente_fornece_para, preco_venda_ton) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $diagnostico_id,
            $operacao['tipo_operacao'] ?? '',
            $operacao['tipo_sucata'] ?? '',
            !empty($operacao['qtd_producao_mes_ton']) ? floatval($operacao['qtd_producao_mes_ton']) : null,
            !empty($operacao['ton_vendida']) ? floatval($operacao['ton_vendida']) : null,
            isset($operacao['fundo_baia']) ? intval($operacao['fundo_baia']) : 0,
            !empty($operacao['qtd_cliente_quer_crescer']) ? intval($operacao['qtd_cliente_quer_crescer']) : null,
            $operacao['cliente_fornece_para'] ?? '',
            !empty($operacao['preco_venda_ton']) ? floatval($operacao['preco_venda_ton']) : null
        ]);
    }
    error_log("Operação salva com sucesso!");
}

// ✅ NOVA FUNÇÃO: Salvar previsão com UPSERT
function salvarPrevisao($pdo, $diagnostico_id, $previsao) {
    if (!is_array($previsao) || empty($previsao)) return;
    
    $tem_dados = false;
    foreach ($previsao as $key => $value) {
        if (!empty($value) && $value !== '' && $value !== null) {
            $tem_dados = true;
            break;
        }
    }
    
    if (!$tem_dados) return;
    
    error_log("=== SALVANDO PREVISÃO INTELIGENTE ===");
    
    // ✅ Verificar se já existe registro
    $stmt = $pdo->prepare("SELECT id FROM diagnostico_previsao WHERE diagnostico_id = ?");
    $stmt->execute([$diagnostico_id]);
    $existe = $stmt->fetch();
    
    if ($existe) {
        // ✅ UPDATE - mantém o mesmo ID
        error_log("Atualizando previsão existente ID: " . $existe['id']);
        $stmt = $pdo->prepare("
            UPDATE diagnostico_previsao 
            SET tipo_cliente = ?, expansao_equip_implement = ?, prazo_expansao = ?, tipo_equip_interesse = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE diagnostico_id = ?
        ");
        $stmt->execute([
            $previsao['tipo_cliente'] ?? '',
            isset($previsao['expansao_equip_implement']) ? intval($previsao['expansao_equip_implement']) : 0,
            $previsao['prazo_expansao'] ?? '',
            $previsao['tipo_equip_interesse'] ?? '',
            $diagnostico_id
        ]);
    } else {
        // ✅ INSERT - novo registro
        error_log("Inserindo nova previsão");
        $stmt = $pdo->prepare("
            INSERT INTO diagnostico_previsao 
            (diagnostico_id, tipo_cliente, expansao_equip_implement, prazo_expansao, tipo_equip_interesse) 
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $diagnostico_id,
            $previsao['tipo_cliente'] ?? '',
            isset($previsao['expansao_equip_implement']) ? intval($previsao['expansao_equip_implement']) : 0,
            $previsao['prazo_expansao'] ?? '',
            $previsao['tipo_equip_interesse'] ?? ''
        ]);
    }
    error_log("Previsão salva com sucesso!");
}

// ✅ NOVA FUNÇÃO: Salvar relacionamento com UPSERT
function salvarRelacionamento($pdo, $diagnostico_id, $relacionamento) {
    if (!is_array($relacionamento) || empty($relacionamento)) return;
    
    $tem_dados = false;
    foreach ($relacionamento as $key => $value) {
        if ($value == 1 || $value === true) {
            $tem_dados = true;
            break;
        }
    }
    
    if (!$tem_dados) return;
    
    error_log("=== SALVANDO RELACIONAMENTO INTELIGENTE ===");
    
    // ✅ Verificar se já existe registro
    $stmt = $pdo->prepare("SELECT id FROM diagnostico_relacionamento WHERE diagnostico_id = ?");
    $stmt->execute([$diagnostico_id]);
    $existe = $stmt->fetch();
    
    if ($existe) {
        // ✅ UPDATE - mantém o mesmo ID
        error_log("Atualizando relacionamento existente ID: " . $existe['id']);
        $stmt = $pdo->prepare("
            UPDATE diagnostico_relacionamento 
            SET contato_comprador = ?, contato_operador = ?, contato_encarregado = ?, contato_diretor = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE diagnostico_id = ?
        ");
        $stmt->execute([
            isset($relacionamento['contato_comprador']) ? intval($relacionamento['contato_comprador']) : 0,
            isset($relacionamento['contato_operador']) ? intval($relacionamento['contato_operador']) : 0,
            isset($relacionamento['contato_encarregado']) ? intval($relacionamento['contato_encarregado']) : 0,
            isset($relacionamento['contato_diretor']) ? intval($relacionamento['contato_diretor']) : 0,
            $diagnostico_id
        ]);
    } else {
        // ✅ INSERT - novo registro
        error_log("Inserindo novo relacionamento");
        $stmt = $pdo->prepare("
            INSERT INTO diagnostico_relacionamento 
            (diagnostico_id, contato_comprador, contato_operador, contato_encarregado, contato_diretor) 
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $diagnostico_id,
            isset($relacionamento['contato_comprador']) ? intval($relacionamento['contato_comprador']) : 0,
            isset($relacionamento['contato_operador']) ? intval($relacionamento['contato_operador']) : 0,
            isset($relacionamento['contato_encarregado']) ? intval($relacionamento['contato_encarregado']) : 0,
            isset($relacionamento['contato_diretor']) ? intval($relacionamento['contato_diretor']) : 0
        ]);
    }
    error_log("Relacionamento salvo com sucesso!");
}

function excluirDiagnostico($pdo, $empresa_id, $user_id, $user_role) {
    if ($user_role !== 'GESTOR') {
        $stmt = $pdo->prepare("SELECT id FROM empresas WHERE id = ?");
        $stmt->execute([$empresa_id]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Empresa não encontrada']);
            return;
        }
    }
    
    $stmt = $pdo->prepare("DELETE FROM diagnosticos WHERE empresa_id = ?");
    $stmt->execute([$empresa_id]);
    
    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Diagnóstico excluído com sucesso']);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Diagnóstico não encontrado']);
    }
}
?>
