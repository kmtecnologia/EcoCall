<?php
/* ==========================================================================
   EcoCall — Endpoint API: Listar Empresas Parceiras (GET /api/empresas/index.php)
   ========================================================================== */

require_once __DIR__ . '/../config/db.php';

$pdo = getDBConnection();

// Executa o auto-seeding das empresas parceiras padrão somente se a tabela estiver vazia
$checkStmt = $pdo->query("SELECT COUNT(*) FROM empresas");
$totalEmpresas = intval($checkStmt->fetchColumn());

if ($totalEmpresas === 0) {
    $senhaHash = password_hash('123456', PASSWORD_DEFAULT);
    $realCompanies = [
        [
            'razao_social' => 'Terra Santos Ambiental (Consórcio Público)',
            'cnpj' => '45.678.901/0001-10',
            'email' => 'contato@terrasantos.com.br',
            'telefone' => '(13) 3200-8000',
            'cep' => '11015-002',
            'logradouro' => 'Av. Siqueira Campos',
            'numero' => '120',
            'bairro' => 'Macuco',
            'cidade' => 'Santos',
            'uf' => 'SP',
            'categoria' => 'Coleta Seletiva Pública & Cata-Treco',
            'descricao' => 'Consórcio responsável pela Coleta Seletiva oficial e serviço de Cata-Treco nos 27 bairros de Santos-SP.',
            'nota_media' => 4.90
        ],
        [
            'razao_social' => 'ONG Sem Fronteiras (Cooperativa)',
            'cnpj' => '12.345.678/0001-99',
            'email' => 'semfronteiras@reciclagem.org.br',
            'telefone' => '(13) 97402-2123',
            'cep' => '11013-001',
            'logradouro' => 'Rua da Constituição',
            'numero' => '75',
            'bairro' => 'Paquetá',
            'cidade' => 'Santos',
            'uf' => 'SP',
            'categoria' => 'Cooperativa de Recicladores',
            'descricao' => 'Cooperativa cadastrada na Prefeitura de Santos (Semam) para recolhimento e triagem em condomínios.',
            'nota_media' => 4.85
        ],
        [
            'razao_social' => 'Comares (Cooperativa de Materiais Recicláveis)',
            'cnpj' => '98.765.432/0001-11',
            'email' => 'comares.santos@gmail.com',
            'telefone' => '(13) 99137-0383',
            'cep' => '11095-000',
            'logradouro' => 'Av. Ver. Alfredo das Neves',
            'numero' => '450',
            'bairro' => 'Alemoa',
            'cidade' => 'Santos',
            'uf' => 'SP',
            'categoria' => 'Cooperativa Industrial & Residencial',
            'descricao' => 'Centro de triagem e destinação final ambiental na Zona Industrial do Porto de Santos-SP.',
            'nota_media' => 4.80
        ],
        [
            'razao_social' => 'Alquimista Reciclagem',
            'cnpj' => '33.444.555/0001-22',
            'email' => 'contato@alquimistareciclagem.com.br',
            'telefone' => '(13) 97418-9272',
            'cep' => '11015-000',
            'logradouro' => 'Av. Siqueira Campos',
            'numero' => '61',
            'bairro' => 'Macuco',
            'cidade' => 'Santos',
            'uf' => 'SP',
            'categoria' => 'Gerenciamento de Resíduos Privados',
            'descricao' => 'Gestão de resíduos para grandes geradores comerciais, escritórios e condomínios na Baixada Santista.',
            'nota_media' => 4.95
        ],
        [
            'razao_social' => 'Recimar Reciclagem & Sucata',
            'cnpj' => '55.666.777/0001-33',
            'email' => 'atendimento@recimarreciclagem.com.br',
            'telefone' => '(13) 3221-5600',
            'cep' => '11015-201',
            'logradouro' => 'Av. Senador Dantas',
            'numero' => '259',
            'bairro' => 'Estuário',
            'cidade' => 'Santos',
            'uf' => 'SP',
            'categoria' => 'Reciclagem Industrial & Metais',
            'descricao' => 'Empresa especializada em compra, reciclagem e processamento de sucatas ferrosas, cobre e alumínio.',
            'nota_media' => 4.75
        ],
        [
            'razao_social' => 'Fundação Settaport (Lixo Eletrônico REEE)',
            'cnpj' => '77.888.999/0001-44',
            'email' => 'lixoeletronico@settaport.com.br',
            'telefone' => '(13) 3221-2546',
            'cep' => '11013-010',
            'logradouro' => 'Av. Conselheiro Nébias',
            'numero' => '85',
            'bairro' => 'Paquetá',
            'cidade' => 'Santos',
            'uf' => 'SP',
            'categoria' => 'Resíduos Eletrônicos (REEE)',
            'descricao' => 'Ponto de recolhimento ecológico de computadores, monitores, celulares e eletrônicos pós-consumo.',
            'nota_media' => 4.90
        ],
        [
            'razao_social' => 'Reciclar é Viver (Cooperativa Comunidade)',
            'cnpj' => '88.999.000/0001-55',
            'email' => 'contato@reciclareviver.org.br',
            'telefone' => '(13) 98804-4683',
            'cep' => '11015-100',
            'logradouro' => 'Rua Carvalho de Mendonça',
            'numero' => '310',
            'bairro' => 'Vila Mathias',
            'cidade' => 'Santos',
            'uf' => 'SP',
            'categoria' => 'Óleo de Cozinha & Plásticos',
            'descricao' => 'Recolhimento comunitário de óleo de cozinha usado, garrafas PET e plástico filme na Baixada.',
            'nota_media' => 4.85
        ],
        [
            'razao_social' => 'Santista Ambiental',
            'cnpj' => '11.222.333/0001-66',
            'email' => 'comercial@santistaambiental.com.br',
            'telefone' => '(13) 3200-0000',
            'cep' => '11060-001',
            'logradouro' => 'Av. Ana Costa',
            'numero' => '150',
            'bairro' => 'Gonzaga',
            'cidade' => 'Santos',
            'uf' => 'SP',
            'categoria' => 'Caçambas & Coleta Especial',
            'descricao' => 'Serviços de transporte, caçambas estacionárias e destinação legalizada para empresas e condomínios.',
            'nota_media' => 4.70
        ]
    ];

    $insStmt = $pdo->prepare("
        INSERT IGNORE INTO empresas (razao_social, cnpj, email, senha, telefone, cep, logradouro, numero, bairro, cidade, uf, endereco, categoria, descricao, nota_media)
        VALUES (:razao_social, :cnpj, :email, :senha, :telefone, :cep, :logradouro, :numero, :bairro, :cidade, :uf, :endereco, :categoria, :descricao, :nota_media)
    ");

    foreach ($realCompanies as $c) {
        $insStmt->execute([
            ':razao_social' => $c['razao_social'],
            ':cnpj' => $c['cnpj'],
            ':email' => $c['email'],
            ':senha' => $senhaHash,
            ':telefone' => $c['telefone'],
            ':cep' => $c['cep'],
            ':logradouro' => $c['logradouro'],
            ':numero' => $c['numero'],
            ':bairro' => $c['bairro'],
            ':cidade' => $c['cidade'],
            ':uf' => $c['uf'],
            ':endereco' => $c['logradouro'] . ', ' . $c['numero'] . ' - ' . $c['bairro'] . ', ' . $c['cidade'] . ' - ' . $c['uf'],
            ':categoria' => $c['categoria'],
            ':descricao' => $c['descricao'],
            ':nota_media' => $c['nota_media']
        ]);
    }
}

$stmt = $pdo->query("
    SELECT id, razao_social, cnpj, email, telefone, cep, logradouro, numero, bairro, cidade, uf, endereco, categoria, descricao, nota_media, coletas_concluidas, created_at
    FROM empresas
    ORDER BY nota_media DESC, razao_social ASC
");

$empresas = $stmt->fetchAll();

sendJsonResponse([
    'success' => true,
    'total' => count($empresas),
    'empresas' => $empresas
]);
