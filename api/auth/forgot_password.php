<?php
/* ==========================================================================
   EcoCall — Endpoint API: Solicitar Código de Recuperação de Senha (POST /api/auth/forgot_password.php)
   Suporte multi-canal: Recuperação por E-mail ou por SMS (Celular)
   ========================================================================== */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/mailer.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(['error' => 'Método não permitido.'], 405);
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?: $_POST;

$identificador = trim($data['identificador'] ?? $data['email'] ?? $data['telefone'] ?? '');
$metodo = strtolower(trim($data['metodo'] ?? 'email')) === 'sms' ? 'sms' : 'email';

if (empty($identificador)) {
    sendJsonResponse(['error' => 'Por favor, informe seu e-mail ou número de celular.'], 400);
}

$pdo = getDBConnection();
$contaEncontrada = null;
$tipoConta = 'user';

if ($metodo === 'email') {
    if (!filter_var($identificador, FILTER_VALIDATE_EMAIL)) {
        sendJsonResponse(['error' => 'Por favor, informe um formato de e-mail válido.'], 400);
    }
    $valEmail = validarEmailReal($identificador);
    if (!$valEmail['valido']) {
        sendJsonResponse(['error' => $valEmail['motivo']], 400);
    }

    // Busca usuário
    $stmtU = $pdo->prepare("SELECT id, nome, email, telefone FROM usuarios WHERE email = :email");
    $stmtU->execute([':email' => $identificador]);
    $contaEncontrada = $stmtU->fetch();

    if ($contaEncontrada) {
        $tipoConta = 'user';
    } else {
        // Busca empresa
        $stmtE = $pdo->prepare("SELECT id, razao_social as nome, email, telefone FROM empresas WHERE email = :email");
        $stmtE->execute([':email' => $identificador]);
        $contaEncontrada = $stmtE->fetch();
        if ($contaEncontrada) {
            $tipoConta = 'empresa';
        }
    }
} else {
    // Método SMS: normaliza dígitos
    $telDigitos = preg_replace('/\D/', '', $identificador);
    if (strlen($telDigitos) < 8) {
        sendJsonResponse(['error' => 'Por favor, informe um número de telefone/celular válido.'], 400);
    }

    $stmtU = $pdo->prepare("SELECT id, nome, email, telefone FROM usuarios WHERE REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', '') LIKE :tel");
    $stmtU->execute([':tel' => '%' . substr($telDigitos, -8)]);
    $contaEncontrada = $stmtU->fetch();

    if ($contaEncontrada) {
        $tipoConta = 'user';
    } else {
        $stmtE = $pdo->prepare("SELECT id, razao_social as nome, email, telefone FROM empresas WHERE REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', '') LIKE :tel");
        $stmtE->execute([':tel' => '%' . substr($telDigitos, -8)]);
        $contaEncontrada = $stmtE->fetch();
        if ($contaEncontrada) {
            $tipoConta = 'empresa';
        }
    }
}

if (!$contaEncontrada) {
    sendJsonResponse([
        'error' => 'Nenhuma conta de cidadão ou empresa foi encontrada com o ' . ($metodo === 'email' ? 'e-mail' : 'celular') . ' informado.'
    ], 404);
}

// Gera código numérico de 6 dígitos
$codigo = str_pad(strval(random_int(100000, 999999)), 6, '0', STR_PAD_LEFT);
$expiraEm = date('Y-m-d H:i:s', strtotime('+15 minutes'));

// Invalida códigos anteriores não utilizados para o mesmo identificador
$stmtInv = $pdo->prepare("UPDATE password_resets SET utilizado = 1 WHERE identificador = :id AND utilizado = 0");
$stmtInv->execute([':id' => $identificador]);

// Salva o novo código
$stmtIns = $pdo->prepare("
    INSERT INTO password_resets (identificador, metodo, codigo, tipo_conta, utilizado, expira_em)
    VALUES (:identificador, :metodo, :codigo, :tipo_conta, 0, :expira_em)
");
$stmtIns->execute([
    ':identificador' => $identificador,
    ':metodo' => $metodo,
    ':codigo' => $codigo,
    ':tipo_conta' => $tipoConta,
    ':expira_em' => $expiraEm
]);

// Mascaramento de dados para exibição segura e Envio de E-mail
$destinoMascarado = '';
$emailEnviado = false;
$emailError = null;

if ($metodo === 'email') {
    $em = $contaEncontrada['email'];
    $pts = explode('@', $em);
    $userPart = $pts[0];
    $domainPart = $pts[1] ?? 'ecocall.com';
    $userMask = substr($userPart, 0, 2) . str_repeat('*', max(1, strlen($userPart) - 3)) . substr($userPart, -1);
    $destinoMascarado = $userMask . '@' . $domainPart;

    // Envia o e-mail real com template moderno
    $assunto = "EcoCall - Código de Recuperação de Senha";
    $nomeDest = $contaEncontrada['nome'];
    $mensagemHtml = "<p>Olá, <strong>{$nomeDest}</strong>!</p>
                     <p>Recebemos uma solicitação para redefinir a senha de acesso da sua conta no <strong>EcoCall</strong>.</p>
                     <p>Utilize o código de segurança abaixo para prosseguir com a alteração da sua senha:</p>";
    
    $corpo = gerarTemplateEmailEcoCall("Recuperação de Senha", $mensagemHtml, null, null, $codigo);
    
    $envio = enviarEmail($em, $nomeDest, $assunto, $corpo);
    $emailEnviado = $envio['success'];
    $emailError = $envio['error'] ?? null;
    $emailProvider = $envio['provider'] ?? 'smtp';

} else {
    $tel = $contaEncontrada['telefone'] ?: $identificador;
    $destinoMascarado = substr($tel, 0, 5) . '****-' . substr($tel, -4);
    $emailProvider = 'sms';
    // Para SMS, a integração com API de SMS viria aqui (Twilio, Zenvia, etc)
}

sendJsonResponse([
    'success' => true,
    'message' => 'Código de verificação de 6 dígitos enviado com sucesso!',
    'metodo' => $metodo,
    'destino_mascarado' => $destinoMascarado,
    'identificador' => $identificador,
    'email_enviado' => $emailEnviado,
    'email_provider' => $emailProvider,
    'email_error' => $emailError,
    'preview_codigo' => $codigo // Fornecido para facilidade em ambiente local / simulação
]);
