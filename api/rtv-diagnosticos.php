<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';

try {
    $pdo = new PDO($dsn, $username, $password, $options);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro de conexão: ' . $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

switch ($method) {
    case 'GET':
        handleGet($pdo);
        break;
    case 'POST':
        handlePost($pdo, $input);
        break;
    case 'PUT':
        handlePut($pdo, $input);
        break;
    case 'DELETE':
        handleDelete($pdo);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método não permitido']);
        break;
}

function handleGet($pdo) {
    try {
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        $offset = ($page - 1) * $limit;
        
        $search = isset($_GET['search']) ? $_GET['search'] : '';
        $tipo_cliente = isset($_GET['tipo_cliente']) ? $_GET['tipo_cliente'] : '';
        $consultor = isset($_GET['consultor']) ? $_GET['consultor'] : '';
        
        // Query base
        $whereConditions = [];
        $params = [];
        
        if (!empty($search)) {
            $whereConditions[] = "(cliente_nome LIKE :search OR localizacao LIKE :search2)";
            $params[':search'] = "%$search%";
            $params[':search2'] = "%$search%";
        }
        
        if (!empty($tipo_cliente)) {
            $whereConditions[] = "tipo_cliente = :tipo_cliente";
            $params[':tipo_cliente'] = $tipo_cliente;
        }
        
        if (!empty($consultor)) {
            $whereConditions[] = "consultor_nome LIKE :consultor";
            $params[':consultor'] = "%$consultor%";
        }
        
        $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';
        
        // Contar total
        $countSql = "SELECT COUNT(*) FROM rtv_diagnosticos $whereClause";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();
        
        // Buscar dados
        $sql = "SELECT * FROM rtv_diagnosticos $whereClause ORDER BY created_at DESC LIMIT :limit OFFSET :offset";
        $stmt = $pdo->prepare($sql);
        
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        
        $stmt->execute();
        $diagnosticos = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $diagnosticos,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => (int)$total,
                'pages' => ceil($total / $limit)
            ]
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao buscar diagnósticos: ' . $e->getMessage()]);
    }
}

function handlePost($pdo, $input) {
    try {
        // Validar dados obrigatórios
        if (empty($input['consultor_nome']) || empty($input['cliente_nome']) || empty($input['tipo_cliente'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Campos obrigatórios: consultor_nome, cliente_nome, tipo_cliente']);
            return;
        }
        
        $sql = "INSERT INTO rtv_diagnosticos (
            consultor_nome, cliente_nome, tipo_cliente, localizacao,
            caracterizacao_propriedade, diagnostico_comercial, situacao_mudancas,
            sustentabilidade, relacionamento_perspectivas, observacoes_rtv
        ) VALUES (
            :consultor_nome, :cliente_nome, :tipo_cliente, :localizacao,
            :caracterizacao_propriedade, :diagnostico_comercial, :situacao_mudancas,
            :sustentabilidade, :relacionamento_perspectivas, :observacoes_rtv
        )";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':consultor_nome' => $input['consultor_nome'],
            ':cliente_nome' => $input['cliente_nome'],
            ':tipo_cliente' => $input['tipo_cliente'],
            ':localizacao' => $input['localizacao'] ?? '',
            ':caracterizacao_propriedade' => $input['caracterizacao_propriedade'] ?? '',
            ':diagnostico_comercial' => $input['diagnostico_comercial'] ?? '',
            ':situacao_mudancas' => $input['situacao_mudancas'] ?? '',
            ':sustentabilidade' => $input['sustentabilidade'] ?? '',
            ':relacionamento_perspectivas' => $input['relacionamento_perspectivas'] ?? '',
            ':observacoes_rtv' => $input['observacoes_rtv'] ?? ''
        ]);
        
        $id = $pdo->lastInsertId();
        
        echo json_encode([
            'success' => true,
            'message' => 'Diagnóstico RTV criado com sucesso',
            'id' => $id
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao criar diagnóstico: ' . $e->getMessage()]);
    }
}

function handlePut($pdo, $input) {
    try {
        if (empty($input['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'ID é obrigatório para atualização']);
            return;
        }
        
        $sql = "UPDATE rtv_diagnosticos SET 
            consultor_nome = :consultor_nome,
            cliente_nome = :cliente_nome,
            tipo_cliente = :tipo_cliente,
            localizacao = :localizacao,
            caracterizacao_propriedade = :caracterizacao_propriedade,
            diagnostico_comercial = :diagnostico_comercial,
            situacao_mudancas = :situacao_mudancas,
            sustentabilidade = :sustentabilidade,
            relacionamento_perspectivas = :relacionamento_perspectivas,
            observacoes_rtv = :observacoes_rtv
        WHERE id = :id";
        
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute([
            ':id' => $input['id'],
            ':consultor_nome' => $input['consultor_nome'],
            ':cliente_nome' => $input['cliente_nome'],
            ':tipo_cliente' => $input['tipo_cliente'],
            ':localizacao' => $input['localizacao'] ?? '',
            ':caracterizacao_propriedade' => $input['caracterizacao_propriedade'] ?? '',
            ':diagnostico_comercial' => $input['diagnostico_comercial'] ?? '',
            ':situacao_mudancas' => $input['situacao_mudancas'] ?? '',
            ':sustentabilidade' => $input['sustentabilidade'] ?? '',
            ':relacionamento_perspectivas' => $input['relacionamento_perspectivas'] ?? '',
            ':observacoes_rtv' => $input['observacoes_rtv'] ?? ''
        ]);
        
        if ($result) {
            echo json_encode(['success' => true, 'message' => 'Diagnóstico atualizado com sucesso']);
        } else {
            echo json_encode(['error' => 'Erro ao atualizar diagnóstico']);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao atualizar diagnóstico: ' . $e->getMessage()]);
    }
}

function handleDelete($pdo) {
    try {
        $id = $_GET['id'] ?? null;
        
        if (empty($id)) {
            http_response_code(400);
            echo json_encode(['error' => 'ID é obrigatório para exclusão']);
            return;
        }
        
        $sql = "DELETE FROM rtv_diagnosticos WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute([':id' => $id]);
        
        if ($result) {
            echo json_encode(['success' => true, 'message' => 'Diagnóstico excluído com sucesso']);
        } else {
            echo json_encode(['error' => 'Erro ao excluir diagnóstico']);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao excluir diagnóstico: ' . $e->getMessage()]);
    }
}
?>
