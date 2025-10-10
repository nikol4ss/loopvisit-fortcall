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

try {
    $whereClause = "WHERE active = 1";
    $params = [];

    // Filtro por role se fornecido
    if (isset($_GET['role'])) {
        $whereClause .= " AND role = ?";
        $params[] = $_GET['role'];
    }

    $query = "SELECT id, name, email, role FROM usuarios $whereClause ORDER BY name";
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $usuarios = $stmt->fetchAll();

    // Converter para maiúsculo
    foreach ($usuarios as &$usuario) {
        foreach ($usuario as $key => &$value) {
            if (is_string($value) && $key !== 'email') {
                $value = strtoupper($value);
            }
        }
    }

    echo json_encode(['success' => true, 'data' => $usuarios]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'ERRO AO BUSCAR USUÁRIOS: ' . $e->getMessage()]);
}
?>
