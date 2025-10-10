<?php
header('Content-Type: application/json; charset=utf-8');
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

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

try {
    // Verificar se foi solicitado um estado específico para buscar cidades
    if (isset($_GET['estado_id']) && !empty($_GET['estado_id'])) {
        // Listar cidades (com filtro por estado)
        $estadoId = $_GET['estado_id'];
        
        $query = "SELECT c.id_cidade as id, c.nome, c.id_estado, e.nome as estado_nome, e.sigla as estado_sigla 
                  FROM cidades c 
                  LEFT JOIN estados e ON c.id_estado = e.id_estado
                  WHERE c.id_estado = ?
                  ORDER BY c.nome";
        
        $stmt = $db->prepare($query);
        $stmt->execute([$estadoId]);
        $cidades = $stmt->fetchAll();

        // Converter para maiúsculo
        foreach ($cidades as &$cidade) {
            foreach ($cidade as $key => &$value) {
                if (is_string($value)) {
                    $value = strtoupper($value);
                }
            }
        }

        echo json_encode(['success' => true, 'data' => $cidades]);

    } else {
        // Listar estados (quando não há parâmetro estado_id)
        $query = "SELECT id_estado as id, nome, sigla FROM estados ORDER BY nome";
        $stmt = $db->prepare($query);
        $stmt->execute();
        $estados = $stmt->fetchAll();

        // Converter para maiúsculo
        foreach ($estados as &$estado) {
            $estado['nome'] = strtoupper($estado['nome']);
            $estado['sigla'] = strtoupper($estado['sigla']);
        }

        echo json_encode(['success' => true, 'data' => $estados]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'ERRO AO BUSCAR DADOS: ' . $e->getMessage()]);
}
?>
