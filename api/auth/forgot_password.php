<?php
/* ==========================================================================
   EcoCall — Endpoint API: Solicitar Código de Recuperação de Senha (POST /api/auth/forgot_password.php)
   Canais Oficiais: Recuperação via E-mail ou via WhatsApp Direto
   ========================================================================== */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/mailer.php';
require_once __DIR__ . '/../config/sms.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(['error' => 'Método não permitido.'], 405);
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?: $_POST;

$identificador = trim($data['identificador'] ?? $data['email'] ?? $data['telefone'] ?? '');
$rawMetodo = strtolower(trim($data['metodo'] ?? 'email'));
$metodo = ($rawMetodo === 'whatsapp' || $rawMetodo === 'sms' || $rawMetodo === 'celular') ? 'whatsapp' : 'email';

if (empty($identificador)) {
    sendJsonResponse(['error' => 'Por favor, informe seu e-mail ou número de WhatsApp com DDD.'], 400);
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

    // Busca usuário cidadão por e-mail
    $stmtU = $pdo->prepare("SELECT id, nome, email, telefone FROM usuarios WHERE email = :email");
    $stmtU->execute([':email' => $identificador]);
    $contaEncontrada = $stmtU->fetch();

    if ($contaEncontrada) {
        $tipoConta = 'user';
    } else {
        // Busca empresa por e-mail
        $stmtE = $pdo->prepare("SELECT id, razao_social as nome, email, telefone FROM empresas WHERE email = :email");
        $stmtE->execute([':email' => $identificador]);
        $contaEncontrada = $stmtE->fetch();
        if ($contaEncontrada) {
            $tipoConta = 'empresa';
        }
    }
} else {
    // Método WhatsApp: normaliza dígitos numéricos
    $cleanTel = preg_replace('/\D/', '', $identificador);
    if (strlen($cleanTel) < 8) {
        sendJsonResponse(['error' => 'Por favor, informe um número de WhatsApp válido com DDD.'], 400);
    }

    // Remove prefixo de DDI 55 (Brasil) se houver
    if (strlen($cleanTel) >= 12 && substr($cleanTel, 0, 2) === '55') {
        $cleanTel = substr($cleanTel, 2);
    }

    $suffix8 = substr($cleanTel, -8);
    $suffix9 = (strlen($cleanTel) >= 9) ? substr($cleanTel, -9) : $suffix8;
    $cleanExact = $cleanTel;

    // Busca usuário com query resiliente a pontuação/formatação
    $sqlSearch = "
        SELECT id, nome, email, telefone 
        FROM usuarios 
        WHERE (
            REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', ''), '+', ''), '.', '') = :cleanExact
            OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', ''), '+', ''), '.', '') LIKE :suffix9
            OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', ''), '+', ''), '.', '') LIKE :suffix8
            OR telefone = :rawTel
            OR telefone LIKE :likeRaw
        )
        ORDER BY id DESC LIMIT 1
    ";

    $params = [
        ':cleanExact' => $cleanExact,
        ':suffix9'    => '%' . $suffix9,
        ':suffix8'    => '%' . $suffix8,
        ':rawTel'     => $identificador,
        ':likeRaw'    => '%' . $suffix8 . '%'
    ];

    $stmtU = $pdo->prepare($sqlSearch);
    $stmtU->execute($params);
    $contaEncontrada = $stmtU->fetch();

    if ($contaEncontrada) {
        $tipoConta = 'user';
    } else {
        // Busca em empresas
        $sqlSearchEmp = "
            SELECT id, razao_social as nome, email, telefone 
            FROM empresas 
            WHERE (
                REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', ''), '+', ''), '.', '') = :cleanExact
                OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', ''), '+', ''), '.', '') LIKE :suffix9
                OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', ''), '+', ''), '.', '') LIKE :suffix8
                OR telefone = :rawTel
                OR telefone LIKE :likeRaw
            )
            ORDER BY id DESC LIMIT 1
        ";
        $stmtE = $pdo->prepare($sqlSearchEmp);
        $stmtE->execute($params);
        $contaEncontrada = $stmtE->fetch();
        if ($contaEncontrada) {
            $tipoConta = 'empresa';
        }
    }
}

if (!$contaEncontrada) {
    sendJsonResponse([
        'error' => 'Nenhuma conta de cidadão ou empresa foi encontrada com o ' . ($metodo === 'email' ? 'e-mail' : 'número de WhatsApp') . ' informado.'
    ], 404);
}

$contaId = (int)$contaEncontrada['id'];
$contaNome = $contaEncontrada['nome'];
$contaEmail = $contaEncontrada['email'];
$contaTelefone = $contaEncontrada['telefone'] ?: $identificador;

// Gera código numérico seguro de 6 dígitos
$codigo = str_pad(strval(random_int(100000, 999999)), 6, '0', STR_PAD_LEFT);
$expiraEm = date('Y-m-d H:i:s', strtotime('+15 minutes'));

