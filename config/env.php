`   <?php
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

// Configurações diretas - sem arquivo .env por enquanto
$_ENV['DB_HOST'] = 'mysql743.umbler.com';
$_ENV['DB_NAME'] = 'loopvisit';
$_ENV['DB_USER'] = 'looproot';
$_ENV['DB_PASS'] = 'vertrigo'; // Coloque sua senha aqui
$_ENV['JWT_SECRET'] = 'chave_secreta_sistema_visitas_2024_muito_forte';

// Carregar variáveis de ambiente
try {
    Env::load(__DIR__ . '/../.env');
} catch (Exception $e) {
    // Se não encontrar .env, usar valores padrão
    // Valores padrão já definidos acima
}
?>
