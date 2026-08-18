<?php
/* ==========================================================================
   EcoCall — Endpoint API: Redefinir Senha (POST /api/auth/reset_password.php)
   Valida o código de 6 dígitos recebido por E-mail ou SMS e atualiza a senha de forma infalível
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

$cleanTel = preg_replace('/\D/', '', $identificador);
if (strlen($cleanTel) >= 12 && substr($cleanTel, 0, 2) === '55') {
    $cleanTel = substr($cleanTel, 2);
}
$suffix8 = strlen($cleanTel) >= 8 ? substr($cleanTel, -8) : $cleanTel;

// 1. Busca o código no histórico de password_resets
$stmtCheck = $pdo->prepare("
    SELECT id, conta_id, identificador, tipo_conta, expira_em, utilizado 
    FROM password_resets 
    WHERE codigo = :cod 
      AND (
          identificador = :id 
          OR identificador = :clean
          OR identificador LIKE :suffixLike
          OR conta_id IN (
              SELECT id FROM usuarios WHERE email = :id OR REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', '') LIKE :suffixLike
              UNION
              SELECT id FROM empresas WHERE email = :id OR REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', '') LIKE :suffixLike
          )
      )
    ORDER BY id DESC LIMIT 1
");

$stmtCheck->execute([
    ':cod'        => $codigo,
    ':id'         => $identificador,
    ':clean'      => $cleanTel,
    ':suffixLike' => '%' . $suffix8
]);
$resetRecord = $stmtCheck->fetch();

if (!$resetRecord) {
    // Fallback: busca apenas pelo código ativo mais recente não utilizado
    $stmtFallback = $pdo->prepare("
        SELECT id, conta_id, identificador, tipo_conta, expira_em, utilizado 
        FROM password_resets 
        WHERE codigo = :cod 
        ORDER BY id DESC LIMIT 1
    ");
    $stmtFallback->execute([':cod' => $codigo]);
    $resetRecord = $stmtFallback->fetch();
}

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
$tipoConta = $resetRecord['tipo_conta'] ?? 'user';
$contaId = !empty($resetRecord['conta_id']) ? (int)$resetRecord['conta_id'] : null;

// 2. Atualiza a senha na tabela correspondente (por ID da conta ou busca resiliente)
if ($tipoConta === 'empresa') {
    if ($contaId) {
        $stmtUpd = $pdo->prepare("UPDATE empresas SET senha = :senha WHERE id = :cid");
        $stmtUpd->execute([':senha' => $hashNovaSenha, ':cid' => $contaId]);
    } else {
        $stmtUpd = $pdo->prepare("
            UPDATE empresas 
            SET senha = :senha 
            WHERE email = :id 
               OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', ''), '.', '') LIKE :suffix
               OR telefone = :rawId
        ");
        $stmtUpd->execute([
            ':senha' => $hashNovaSenha,
            ':id'    => $identificador,
            ':suffix'=> '%' . $suffix8,
            ':rawId' => $identificador
        ]);
    }
} else {
    // Usuário cidadão
    if ($contaId) {
        $stmtUpd = $pdo->prepare("UPDATE usuarios SET senha = :senha WHERE id = :cid");
        $stmtUpd->execute([':senha' => $hashNovaSenha, ':cid' => $contaId]);
    } else {
        $stmtUpd = $pdo->prepare("
            UPDATE usuarios 
            SET senha = :senha 
            WHERE email = :id 
               OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', ''), '.', '') LIKE :suffix
               OR telefone = :rawId
        ");
        $stmtUpd->execute([
            ':senha' => $hashNovaSenha,
            ':id'    => $identificador,
            ':suffix'=> '%' . $suffix8,
            ':rawId' => $identificador
        ]);
    }
}

// 3. Marca o código como utilizado
$stmtDone = $pdo->prepare("UPDATE password_resets SET utilizado = 1 WHERE id = :id");
$stmtDone->execute([':id' => $resetRecord['id']]);

sendJsonResponse([
    'success' => true,
    'message' => 'Sua senha foi redefinida com sucesso! Você já pode entrar com suas novas credenciais.',
    'redirect' => 'ecocall-login.html'
]);