// Invalida códigos anteriores pendentes para a mesma conta ou identificador
$stmtInv = $pdo->prepare("
    UPDATE password_resets 
    SET utilizado = 1 
    WHERE (conta_id = :cid AND tipo_conta = :tipo)
       OR identificador = :id1 
       OR identificador = :id2
       OR identificador = :id3
");
$stmtInv->execute([
    ':cid' => $contaId,
    ':tipo' => $tipoConta,
    ':id1' => $identificador,
    ':id2' => $contaEmail,
    ':id3' => $contaTelefone
]);

// Salva o novo código com vínculo seguro do ID da conta
$stmtIns = $pdo->prepare("
    INSERT INTO password_resets (conta_id, identificador, metodo, codigo, tipo_conta, utilizado, expira_em)
    VALUES (:conta_id, :identificador, :metodo, :codigo, :tipo_conta, 0, :expira_em)
");
$stmtIns->execute([
    ':conta_id'     => $contaId,
    ':identificador'=> $identificador,
    ':metodo'       => $metodo,
    ':codigo'       => $codigo,
    ':tipo_conta'   => $tipoConta,
    ':expira_em'    => $expiraEm
]);

// Formatação e Mascaramento para exibição segura
$destinoMascarado = '';
$emailEnviado = false;
$emailError = null;
$emailProvider = 'smtp';
$emailNotificadoMascarado = '';
$whatsappLink = null;

// Mascara e-mail cadastrado
if (!empty($contaEmail)) {
    $emParts = explode('@', $contaEmail);
    $userPart = $emParts[0];
    $domainPart = $emParts[1] ?? 'ecocall.com';
    $userMask = substr($userPart, 0, 2) . str_repeat('*', max(1, strlen($userPart) - 3)) . substr($userPart, -1);
    $emailNotificadoMascarado = $userMask . '@' . $domainPart;
}

if ($metodo === 'email') {
    $destinoMascarado = $emailNotificadoMascarado;

    // Envia o e-mail real com template moderno
    $assunto = "EcoCall - Código de Recuperação de Senha";
    $mensagemHtml = "<p>Olá, <strong>{$contaNome}</strong>!</p>
                     <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>EcoCall</strong>.</p>
                     <p>Utilize o código de segurança abaixo para prosseguir com a alteração da sua senha:</p>";
    
    $corpo = gerarTemplateEmailEcoCall("Recuperação de Senha", $mensagemHtml, null, null, $codigo);
    $envio = enviarEmail($contaEmail, $contaNome, $assunto, $corpo);
    
    $emailEnviado = $envio['success'];
    $emailError = $envio['error'] ?? null;
    $emailProvider = $envio['provider'] ?? 'smtp';

} else {
    // Mascara número de telefone: ex: (13) 9****-5432
    $telDigits = preg_replace('/\D/', '', $contaTelefone);
    if (strlen($telDigits) >= 10) {
        $ddd = substr($telDigits, 0, 2);
        $firstDigit = (strlen($telDigits) === 11) ? substr($telDigits, 2, 1) : '';
        $last4 = substr($telDigits, -4);
        $destinoMascarado = "({$ddd}) {$firstDigit}****-{$last4}";
    } else {
        $destinoMascarado = substr($contaTelefone, 0, 4) . '****' . substr($contaTelefone, -3);
    }

    // DISPARO WHATSAPP:
    $envioMsg = enviarSMS($contaTelefone, $codigo, $contaNome);
    $whatsappLink = $envioMsg['whatsapp_link'] ?? null;

    // DISPARO MULTI-CANAL SEGURO:
    // Envia também uma cópia imediata para o e-mail cadastrado da conta como garantia
    $assunto = "EcoCall - Código de Recuperação de Senha (WhatsApp)";
    $mensagemHtml = "<p>Olá, <strong>{$contaNome}</strong>!</p>
                     <p>Recebemos uma solicitação de recuperação de senha para a sua conta associada ao WhatsApp <strong>{$destinoMascarado}</strong>.</p>
                     <p>Para sua conveniência e segurança, enviamos o código de verificação de 6 dígitos:</p>";

    $corpo = gerarTemplateEmailEcoCall("Código de Verificação WhatsApp", $mensagemHtml, null, null, $codigo);
    $envio = enviarEmail($contaEmail, $contaNome, $assunto, $corpo);

    $emailEnviado = $envio['success'];
    $emailError = $envio['error'] ?? null;
    $emailProvider = $envio['provider'] ?? 'smtp';
}

sendJsonResponse([
    'success' => true,
    'message' => 'Código de verificação de 6 dígitos gerado com sucesso!',
    'metodo' => $metodo,
    'destino_mascarado' => $destinoMascarado,
    'email_backup_mascarado' => $emailNotificadoMascarado,
    'identificador' => $identificador,
    'email_enviado' => $emailEnviado,
    'email_provider' => $emailProvider,
    'email_error' => $emailError,
    'whatsapp_link' => $whatsappLink,
    'preview_codigo' => $codigo // Fornecido para teste em ambiente local / simulação
]);
