<?php
// Carregador de variáveis de ambiente
class Env {
    public static function load($path = '.env') {
        if (!file_exists($path)) {
            throw new Exception("Arquivo .env não encontrado");
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0) {
                continue; // Pular comentários
            }

            list($name, $value) = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value);

            if (!array_key_exists($name, $_ENV)) {
                $_ENV[$name] = $value;
            }
        }
    }
}


    // Local
    $_ENV['DB_HOST'] = $_ENV['DB_HOST'] ?? '127.0.0.1';
    $_ENV['DB_NAME'] = $_ENV['DB_NAME'] ?? 'LPV';
    $_ENV['DB_USER'] = $_ENV['DB_USER'] ?? 'root';
    $_ENV['DB_PASS'] = $_ENV['DB_PASS'] ?? '2004';
    $_ENV['JWT_SECRET'] = $_ENV['JWT_SECRET'] ?? 'chave_secreta_sistema_visitas_2024_muito_forte';

// Produção
// $_ENV['DB_HOST'] = $_ENV['DB_HOST'] ?? '50.116.87.50';
// $_ENV['DB_NAME'] = $_ENV['DB_NAME'] ?? 'v4comp90_sistema_visitas';
// $_ENV['DB_USER'] = $_ENV['DB_USER'] ?? 'v4comp90_admin';
// $_ENV['DB_PASS'] = $_ENV['DB_PASS'] ?? 'vertrigo@';
// $_ENV['JWT_SECRET'] = $_ENV['JWT_SECRET'] ?? 'chave_secreta_sistema_visitas_2024_muito_forte';


// Carregar variáveis de ambiente
try {
    Env::load(__DIR__ . '/../.env');
} catch (Exception $e) {
    // Se não encontrar .env, usar valores padrão
    // Valores padrão já definidos acima
}
?>
