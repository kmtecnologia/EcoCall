<?php
/* ==========================================================================
   EcoCall — Endpoint API: Redefinir Senha (POST /api/auth/reset_password.php)
   Valida o código de 6 dígitos recebido por E-mail ou SMS e atualiza a senha
   ========================================================================== */

require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(['error' => 'Método não permitido.'], 405);
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?: $_POST;

$identificador = trim($data['identificador'] ?? $data['email'] ?? $data['telefone'] ?? '');
$codigo = trim($data['codigo'] ?? '');
$novaSenha = trim($data['nova_senha'] ?? $data['senha'] ?? '');

if (empty($identificador) || empty($codigo) || empty($novaSenha)) {
    sendJsonResponse(['error' => 'Informe o identificador (e-mail/celular), o código de 6 dígitos e a nova senha.'], 400);
}

if (strlen($novaSenha) < 6) {
    sendJsonResponse(['error' => 'A nova senha deve possuir no mínimo 6 caracteres.'], 400);
}

$pdo = getDBConnection();

// Busca o código no histórico
$stmtCheck = $pdo->prepare("
    SELECT id, identificador, tipo_conta, expira_em, utilizado 
    FROM password_resets 
    WHERE identificador = :id AND codigo = :cod 
    ORDER BY id DESC LIMIT 1
");
$stmtCheck->execute([':id' => $identificador, ':cod' => $codigo]);
$resetRecord = $stmtCheck->fetch();

if (!$resetRecord) {
    sendJsonResponse(['error' => 'Código de verificação incorreto ou inválido.'], 400);
}

if ($resetRecord['utilizado'] == 1) {
    sendJsonResponse(['error' => 'Este código de verificação já foi utilizado anteriormente.'], 400);
}

if (strtotime($resetRecord['expira_em']) < time()) {
    sendJsonResponse(['error' => 'Este código expirou (validade de 15 minutos). Solicite um novo código.'], 400);
}

$hashNovaSenha = password_hash($novaSenha, PASSWORD_DEFAULT);

// Atualiza na tabela correspondente
$tipoConta = $resetRecord['tipo_conta'] ?? 'user';
$atualizado = false;

if ($tipoConta === 'empresa') {
    $stmtUpd = $pdo->prepare("UPDATE empresas SET senha = :senha WHERE email = :id OR telefone LIKE :tel");
    $telLike = '%' . substr(preg_replace('/\D/', '', $identificador), -8);
    $stmtUpd->execute([':senha' => $hashNovaSenha, ':id' => $identificador, ':tel' => $telLike]);
    $atualizado = true;
} else {
    $stmtUpd = $pdo->prepare("UPDATE usuarios SET senha = :senha WHERE email = :id OR telefone LIKE :tel");
    $telLike = '%' . substr(preg_replace('/\D/', '', $identificador), -8);
    $stmtUpd->execute([':senha' => $hashNovaSenha, ':id' => $identificador, ':tel' => $telLike]);
    $atualizado = true;
}

// Marca o código como utilizado
$stmtDone = $pdo->prepare("UPDATE password_resets SET utilizado = 1 WHERE id = :id");
$stmtDone->execute([':id' => $resetRecord['id']]);

sendJsonResponse([
    'success' => true,
    'message' => 'Sua senha foi redefinida com sucesso! Você já pode entrar com suas novas credenciais.',
    'redirect' => 'ecocall-login.html'
]);
