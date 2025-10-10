<?php
require_once __DIR__ . '/env.php';

class JWT {
    private static function getSecret() {
        // Primeiro tenta pegar do .env
        if (isset($_ENV['JWT_SECRET']) && !empty($_ENV['JWT_SECRET'])) {
            return $_ENV['JWT_SECRET'];
        }
        
        // Verifica se existe um arquivo de chave local
        $keyFile = __DIR__ . '/jwt_key.txt';
        if (file_exists($keyFile)) {
            return trim(file_get_contents($keyFile));
        }
        
        // Se não existir, cria uma chave única para este sistema
        $newKey = bin2hex(random_bytes(32));
        file_put_contents($keyFile, $newKey);
        
        return $newKey;
    }

    public static function encode($payload) {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode($payload);
        
        $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $base64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
        
        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, self::getSecret(), true);
        $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
        
        return $base64Header . "." . $base64Payload . "." . $base64Signature;
    }

    public static function decode($jwt) {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            return false;
        }

        $header = base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[0]));
        $payload = base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1]));
        $signature = base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[2]));

        $expectedSignature = hash_hmac('sha256', $parts[0] . "." . $parts[1], self::getSecret(), true);

        if (!hash_equals($signature, $expectedSignature)) {
            return false;
        }

        $payloadData = json_decode($payload, true);
        if (isset($payloadData['exp']) && $payloadData['exp'] < time()) {
            return false;
        }

        return $payloadData;
    }

    public static function getCurrentUser() {
        $headers = getallheaders();
        if (!$headers) {
            $headers = [];
            foreach ($_SERVER as $key => $value) {
                if (strpos($key, 'HTTP_') === 0) {
                    $header = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))));
                    $headers[$header] = $value;
                }
            }
        }
        
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        
        if (strpos($authHeader, 'Bearer ') === 0) {
            $token = substr($authHeader, 7);
            return self::decode($token);
        }
        
        return false;
    }
}
?>
