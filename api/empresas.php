<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config/database.php';

// <CHANGE> Função robusta para obter o header Authorization (compatível com Umbler/Nginx/FastCGI)
function getAuthorizationHeader() {
    $headers = null;

    // Método 1: Apache/mod_php
    if (isset($_SERVER['Authorization'])) {
        $headers = trim($_SERVER['Authorization']);
    }
    // Método 2: Nginx ou FastCGI (mais comum na Umbler)
    else if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER['HTTP_AUTHORIZATION']);
    }
    // Método 3: Apache com mod_rewrite
    else if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    }
    // Método 4: getallheaders() com case insensitive
    else if (function_exists('getallheaders')) {
        $requestHeaders = getallheaders();
        // Normalizar keys para lowercase
        $requestHeaders = array_change_key_case($requestHeaders, CASE_LOWER);
        if (isset($requestHeaders['authorization'])) {
            $headers = trim($requestHeaders['authorization']);
        }
    }

    return $headers;
}

try {
    // Usar a classe Database correta
    $database = new Database();
    $conn = $database->getConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Criar nova empresa
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data) {
            echo json_encode(['success' => false, 'error' => 'Dados não fornecidos']);
            exit;
        }

        // Log para debug
        error_log("POST recebido para criar empresa: " . json_encode($data));

        // Validar campos obrigatórios
        $requiredFields = ['name', 'cnpj', 'segment', 'address', 'state_id', 'city_id', 'region', 'consultant'];
        foreach ($requiredFields as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                echo json_encode(['success' => false, 'error' => "Campo $field é obrigatório"]);
                exit;
            }
        }

        // <CHANGE> Usar a função robusta para obter o header Authorization
        $authHeader = getAuthorizationHeader();

        if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            echo json_encode(['success' => false, 'error' => 'Token de autorização não fornecido']);
            exit;
        }

        $token = $matches[1];

        // Decodificar token JWT
        require_once '../config/jwt.php';
        $jwt = new JWT();
        $decoded = $jwt->decode($token);

        if (!$decoded) {
            echo json_encode(['success' => false, 'error' => 'Token inválido']);
            exit;
        }

        $userId = $decoded['user_id'];

        // Preparar dados para inserção - INCLUINDO CONSULTANT_SECONDARY
        $sql = "INSERT INTO empresas (
            name, cnpj, segment, sector, address, state_id, city_id, region,
            phone, whatsapp, email, responsible, consultant, consultant_secondary, rating, status,
            created_by, created_at, updated_at
        ) VALUES (
            :name, :cnpj, :segment, :sector, :address, :state_id, :city_id, :region,
            :phone, :whatsapp, :email, :responsible, :consultant, :consultant_secondary, :rating, :status,
            :created_by, NOW(), NOW()
        )";

        $stmt = $conn->prepare($sql);

        // Bind dos parâmetros
        $stmt->bindValue(':name', $data['name']);
        $stmt->bindValue(':cnpj', $data['cnpj']);
        $stmt->bindValue(':segment', $data['segment']);
        $stmt->bindValue(':sector', $data['sector'] ?? '');
        $stmt->bindValue(':address', $data['address']);
        $stmt->bindValue(':state_id', (int)$data['state_id'], PDO::PARAM_INT);
        $stmt->bindValue(':city_id', (int)$data['city_id'], PDO::PARAM_INT);
        $stmt->bindValue(':region', $data['region']);
        $stmt->bindValue(':phone', $data['phone'] ?? '');
        $stmt->bindValue(':whatsapp', $data['whatsapp'] ?? '');
        $stmt->bindValue(':email', $data['email'] ?? '');
        $stmt->bindValue(':responsible', $data['responsible'] ?? '');
        $stmt->bindValue(':consultant', (int)$data['consultant'], PDO::PARAM_INT);

        // NOVO: Consultor secundário (opcional)
        if (!empty($data['consultant_secondary'])) {
            $stmt->bindValue(':consultant_secondary', (int)$data['consultant_secondary'], PDO::PARAM_INT);
        } else {
            $stmt->bindValue(':consultant_secondary', null, PDO::PARAM_NULL);
        }

        $stmt->bindValue(':rating', isset($data['rating']) ? (int)$data['rating'] : null, PDO::PARAM_INT);
        $stmt->bindValue(':status', 'ATIVA');
        $stmt->bindValue(':created_by', $userId, PDO::PARAM_INT);

        if ($stmt->execute()) {
            $empresaId = $conn->lastInsertId();
            echo json_encode([
                'success' => true,
                'message' => 'Empresa criada com sucesso',
                'id' => $empresaId
            ]);
        } else {
            $errorInfo = $stmt->errorInfo();
            error_log("Erro SQL ao criar empresa: " . json_encode($errorInfo));
            echo json_encode(['success' => false, 'error' => 'Erro ao criar empresa: ' . $errorInfo[2]]);
        }

    } else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Verificar se estamos buscando uma empresa específica pelo ID
        if (isset($_GET['id']) && !empty($_GET['id'])) {
            $empresaId = (int)$_GET['id'];

            // ATUALIZADO: Incluir consultor secundário
            $sql = "SELECT
                    e.*,
                    COALESCE(c.nome, 'Não informado') as cidade_nome,
                    COALESCE(u1.name, 'Não atribuído') as consultor_nome,
                    COALESCE(u2.name, '') as consultor_secundario_nome,
                    COALESCE(creator.name, 'Sistema') as created_by_name
                FROM empresas e
                LEFT JOIN cidades c ON e.city_id = c.id_cidade
                LEFT JOIN usuarios u1 ON e.consultant = u1.id
                LEFT JOIN usuarios u2 ON e.consultant_secondary = u2.id
                LEFT JOIN usuarios creator ON e.created_by = creator.id
                WHERE e.id = :id";

            $stmt = $conn->prepare($sql);
            $stmt->bindValue(':id', $empresaId, PDO::PARAM_INT);
            $stmt->execute();

            $empresa = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($empresa) {
                echo json_encode([
                    'success' => true,
                    'data' => $empresa
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'error' => 'Empresa não encontrada'
                ]);
            }
            exit;
        }

        // Código para listar empresas - ATUALIZADO com consultor secundário
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? min((int)$_GET['limit'], 100) : 50;
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $status = isset($_GET['status']) ? trim($_GET['status']) : '';
        $offset = ($page - 1) * $limit;

        // Construir WHERE clause
        $whereConditions = [];
        $params = [];

        if (!empty($search)) {
            $whereConditions[] = "(e.name LIKE :search1 OR e.cnpj LIKE :search2 OR e.responsible LIKE :search3 OR c.nome LIKE :search4)";
            $params[':search1'] = "%$search%";
            $params[':search2'] = "%$search%";
            $params[':search3'] = "%$search%";
            $params[':search4'] = "%$search%";
        }

        if (!empty($status)) {
            $whereConditions[] = "e.status = :status";
            $params[':status'] = $status;
        }

        $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';

        // Query ATUALIZADA com consultor secundário
        $sql = "SELECT
                    e.id,
                    e.name,
                    e.cnpj,
                    e.address,
                    e.rating,
                    e.phone,
                    e.email,
                    e.responsible,
                    e.segment,
                    e.status,
                    COALESCE(c.nome, 'Não informado') as cidade_nome,
                    COALESCE(u1.name, 'Não atribuído') as consultor_nome,
                    COALESCE(u2.name, '') as consultor_secundario_nome
                FROM empresas e
                LEFT JOIN cidades c ON e.city_id = c.id_cidade
                LEFT JOIN usuarios u1 ON e.consultant = u1.id
                LEFT JOIN usuarios u2 ON e.consultant_secondary = u2.id
                $whereClause
                ORDER BY e.name ASC
                LIMIT :limit OFFSET :offset";

        $stmt = $conn->prepare($sql);

        // Bind dos parâmetros de busca
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }

        // Bind dos parâmetros de paginação
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

        $stmt->execute();
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $empresas = [];
        foreach ($result as $row) {
            $empresas[] = [
                'id' => $row['id'],
                'name' => $row['name'],
                'cnpj' => $row['cnpj'] ?: null,
                'address' => $row['address'] ?: '-',
                'rating' => $row['rating'] ?: null,
                'phone' => $row['phone'],
                'email' => $row['email'],
                'responsible' => $row['responsible'],
                'segment' => $row['segment'],
                'status' => $row['status'] ?: 'ATIVA',
                'cidade_nome' => $row['cidade_nome'],
                'consultor_nome' => $row['consultor_nome'],
                'consultor_secundario_nome' => $row['consultor_secundario_nome']
            ];
        }

        // Contar total com os mesmos JOINs
        $countSql = "SELECT COUNT(*) as total
                     FROM empresas e
                     LEFT JOIN cidades c ON e.city_id = c.id_cidade
                     LEFT JOIN usuarios u1 ON e.consultant = u1.id
                     LEFT JOIN usuarios u2 ON e.consultant_secondary = u2.id
                     $whereClause";

        $countStmt = $conn->prepare($countSql);

        // Bind dos parâmetros de busca para contagem
        foreach ($params as $key => $value) {
            if (strpos($key, 'search') !== false || $key === ':status') {
                $countStmt->bindValue($key, $value);
            }
        }

        $countStmt->execute();
        $total = $countStmt->fetchColumn();

        echo json_encode([
            'success' => true,
            'data' => $empresas,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $limit,
                'total' => (int)$total,
                'total_pages' => ceil($total / $limit)
            ]
        ]);

    } else if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['id'])) {
            echo json_encode(['success' => false, 'error' => 'ID da empresa não fornecido']);
            exit;
        }

        // Construir a query de atualização dinamicamente - INCLUINDO CONSULTANT_SECONDARY
        $updateFields = [];
        $params = [':id' => $data['id']];

        $allowedFields = [
            'name', 'cnpj', 'segment', 'sector', 'address', 'state_id',
            'city_id', 'region', 'phone', 'whatsapp', 'email',
            'responsible', 'consultant', 'consultant_secondary', 'rating', 'status'
        ];

        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $updateFields[] = "$field = :$field";
                $params[":$field"] = $data[$field];
            }
        }

        if (empty($updateFields)) {
            echo json_encode(['success' => false, 'error' => 'Nenhum campo para atualizar']);
            exit;
        }

        $sql = "UPDATE empresas SET " . implode(', ', $updateFields) . ", updated_at = NOW() WHERE id = :id";

        $stmt = $conn->prepare($sql);

        foreach ($params as $key => $value) {
            if ($key === ':consultant_secondary' && empty($value)) {
                $stmt->bindValue($key, null, PDO::PARAM_NULL);
            } else {
                $stmt->bindValue($key, $value);
            }
        }

        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Empresa atualizada com sucesso']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Erro ao atualizar empresa']);
        }

    } else if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['id'])) {
            echo json_encode(['success' => false, 'error' => 'ID da empresa não fornecido']);
            exit;
        }

        // Verificar se estamos apenas atualizando o status
        if (isset($data['status']) && $data['status'] === 'INATIVA') {
            $sql = "UPDATE empresas SET status = :status, updated_at = NOW() WHERE id = :id";

            $stmt = $conn->prepare($sql);
            $stmt->bindValue(':status', $data['status']);
            $stmt->bindValue(':id', $data['id'], PDO::PARAM_INT);

            if ($stmt->execute()) {
                echo json_encode(['success' => true, 'message' => 'Status da empresa atualizado com sucesso']);
            } else {
                echo json_encode(['success' => false, 'error' => 'Erro ao atualizar status da empresa']);
            }
        } else {
            echo json_encode(['success' => false, 'error' => 'Dados inválidos para atualização parcial']);
        }
    } else {
        echo json_encode(['success' => false, 'error' => 'Método não permitido: ' . $_SERVER['REQUEST_METHOD']]);
    }

} catch (Exception $e) {
    error_log("Erro na API empresas: " . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Erro interno do servidor: ' . $e->getMessage()]);
}
?>
