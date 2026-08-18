/* ==========================================================================
   EcoCall — Painel do Usuário Cidadão (Dashboard Dinâmico & SPA Unificado)
   Centraliza a lógica do Painel, Minhas Coletas, Empresas Salvas, Mapa Interativo (Leaflet),
   Histórico de Pontuações, Modal de Solicitação com ViaCEP/IBGE, Avaliações e FPDF.
   ========================================================================== */
(function () {
  'use strict';

  var currentFilter = 'all';
  var currentSort = 'date-desc';
  var empresasMateriaisMap = {};
  var cachedColetas = [];
  var cachedEmpresas = [];
  var mapInstance = null;
  var currentEvalRating = 5;

  var todosMateriais = [
    { name: 'Plástico', icon: '♻️', tagClass: 'tag-plastic' },
    { name: 'Papel', icon: '📦', tagClass: 'tag-paper' },
    { name: 'Metal', icon: '🥫', tagClass: 'tag-metal' },
    { name: 'Vidro', icon: '🍾', tagClass: 'tag-glass' },
    { name: 'Eletrônicos', icon: '💻', tagClass: 'tag-elec' },
    { name: 'Óleo de Cozinha', icon: '🛢️', tagClass: 'tag-amber' },
    { name: 'Orgânico', icon: '🍎', tagClass: 'tag-organic' },
    { name: 'Têxtil', icon: '👕', tagClass: 'tag-paper' }
  ];

  var defaultSantosCompanies = [
    { id: 1, razao_social: 'Terra Santos Ambiental (Consórcio Público)', bairro: 'Consórcio Público', cidade: 'Santos', uf: 'SP', categoria: 'Consórcio Público - Todos os bairros', nota_media: 4.9, lat: -23.9535, lng: -46.3312 },
    { id: 2, razao_social: 'ONG Sem Fronteiras (Cooperativa)', bairro: 'Paquetá', cidade: 'Santos', uf: 'SP', categoria: 'Cooperativa Reciclagem Geral', nota_media: 4.8, lat: -23.9312, lng: -46.3218 },
    { id: 3, razao_social: 'Comares (Cooperativa de Materiais Recicláveis)', bairro: 'Alemoa', cidade: 'Santos', uf: 'SP', categoria: 'Cooperativa Industrial', nota_media: 4.7, lat: -23.9245, lng: -46.3650 },
    { id: 4, razao_social: 'Alquimista Reciclagem', bairro: 'Macuco', cidade: 'Santos', uf: 'SP', categoria: 'Plásticos, Metais e Sucata', nota_media: 5.0, lat: -23.9610, lng: -46.3150 },
    { id: 5, razao_social: 'Recimar Reciclagem & Sucata', bairro: 'Estuário', cidade: 'Santos', uf: 'SP', categoria: 'Metais e Plásticos', nota_media: 4.6, lat: -23.9780, lng: -46.3020 },
    { id: 6, razao_social: 'Fundação Settaport (Lixo Eletrônico REEE)', bairro: 'Paquetá', cidade: 'Santos', uf: 'SP', categoria: 'Lixo Eletrônico REEE', nota_media: 4.9, lat: -23.9340, lng: -46.3260 },
    { id: 7, razao_social: 'Reciclar é Viver (Cooperativa Comunidade)', bairro: 'Vila Mathias', cidade: 'Santos', uf: 'SP', categoria: 'Vidros, Papéis e Papelão', nota_media: 4.8, lat: -23.9550, lng: -46.3280 },
    { id: 8, razao_social: 'Santista Ambiental', bairro: 'Gonzaga', cidade: 'Santos', uf: 'SP', categoria: 'Coleta Especial e Condomínios', nota_media: 5.0, lat: -23.9680, lng: -46.3340 }
  ];

  /* ==========================================================================
     1. CONTROLE DE NAVEGAÇÃO POR ABAS (SPA)
     ========================================================================== */
  function switchUserTab(tabName, el) {
    if (!tabName) tabName = 'dash';

    var navItems = document.querySelectorAll('.sidebar-menu .nav-item');
    navItems.forEach(function (item) {
      item.classList.remove('active');
    });

    if (el) {
      el.classList.add('active');
    } else {
      var targetLink = document.querySelector('.sidebar-menu .nav-item[data-tab="' + tabName + '"]');
      if (targetLink) targetLink.classList.add('active');
    }

    var tabs = document.querySelectorAll('.user-tab-content');
    tabs.forEach(function (t) {
      t.style.display = 'none';
    });

    var activeTab = document.getElementById('tab-' + tabName);
    if (activeTab) {
      activeTab.style.display = 'block';
    }

    var subEl = document.getElementById('dash-topbar-sub');
    var greetingEl = document.getElementById('dash-greeting');

    var titlesMap = {
      dash: { title: 'Olá 👋', sub: 'Gere e acompanhe as suas contribuições sustentáveis.' },
      coletas: { title: 'Minhas Coletas 📋', sub: 'Acompanhe o histórico, status e solicite novas coletas.' },
      empresas: { title: 'Empresas Salvas 🏢', sub: 'Conheça e solicite agendamentos com empresas parceiras.' },
      mapa: { title: 'Ver no Mapa 🗺️', sub: 'Localize pontos de coleta e cooperativas na sua região.' },
      historico: { title: 'Histórico de Atividades 🌱', sub: 'Seu registro completo de reciclagens e pontuações.' },
      perfil: { title: 'Meu Perfil 👤', sub: 'Mantenha seus dados cadastrais e de acesso sempre atualizados.' }
    };

    var info = titlesMap[tabName] || titlesMap['dash'];

    if (tabName === 'dash') {
      try {
        var stored = sessionStorage.getItem('ecocall_user');
        if (stored) {
          var u = JSON.parse(stored);
          var nome = u.nome || u.razao_social || 'Usuário';
          var primeiroNome = nome.split(' ')[0];
          var hr = new Date().getHours();
          var saudacao = hr < 12 ? 'Bom dia' : (hr < 18 ? 'Boa tarde' : 'Boa noite');
          if (greetingEl) greetingEl.textContent = saudacao + ', ' + primeiroNome + ' 👋';
        } else if (greetingEl) {
          greetingEl.textContent = 'Olá 👋';
        }
      } catch (e) {
        if (greetingEl) greetingEl.textContent = 'Olá 👋';
      }
    } else if (greetingEl) {
      greetingEl.textContent = info.title;
    }

    if (subEl) subEl.textContent = info.sub;

    if (tabName === 'coletas' && window.carregarColetasDoBanco) {
      window.carregarColetasDoBanco();
    } else if (tabName === 'mapa') {
      setTimeout(function () {
        initLeafletMap(cachedEmpresas.length > 0 ? cachedEmpresas : defaultSantosCompanies);
      }, 150);
    } else if (tabName === 'historico') {
      renderizarHistoricoAtividades(cachedColetas);
    } else if (tabName === 'perfil') {
      carregarPerfilUsuario();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ==========================================================================
     2. CARREGAMENTO GERAL DO PAINEL DE USUÁRIO
     ========================================================================== */
  function carregarPainelUsuario() {
    if (!window.apiFetch) return;

    if (window.syncUserProfile) {
      window.syncUserProfile();
    }

    window.apiFetch('api/dashboard/stats.php').then(function (res) {
      if (res && res.success && res.stats) {
        var st = res.stats;
        var mConcluidas = document.getElementById('dash-m-concluidas');
        var mPontos = document.getElementById('dash-m-pontos');
        var mPeso = document.getElementById('dash-m-peso');
        var mCo2 = document.getElementById('dash-m-co2');

        if (mConcluidas) mConcluidas.textContent = st.coletas_concluidas || 0;
        if (mPontos) mPontos.innerHTML = (st.pontos || 0) + ' <span class="m-unit">pts</span>';
        if (mPeso) mPeso.innerHTML = (st.peso_total_kg || 0) + ' <span class="m-unit">kg</span>';
        if (mCo2) mCo2.textContent = '~' + (st.co2_economizado_kg || 0) + ' kg CO₂ evitados';
      }
    }).catch(function (err) {
      console.warn('Erro ao carregar estatísticas:', err);
    });

    window.apiFetch('api/coletas/index.php').then(function (res) {
      if (res && res.success && Array.isArray(res.coletas)) {
        cachedColetas = res.coletas;
        renderizarTabelaColetas(res.coletas);
        renderizarColetasDoBanco(res.coletas);
        renderizarHistoricoAtividades(res.coletas);
      }
    }).catch(function (err) {
      console.warn('Erro ao carregar coletas recentes:', err);
    });

    window.apiFetch('api/empresas/index.php').then(function (res) {
      if (res && res.success && Array.isArray(res.empresas)) {
        cachedEmpresas = res.empresas;
        renderizarEmpresasDisponiveis(res.empresas);
        var mEmpresas = document.getElementById('dash-m-empresas');
        if (mEmpresas) mEmpresas.textContent = res.empresas.length;
      }
    }).catch(function (err) {
      console.warn('Erro ao carregar empresas parceiras:', err);
      cachedEmpresas = defaultSantosCompanies;
    });

    carregarEmpresasNoSelect();

    var params = new URLSearchParams(location.search);
    var targetTab = params.get('tab') || (location.hash || '').replace('#', '').toLowerCase();
    if (targetTab && ['dash', 'coletas', 'empresas', 'mapa', 'historico', 'perfil'].indexOf(targetTab) !== -1) {
      switchUserTab(targetTab);
    }
  }

  function renderizarTabelaColetas(coletas) {
    var tbody = document.getElementById('dash-coletas-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (coletas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-grey);padding:2rem;">Você ainda não possui solicitações de coleta ativas. <a href="javascript:void(0)" onclick="switchUserTab(\'coletas\')" style="color:var(--primary-color);font-weight:600;">Clique aqui para agendar</a></td></tr>';
      return;
    }

    var statusMap = {
      'pendente': { label: 'Pendente', badgeCls: 'badge-sched', btnText: 'Detalhes' },
      'agendado': { label: 'Agendada', badgeCls: 'badge-sched', btnText: 'Detalhes' },
      'concluido': { label: 'Concluída', badgeCls: 'badge-done', btnText: 'Comprovante PDF' },
      'cancelado': { label: 'Cancelada', badgeCls: 'badge-cancel', btnText: 'Reagendar' }
    };

    coletas.slice(0, 5).forEach(function (c) {
      var tr = document.createElement('tr');
      var companyName = c.empresa_nome || 'EcoColeta Santos';
      var letter = companyName.charAt(0).toUpperCase();
      var rawDate = c.data_agendada || '';
      var parts = rawDate.split('-');
      var dateFmt = parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : rawDate;
      var stInfo = statusMap[c.status] || statusMap['agendado'];

      tr.innerHTML =
        '<td>' +
          '<div class="table-comp-info">' +
            '<div class="comp-letter text-green-bg">' + letter + '</div>' +
            '<span>' + companyName + '</span>' +
          '</div>' +
        '</td>' +
        '<td><span class="etag tag-plastic">' + (c.tipo_residuo || 'Resíduos Recicláveis') + '</span></td>' +
        '<td>' + dateFmt + '</td>' +
        '<td><span class="badge ' + stInfo.badgeCls + '">' + stInfo.label + '</span></td>' +
        '<td><button class="btn-table-details" onclick="switchUserTab(\'coletas\')">' + stInfo.btnText + '</button></td>';

      tbody.appendChild(tr);
    });
  }

  function renderizarEmpresasDisponiveis(empresas) {
    var container = document.getElementById('dash-empresas-container');
    var tabContainer = document.getElementById('tab-empresas-list');

    if (container) container.innerHTML = '';
    if (tabContainer) tabContainer.innerHTML = '';

    if (empresas.length === 0) {
      var emptyMsg = '<p style="color:var(--text-grey);font-size:0.88rem;">Nenhuma empresa cadastrada no momento.</p>';
      if (container) container.innerHTML = emptyMsg;
      if (tabContainer) tabContainer.innerHTML = emptyMsg;
      return;
    }

    empresas.forEach(function (emp, idx) {
      var name = emp.razao_social || 'Empresa Reciclagem';
      var city = (emp.bairro ? emp.bairro + ', ' : '') + (emp.cidade || 'Santos') + ' - ' + (emp.uf || 'SP');
      var cat = emp.categoria || 'Reciclagem Geral';
      var letter = name.charAt(0).toUpperCase();
      var nota = parseFloat(emp.nota_media || 5.0).toFixed(1);

      var card = document.createElement('div');
      card.className = 'dashboard-ecard';
      card.innerHTML =
        '<div class="db-ecard-left">' +
          '<div class="db-ecard-avatar">' + letter + '</div>' +
          '<div class="db-ecard-meta">' +
            '<h3>' + name + '</h3>' +
            '<p class="db-ecard-city">📍 ' + city + ' &bull; <strong style="color:var(--g700);">' + cat + '</strong></p>' +
            '<div class="db-ecard-stars">★★★★★ <span class="rating-num">' + nota + '</span></div>' +
          '</div>' +
        '</div>' +
        '<button class="btn-c-dash" onclick="selecionarEmpresaNoModal(\'' + name.replace(/'/g, "\\'") + '\')">Chamar Coleta</button>';

      if (container && idx < 4) {
        container.appendChild(card.cloneNode(true));
      }
      if (tabContainer) {
        tabContainer.appendChild(card);
      }
    });
  }

  /* ==========================================================================
     3. GERENCIAMENTO DAS COLETAS DO USUÁRIO (GRID & CARDS)
     ========================================================================== */
  function carregarColetasDoBanco() {
    if (!window.apiFetch) return;
    window.apiFetch('api/coletas/index.php').then(function (res) {
      if (res && res.success && Array.isArray(res.coletas)) {
        cachedColetas = res.coletas;
        renderizarColetasDoBanco(res.coletas);
        renderizarHistoricoAtividades(res.coletas);
      }
    });
  }

  function renderizarColetasDoBanco(coletas) {
    var grid = document.getElementById('coletas-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (coletas.length === 0) {
      var emptyEl = document.getElementById('empty-state');
      if (emptyEl) emptyEl.classList.add('show');
      return;
    } else {
      var emptyEl2 = document.getElementById('empty-state');
      if (emptyEl2) emptyEl2.classList.remove('show');
    }

    var statusMap = {
      'pendente': { key: 'sched', label: 'Pendente', badgeCls: 'badge-sched' },
      'agendado': { key: 'sched', label: 'Agendada', badgeCls: 'badge-sched' },
      'concluido': { key: 'done', label: 'Concluída', badgeCls: 'badge-done' },
      'cancelado': { key: 'cancel', label: 'Cancelada', badgeCls: 'badge-cancel' }
    };

    var months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    coletas.forEach(function (c) {
      var companyName = c.empresa_nome || 'EcoColeta Santos';
      var orderId = c.protocolo || ('COL-' + strPad(c.id, 6));
      var stInfo = statusMap[c.status] || statusMap['agendado'];

      var rawDate = c.data_agendada || '';
      var parts = rawDate.split('-');
      var dayNum = parts.length === 3 ? parts[2] : '15';
      var monthName = parts.length === 3 ? months[parseInt(parts[1], 10) - 1] + '/' + parts[0].substring(2) : 'Jun/26';
      var formattedDateStr = parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : rawDate;

      var weight = parseFloat(c.peso_estimado_kg || 1.0).toFixed(1);
      var tiposText = c.tipo_residuo || 'Plástico, Papel';

      var card = document.createElement('div');
      card.className = 'coleta-card';
      card.dataset.status = stInfo.key;
      card.dataset.date = rawDate;
      card.dataset.weight = weight;
      card.dataset.company = companyName;

      var tags = tiposText.split(',').map(function (t) {
        return '<span class="etag tag-plastic">' + t.trim() + '</span>';
      }).join(' ');

      var actionsHtml = '';
      if (c.status === 'concluido') {
        actionsHtml =
          '<button class="btn-card-action primary" onclick="event.stopPropagation();imprimirComprovantePDF(\'' + orderId + '\')">📄 PDF</button>' +
          '<button class="btn-card-action secondary" style="margin-left:4px;background:#fef3c7;color:#b45309;border:1px solid #fde68a;" onclick="event.stopPropagation();openEvalModal(' + c.id + ', \'' + companyName.replace(/'/g, "\\'") + '\')">⭐ Avaliar</button>';
      } else {
        actionsHtml = '<button class="btn-card-action primary" onclick="event.stopPropagation();imprimirComprovantePDF(\'' + orderId + '\')">📄 PDF</button>';
      }

      card.innerHTML =
        '<div class="coleta-avatar av-green">' + companyName.charAt(0).toUpperCase() + '</div>' +
        '<div class="coleta-info">' +
          '<div class="coleta-company">' + companyName + '</div>' +
          '<div class="coleta-tags">' + tags + '</div>' +
        '</div>' +
        '<div class="coleta-date"><div class="date-day">' + dayNum + '</div><div class="date-month">' + monthName + '</div></div>' +
        '<div class="coleta-weight"><div class="weight-val">' + weight + ' kg</div><div class="weight-lbl">Estimado</div></div>' +
        '<div class="coleta-right">' +
          '<span class="badge ' + stInfo.badgeCls + '">' + stInfo.label + '</span>' +
          '<div style="display:flex;align-items:center;">' + actionsHtml + '</div>' +
        '</div>';

      card.onclick = function () {
        openDetail(companyName, c.endereco_coleta || 'Santos, SP', companyName.charAt(0).toUpperCase(), 'av-green', stInfo.key, dayNum, monthName, weight, tiposText, formattedDateStr, orderId, c.id, c.status);
      };

      grid.appendChild(card);
    });

    applyFilters();
  }

  function strPad(n, width) {
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
  }

  /* ==========================================================================
     4. FILTROS E ORDENAÇÃO DE CARDS
     ========================================================================== */
  function filterCards(keyword) {
    var cards = document.querySelectorAll('.coleta-card');
    var visibleCount = 0;
    keyword = (keyword || '').toLowerCase();

    cards.forEach(function (card) {
      var comp = card.dataset.company.toLowerCase();
      var status = card.dataset.status;
      var textMatch = comp.indexOf(keyword) !== -1;
      var statusMatch = currentFilter === 'all' || status === currentFilter;

      if (textMatch && statusMatch) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    var emptyEl = document.getElementById('empty-state');
    if (emptyEl) {
      if (visibleCount === 0) emptyEl.classList.add('show');
      else emptyEl.classList.remove('show');
    }
  }

  function setFilter(filterKey, element) {
    currentFilter = filterKey;
    var pills = document.querySelectorAll('.filter-pill');
    pills.forEach(function (p) { p.classList.remove('active'); });
    if (element) element.classList.add('active');

    var searchInput = document.getElementById('search-input');
    filterCards(searchInput ? searchInput.value : '');
  }

  function applyFilters() {
    var searchInput = document.getElementById('search-input');
    filterCards(searchInput ? searchInput.value : '');
  }

  function sortCards(sortKey) {
    currentSort = sortKey;
    var grid = document.getElementById('coletas-grid');
    if (!grid) return;
    var cards = Array.from(grid.children);

    cards.sort(function (a, b) {
      if (sortKey === 'date-desc') return new Date(b.dataset.date) - new Date(a.dataset.date);
      if (sortKey === 'date-asc') return new Date(a.dataset.date) - new Date(b.dataset.date);
      if (sortKey === 'weight-desc') return parseFloat(b.dataset.weight) - parseFloat(a.dataset.weight);
      if (sortKey === 'weight-asc') return parseFloat(a.dataset.weight) - parseFloat(b.dataset.weight);
      return 0;
    });

    cards.forEach(function (card) { grid.appendChild(card); });
  }

  /* ==========================================================================
     5. PAINEL LATERAL DE DETALHES DA COLETA
     ========================================================================== */
  var badges = {
    done:   '<span class="badge badge-done">Concluída</span>',
    sched:  '<span class="badge badge-sched">Agendada</span>',
    prog:   '<span class="badge badge-prog">Em andamento</span>',
    cancel: '<span class="badge badge-cancel">Cancelada</span>'
  };

  function openDetail(company, loc, letter, avClass, status, day, month, weight, tipos, date, id, rawId, rawStatus) {
    document.getElementById('dp-title').textContent   = 'Coleta #' + id;
    document.getElementById('dp-company').textContent = company;
    document.getElementById('dp-loc').textContent     = '📍 ' + loc;
    document.getElementById('dp-id').textContent      = id;
    document.getElementById('dp-date').textContent    = date;
    document.getElementById('dp-tipos').textContent   = tipos;
    document.getElementById('dp-weight').textContent  = weight + ' kg';

    var av = document.getElementById('dp-avatar');
    if (av) {
      av.textContent = letter;
      av.className   = 'coleta-avatar ' + avClass;
    }

    var b = document.getElementById('dp-badge');
    if (b) b.innerHTML = badges[status] || badges.sched;

    var actContainer = document.getElementById('dp-actions');
    if (actContainer) {
      var html = '<button class="btn-detail-primary" onclick="imprimirComprovantePDF(\'' + id + '\')">📄 Imprimir PDF Oficial</button>';
      if (rawStatus === 'concluido') {
        html += '<button class="btn-detail-secondary" style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;font-weight:700;" onclick="openEvalModal(' + rawId + ', \'' + company.replace(/'/g, "\\'") + '\')">⭐ Avaliar Atendimento (+10 pts)</button>';
      } else if (rawStatus === 'pendente' || rawStatus === 'agendado') {
        html += '<button class="btn-detail-secondary" onclick="cancelarMinhaColeta(' + rawId + ')">✕ Cancelar Solicitação</button>';
      }
      actContainer.innerHTML = html;
    }

    var overlay = document.getElementById('overlay');
    var panel = document.getElementById('detail-panel');
    if (overlay) overlay.classList.add('open');
    if (panel) panel.classList.add('open');
  }

  function closeDetail() {
    var overlay = document.getElementById('overlay');
    var panel = document.getElementById('detail-panel');
    if (overlay) overlay.classList.remove('open');
    if (panel) panel.classList.remove('open');
  }

  function cancelarMinhaColeta(coletaId) {
    if (!confirm('Deseja realmente cancelar este agendamento de coleta?')) return;
    if (!window.apiFetch) return;

    window.apiFetch('api/coletas/update.php', {
      method: 'POST',
      body: { coleta_id: coletaId, status: 'cancelado' }
    }).then(function (res) {
      if (res && res.success) {
        window.toast('✓ ' + (res.message || 'Coleta cancelada.'));
        closeDetail();
        carregarPainelUsuario();
      } else {
        window.toast('⚠ ' + (res.error || 'Erro ao cancelar coleta.'));
      }
    });
  }

  /* ==========================================================================
     6. MAPA INTERATIVO LEAFLET.JS (ABA VER NO MAPA)
     ========================================================================== */
  function initLeafletMap(empresas) {
    var mapDiv = document.getElementById('map-canvas');
    if (!mapDiv || typeof window.L === 'undefined') return;

    if (!mapInstance) {
      mapInstance = window.L.map('map-canvas').setView([-23.9618, -46.3322], 13);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(mapInstance);
    } else {
      mapInstance.invalidateSize();
    }

    // Adiciona marcadores de empresas
    (empresas || []).forEach(function (emp) {
      var lat = emp.lat || -23.9618 + (Math.random() - 0.5) * 0.04;
      var lng = emp.lng || -46.3322 + (Math.random() - 0.5) * 0.04;
      var name = emp.razao_social || 'Empresa Recicladora';
      var cat = emp.categoria || 'Coleta de Resíduos';

      var popupHtml =
        '<div style="font-family:sans-serif;font-size:13px;line-height:1.4;">' +
          '<strong style="color:#2f855a;font-size:14px;">🌱 ' + name + '</strong><br>' +
          '<span style="color:#4a5568;">' + cat + '</span><br>' +
          '<span style="color:#f59e0b;font-weight:bold;">★ ' + (emp.nota_media || 5.0) + '</span><br>' +
          '<button style="margin-top:6px;padding:4px 10px;background:#2f855a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;" onclick="selecionarEmpresaNoModal(\'' + name.replace(/'/g, "\\'") + '\')">Solicitar Coleta Aqui ♻️</button>' +
        '</div>';

      window.L.marker([lat, lng])
        .addTo(mapInstance)
        .bindPopup(popupHtml);
    });
  }

  function selecionarEmpresaNoModal(empresaNome) {
    switchUserTab('coletas');
    openRequestModal();
    var select = document.getElementById('req-empresa');
    if (select) {
      for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].value.indexOf(empresaNome) !== -1 || empresaNome.indexOf(select.options[i].value) !== -1) {
          select.selectedIndex = i;
          onCompanySelectChange(select.value);
          break;
        }
      }
    }
  }

  /* ==========================================================================
     7. HISTÓRICO DE ATIVIDADES E PONTUAÇÃO (ABA HISTÓRICO)
     ========================================================================== */
  function renderizarHistoricoAtividades(coletas) {
    var list = document.getElementById('tab-historico-list');
    if (!list) return;
    list.innerHTML = '';

    if (!coletas || coletas.length === 0) {
      list.innerHTML = '<div style="padding:2.5rem;text-align:center;color:var(--text-grey);">Você ainda não possui histórico de atividades. Agende sua primeira coleta para ganhar pontos!</div>';
      return;
    }

    coletas.forEach(function (c) {
      var item = document.createElement('div');
      item.style.cssText = 'padding:1rem 1.2rem;border:1px solid var(--gray-200);border-radius:12px;display:flex;justify-content:space-between;align-items:center;background:#fff;';

      var isConcluida = c.status === 'concluido';
      var icon = isConcluida ? '🌱' : (c.status === 'agendado' ? '📅' : '⏳');
      var pts = isConcluida ? '+20 pts' : '+0 pts';
      var ptsColor = isConcluida ? 'var(--g400)' : 'var(--text-grey)';

      var rawDate = c.data_agendada || '';
      var parts = rawDate.split('-');
      var dateFmt = parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : rawDate;

      item.innerHTML =
        '<div>' +
          '<strong style="color:var(--g700);font-size:0.95rem;">' + icon + ' Coleta ' + (c.status.toUpperCase()) + ' — ' + (c.tipo_residuo || 'Geral') + '</strong>' +
          '<div style="font-size:0.8rem;color:var(--gray-600);margin-top:2px;">' + (c.empresa_nome || 'EcoColeta') + ' • ' + (c.peso_estimado_kg || 1) + ' kg • ' + dateFmt + '</div>' +
        '</div>' +
        '<span style="color:' + ptsColor + ';font-weight:700;font-size:0.95rem;">' + pts + '</span>';

      list.appendChild(item);
    });
  }

  /* ==========================================================================
     8. MODAL DE AVALIAÇÃO DE COLETAS CONCLUÍDAS (FASE 3)
     ========================================================================== */
  function openEvalModal(coletaId, empresaNome) {
    var overlay = document.getElementById('eval-overlay');
    var modal = document.getElementById('eval-modal');
    var empNameEl = document.getElementById('eval-empresa-name');
    var idInput = document.getElementById('eval-coleta-id');
    var commentInput = document.getElementById('eval-comment');

    if (empNameEl) empNameEl.textContent = 'Empresa: ' + (empresaNome || 'Parceira de Coleta');
    if (idInput) idInput.value = coletaId;
    if (commentInput) commentInput.value = '';

    setRating(5);

    if (overlay) overlay.classList.add('open');
    if (modal) modal.classList.add('open');
  }

  function closeEvalModal() {
    var overlay = document.getElementById('eval-overlay');
    var modal = document.getElementById('eval-modal');
    if (overlay) overlay.classList.remove('open');
    if (modal) modal.classList.remove('open');
  }

  function setRating(val) {
    currentEvalRating = val;
    var container = document.getElementById('eval-stars-picker');
    var lbl = document.getElementById('eval-rating-lbl');

    var labels = {
      1: '1 estrela (Muito Ruim)',
      2: '2 estrelas (Ruim)',
      3: '3 estrelas (Regular)',
      4: '4 estrelas (Bom)',
      5: '5 estrelas (Excelente)'
    };

    if (lbl) lbl.textContent = labels[val] || (val + ' estrelas');

    if (container) {
      var spans = container.querySelectorAll('span');
      spans.forEach(function (span, idx) {
        if (idx < val) {
          span.style.color = '#f59e0b';
        } else {
          span.style.color = '#d1d5db';
        }
      });
    }
  }

  function submitEvaluation() {
    var idInput = document.getElementById('eval-coleta-id');
    var commentInput = document.getElementById('eval-comment');
    var coletaId = idInput ? parseInt(idInput.value, 10) : 0;
    var comment = commentInput ? commentInput.value.trim() : '';

    if (coletaId <= 0) {
      window.toast('⚠ Coleta inválida para avaliação.');
      return;
    }

    window.toast('⏳ Enviando sua avaliação...');

    window.apiFetch('api/avaliacoes/create.php', {
      method: 'POST',
      body: {
        coleta_id: coletaId,
        nota: currentEvalRating,
        comentario: comment
      }
    }).then(function (res) {
      if (res && res.success) {
        window.toast('🎉 ' + (res.message || 'Avaliação registrada! Você ganhou +10 pontos.'));
        closeEvalModal();
        if (window.syncUserProfile) window.syncUserProfile();
        carregarPainelUsuario();
      } else {
        window.toast('⚠ ' + (res.error || 'Não foi possível enviar a avaliação.'));
      }
    }).catch(function (err) {
      console.error('Erro no envio de avaliação:', err);
      window.toast('⚠ Falha na comunicação com o servidor.');
    });
  }

  /* ==========================================================================
     9. MODAL DE SOLICITAÇÃO DE COLETA & MATERIAIS ACEITOS
     ========================================================================== */
  function getAcceptedMaterialsForCategory(cat) {
    cat = (cat || '').toLowerCase();
    if (cat.includes('eletrônic') || cat.includes('reee')) {
      return ['Eletrônicos', 'Metal'];
    }
    if (cat.includes('óleo') || cat.includes('cozinha')) {
      return ['Óleo de Cozinha', 'Plástico', 'Papel'];
    }
    if (cat.includes('sucata') || cat.includes('metais')) {
      return ['Metal', 'Plástico', 'Eletrônicos'];
    }
    if (cat.includes('vidro') || cat.includes('papelão')) {
      return ['Vidro', 'Papel', 'Plástico'];
    }
    return ['Plástico', 'Papel', 'Metal', 'Vidro', 'Eletrônicos', 'Óleo de Cozinha'];
  }

  function renderMaterialChips(acceptedList) {
    var container = document.getElementById('req-materials-container');
    if (!container) return;
    container.innerHTML = '';

    todosMateriais.forEach(function (mat) {
      var isAccepted = acceptedList.indexOf(mat.name) !== -1;
      var chip = document.createElement('div');
      chip.className = 'mat-chip' + (isAccepted ? ' accepted active' : ' disabled');
      chip.dataset.material = mat.name;
      chip.dataset.accepted = isAccepted ? 'true' : 'false';

      chip.innerHTML =
        '<span class="mat-chip-icon">' + mat.icon + '</span>' +
        '<span class="mat-chip-name">' + mat.name + '</span>' +
        '<span class="mat-chip-status">' + (isAccepted ? '✓' : '✕') + '</span>';

      if (isAccepted) {
        chip.addEventListener('click', function () {
          this.classList.toggle('active');
        });
      }

      container.appendChild(chip);
    });
  }

  function onCompanySelectChange(companyName) {
    var emp = empresasMateriaisMap[companyName];
    var statusEl = document.getElementById('req-company-status');

    if (emp) {
      var accepted = getAcceptedMaterialsForCategory(emp.categoria);
      renderMaterialChips(accepted);
      if (statusEl) statusEl.textContent = 'Aceita ' + accepted.length + ' tipos de resíduos em ' + (emp.bairro || 'Santos');
    } else {
      renderMaterialChips(['Plástico', 'Papel', 'Metal', 'Vidro']);
      if (statusEl) statusEl.textContent = 'Materiais padrão para coleta residencial';
    }
  }

  function popularSelectComEmpresas(empresas) {
    var empSelect = document.getElementById('req-empresa');
    if (!empSelect) return;

    var currentVal = empSelect.value;
    empSelect.innerHTML = '';
    empresasMateriaisMap = {};

    empresas.forEach(function (emp) {
      var name = emp.razao_social || 'Empresa Parceira';
      var loc = emp.bairro || emp.cidade || 'Santos';
      empresasMateriaisMap[name] = emp;

      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name + ' (' + loc + ' — ' + (emp.categoria || 'Reciclagem') + ')';
      if (name === currentVal) opt.selected = true;
      empSelect.appendChild(opt);
    });

    if (!empSelect.value && empSelect.options.length > 0) {
      empSelect.selectedIndex = 0;
    }

    onCompanySelectChange(empSelect.value);
  }

  function carregarEmpresasNoSelect() {
    var empSelect = document.getElementById('req-empresa');
    if (!empSelect) return;

    if (empSelect.options.length === 0) {
      popularSelectComEmpresas(defaultSantosCompanies);
    } else {
      onCompanySelectChange(empSelect.value);
    }

    if (window.apiFetch) {
      window.apiFetch('api/empresas/index.php').then(function (res) {
        if (res && res.success && Array.isArray(res.empresas) && res.empresas.length > 0) {
          popularSelectComEmpresas(res.empresas);
        }
      }).catch(function() {
        popularSelectComEmpresas(defaultSantosCompanies);
      });
    }
  }

  var userRegisteredAddress = null;
  var isCustomAddressMode = false;

  function ehEnderecoDeSantos(addr) {
    if (!addr) return false;
    var cidade = (addr.cidade || '').trim().toLowerCase();
    var uf = (addr.uf || '').trim().toUpperCase();
    var cep = (addr.cep || '').replace(/\D/g, '');
    var endereco = (addr.endereco || '').toLowerCase();

    // Se o CEP for de Santos (faixa 11000 a 11099)
    if (cep.length === 8 && cep.startsWith('110')) {
      return true;
    }
    // Se a cidade for explicitamente Santos
    if (cidade === 'santos') {
      return uf === 'sp' || uf === '';
    }
    // Se a string de endereço contiver Santos
    if (endereco.includes('santos') && (uf === 'sp' || uf === '')) {
      return true;
    }
    // Se não tiver cidade preenchida mas tiver logradouro/bairro padrão
    if (!cidade && (addr.logradouro || addr.bairro) && (uf === 'sp' || !uf)) {
      return true;
    }
    return false;
  }

  function obterDadosEnderecoUsuario() {
    try {
      var stored = sessionStorage.getItem('ecocall_user');
      if (stored) {
        var u = JSON.parse(stored);
        return {
          cep: u.cep || '',
          tipo_logradouro: u.tipo_logradouro || 'Rua',
          logradouro: u.logradouro || '',
          numero: u.numero || '',
          complemento: u.complemento || '',
          bairro: u.bairro || '',
          cidade: u.cidade || 'Santos',
          uf: u.uf || 'SP',
          endereco: u.endereco || ''
        };
      }
    } catch(e) {}
    return null;
  }

  function preencherInputsEndereco(addr) {
    if (!addr) return;
    if (addr.cep !== undefined) setVal('req-cep', addr.cep);
    if (addr.tipo_logradouro !== undefined) setVal('req-tipo-logradouro', addr.tipo_logradouro || 'Rua');
    if (addr.logradouro !== undefined) setVal('req-logradouro', addr.logradouro);
    if (addr.numero !== undefined) setVal('req-numero', addr.numero);
    if (addr.complemento !== undefined) setVal('req-complemento', addr.complemento);
    if (addr.bairro !== undefined) setVal('req-bairro', addr.bairro);
    setVal('req-cidade', 'Santos');
    setVal('req-uf', 'SP');
  }

  function formatarEnderecoLegivel(addr) {
    if (!addr || (!addr.logradouro && !addr.cep && !addr.bairro)) {
      return 'Nenhum endereço cadastrado no seu perfil ainda. Clique em "Outros" para preencher um endereço em Santos.';
    }
    var tipo = addr.tipo_logradouro ? addr.tipo_logradouro + ' ' : '';
    var log = addr.logradouro ? (addr.logradouro.toLowerCase().startsWith(tipo.trim().toLowerCase()) ? addr.logradouro : tipo + addr.logradouro) : 'Endereço sem logradouro';
    var num = addr.numero ? ', ' + addr.numero : ', S/N';
    var comp = addr.complemento ? ' (' + addr.complemento + ')' : '';
    var bai = addr.bairro ? ' - ' + addr.bairro : '';
    var cid = addr.cidade ? ', ' + addr.cidade : ', Santos';
    var uf = addr.uf ? '/' + addr.uf : '/SP';
    var cep = addr.cep ? ' — CEP: ' + addr.cep : '';
    return log + num + comp + bai + cid + uf + cep;
  }

  function atualizarVisualizacaoEnderecoModal() {
    var tabResidencial = document.getElementById('btn-tab-addr-residencial');
    var tabOutros = document.getElementById('btn-tab-addr-outros');
    var regCard = document.getElementById('req-addr-registered-card');
    var customForm = document.getElementById('req-addr-custom-form');
    var badge = document.getElementById('req-addr-status-badge');
    var previewText = document.getElementById('req-addr-preview-text');
    var alertForaSantos = document.getElementById('req-addr-fora-santos-alert');
    var cidadeOrigemSpan = document.getElementById('req-addr-cidade-origem');

    userRegisteredAddress = obterDadosEnderecoUsuario();
    var temEnderecoCadastrado = userRegisteredAddress && (userRegisteredAddress.logradouro || userRegisteredAddress.cep || userRegisteredAddress.bairro);
    var ehDeSantos = ehEnderecoDeSantos(userRegisteredAddress);

    if (previewText && userRegisteredAddress) {
      previewText.textContent = formatarEnderecoLegivel(userRegisteredAddress);
    }

    // Se o endereço residencial for fora de Santos, exibe alerta explicativo
    if (!ehDeSantos && temEnderecoCadastrado) {
      if (alertForaSantos) alertForaSantos.style.display = 'flex';
      if (cidadeOrigemSpan) {
        var cidNome = userRegisteredAddress.cidade || 'Outro Município';
        var ufNome = userRegisteredAddress.uf ? '/' + userRegisteredAddress.uf : '';
        cidadeOrigemSpan.textContent = cidNome + ufNome;
      }
      if (tabResidencial) {
        tabResidencial.classList.add('disabled-tab');
        tabResidencial.title = 'Endereço residencial fora de Santos/SP';
      }
    } else {
      if (alertForaSantos) alertForaSantos.style.display = 'none';
      if (tabResidencial) {
        tabResidencial.classList.remove('disabled-tab');
        tabResidencial.title = '';
      }
    }

    // Se não for de Santos ou estiver no modo customizado, força formulário Outros
    if (isCustomAddressMode || !temEnderecoCadastrado || !ehDeSantos) {
      if (tabResidencial) tabResidencial.classList.remove('active');
      if (tabOutros) tabOutros.classList.add('active');
      if (regCard) regCard.style.display = 'none';
      if (customForm) customForm.style.display = 'block';
      if (badge) {
        badge.textContent = '📍 Outro Endereço (Santos/SP)';
        badge.className = 'req-addr-badge badge-custom';
      }
    } else {
      if (tabResidencial) tabResidencial.classList.add('active');
      if (tabOutros) tabOutros.classList.remove('active');
      if (regCard) regCard.style.display = 'block';
      if (customForm) customForm.style.display = 'none';
      if (badge) {
        badge.textContent = '✓ Endereço Residencial (Santos)';
        badge.className = 'req-addr-badge badge-default';
      }
      preencherInputsEndereco(userRegisteredAddress);
    }
  }

  function selecionarTipoEndereco(tipo) {
    userRegisteredAddress = obterDadosEnderecoUsuario();
    var ehDeSantos = ehEnderecoDeSantos(userRegisteredAddress);

    if (tipo === 'residencial') {
      if (!userRegisteredAddress || (!userRegisteredAddress.logradouro && !userRegisteredAddress.cep)) {
        window.toast('⚠ Você ainda não possui endereço residencial no perfil. Preencha os campos abaixo.');
        selecionarTipoEndereco('outros');
        return;
      }
      if (!ehDeSantos) {
        var cidNome = userRegisteredAddress.cidade || 'outra cidade';
        var ufNome = userRegisteredAddress.uf ? '/' + userRegisteredAddress.uf : '';
        window.toast('❌ O EcoCall opera exclusivamente no município de Santos/SP. Como seu endereço cadastrado é em ' + cidNome + ufNome + ', informe obrigatoriamente um endereço em Santos no modo "Outros".');
        selecionarTipoEndereco('outros');
        return;
      }
      isCustomAddressMode = false;
      preencherInputsEndereco(userRegisteredAddress);
      atualizarVisualizacaoEnderecoModal();
      window.toast('🏠 Endereço residencial de Santos selecionado como padrão.');
    } else {
      // outros
      isCustomAddressMode = true;
      atualizarVisualizacaoEnderecoModal();
      var cepInput = document.getElementById('req-cep');
      if (cepInput) cepInput.focus();
      window.toast('📍 Modo "Outros" selecionado. Digite o endereço ou consulte pelo CEP de Santos.');
    }
  }

  function alternarParaEnderecoPersonalizado() {
    selecionarTipoEndereco('outros');
  }

  function restaurarEnderecoPadrao() {
    selecionarTipoEndereco('residencial');
  }

  function openRequestModal() {
    var overlay = document.getElementById('req-overlay');
    var modal = document.getElementById('request-modal');
    var dateInput = document.getElementById('req-date');

    if (dateInput && !dateInput.value) {
      var nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 2);
      dateInput.value = nextDate.toISOString().split('T')[0];
    }

    if (overlay) overlay.classList.add('open');
    if (modal) modal.classList.add('open');

    carregarEmpresasNoSelect();

    function aplicarDadosEnderecoModal() {
      userRegisteredAddress = obterDadosEnderecoUsuario();
      var temEndereco = userRegisteredAddress && (userRegisteredAddress.logradouro || userRegisteredAddress.cep || userRegisteredAddress.bairro);
      var ehDeSantos = ehEnderecoDeSantos(userRegisteredAddress);

      if (!temEndereco || !ehDeSantos) {
        isCustomAddressMode = true;
        setVal('req-uf', 'SP');
        setVal('req-cidade', 'Santos');
      } else {
        isCustomAddressMode = false;
        preencherInputsEndereco(userRegisteredAddress);
      }
      atualizarVisualizacaoEnderecoModal();
    }

    aplicarDadosEnderecoModal();

    // Sincroniza em segundo plano com a API para garantir dados mais recentes e atualiza o modal
    if (window.apiFetch) {
      window.apiFetch('api/auth/me.php').then(function (res) {
        if (res && res.authenticated && res.user) {
          try { sessionStorage.setItem('ecocall_user', JSON.stringify(res.user)); } catch(e) {}
          aplicarDadosEnderecoModal();
        }
      }).catch(function() {});
    }
  }

  function closeRequestModal() {
    var overlay = document.getElementById('req-overlay');
    var modal = document.getElementById('request-modal');
    if (overlay) overlay.classList.remove('open');
    if (modal) modal.classList.remove('open');
  }

  /* ==========================================================================
     10. INTEGRAÇÃO VIACEP E VALIDAÇÃO EXCLUSIVA SANTOS/SP
     ========================================================================== */
  function maskReqCEP(input) {
    var v = input.value.replace(/\D/g, '');
    if (v.length > 8) v = v.substring(0, 8);
    if (v.length > 5) v = v.substring(0, 5) + '-' + v.substring(5);
    input.value = v;
  }

  function buscarCEPReq() {
    var cepInput = document.getElementById('req-cep');
    if (!cepInput) return;
    var cep = cepInput.value.replace(/\D/g, '');

    if (cep.length !== 8) {
      window.toast('⚠ Digite um CEP válido com 8 dígitos.');
      return;
    }

    window.toast('🔍 Consultando CEP...');

    fetch('https://viacep.com.br/ws/' + cep + '/json/')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.erro) {
          window.toast('❌ CEP não encontrado. Verifique o número digitado.');
          return;
        }

        var localidade = (data.localidade || '').trim().toLowerCase();
        var uf = (data.uf || '').trim().toUpperCase();

        if (localidade !== 'santos' || uf !== 'SP') {
          window.toast('❌ Atendimento exclusivo em Santos/SP! O CEP ' + cep + ' pertence a ' + data.localidade + '/' + data.uf + '. Por favor, informe um CEP de Santos (11000 a 11099).');
          setVal('req-cep', '');
          setVal('req-logradouro', '');
          setVal('req-bairro', '');
          setVal('req-numero', '');
          if (cepInput) cepInput.focus();
          return;
        }

        setVal('req-logradouro', data.logradouro);
        setVal('req-bairro', data.bairro);
        setVal('req-uf', 'SP');
        setVal('req-cidade', 'Santos');

        var numInput = document.getElementById('req-numero');
        if (numInput) numInput.focus();

        window.toast('✅ Endereço em Santos/SP identificado com sucesso!');
      })
      .catch(function () {
        window.toast('⚠ Falha ao consultar o CEP. Preencha manualmente.');
      });
  }

  function carregarCidadesReq(cidadePadrao) {
    setVal('req-uf', 'SP');
    setVal('req-cidade', 'Santos');
  }

  /* ==========================================================================
     11. ENVIO DE NOVA SOLICITAÇÃO (POST PARA BANCO MYSQL)
     ========================================================================== */
  function submitCollectionRequest() {
    var companySelect = document.getElementById('req-empresa');
    var companyName = companySelect ? companySelect.value : 'Terra Santos Ambiental (Consórcio Público)';

    var emp = empresasMateriaisMap[companyName] || { id: null };

    var activeChips = document.querySelectorAll('#req-materials-container .mat-chip.active');
    var selectedMaterials = [];
    activeChips.forEach(function (chip) {
      if (chip.dataset.accepted === 'true') {
        selectedMaterials.push(chip.dataset.material);
      }
    });

    if (selectedMaterials.length === 0) {
      window.toast('⚠ Selecione pelo menos 1 tipo de material aceito pela empresa.');
      return;
    }

    var weightInput = document.getElementById('req-weight');
    var weight = weightInput && weightInput.value ? parseFloat(weightInput.value) : 2.5;

    var turnoInput = document.getElementById('req-turno');
    var turno = turnoInput ? turnoInput.value : 'Manhã (08h - 12h)';

    var cep = (document.getElementById('req-cep') || {}).value || '';
    var tipoLog = (document.getElementById('req-tipo-logradouro') || {}).value || 'Rua';
    var logradouro = (document.getElementById('req-logradouro') || {}).value || '';
    var numero = (document.getElementById('req-numero') || {}).value || '';
    var complemento = (document.getElementById('req-complemento') || {}).value || '';
    var bairro = (document.getElementById('req-bairro') || {}).value || '';
    var uf = (document.getElementById('req-uf') || {}).value || 'SP';
    var cidade = (document.getElementById('req-cidade') || {}).value || 'Santos';

    if (!isCustomAddressMode && !ehEnderecoDeSantos(userRegisteredAddress)) {
      window.toast('❌ Seu endereço residencial cadastrado não pertence ao município de Santos/SP. Alterne para o modo "Outros" para agendar em Santos.');
      selecionarTipoEndereco('outros');
      return;
    }

    if (!logradouro || !numero || !bairro) {
      if (!isCustomAddressMode) {
        window.toast('⚠ Seu endereço cadastrado está incompleto. Alterne para "Outros" para preencher.');
        selecionarTipoEndereco('outros');
      } else {
        window.toast('⚠ Preencha os campos obrigatórios do endereço de retirada em Santos (Logradouro, Número e Bairro).');
      }
      return;
    }

    var prefixoLog = logradouro.toLowerCase().startsWith(tipoLog.toLowerCase()) ? '' : (tipoLog + ' ');
    var logradouroCompleto = prefixoLog + logradouro;
    var compPart = complemento ? ' (' + complemento + ')' : '';
    var cepPart = cep ? ' (CEP: ' + cep + ')' : '';
    var fullAddress = logradouroCompleto + ', ' + numero + compPart + ' - ' + bairro + ', Santos/SP' + cepPart;

    var dateInput = document.getElementById('req-date');
    var rawDate = dateInput && dateInput.value ? dateInput.value : new Date().toISOString().split('T')[0];
    var notes = (document.getElementById('req-notes') || {}).value || '';

    var payload = {
      empresa_id: emp.id,
      empresa_nome: companyName,
      tipo_residuo: selectedMaterials.join(', '),
      peso_estimado_kg: weight,
      data_agendada: rawDate,
      turno: turno,
      endereco_coleta: fullAddress,
      observacoes: notes
    };

    window.toast('⏳ Enviando solicitação de coleta...');

    if (window.apiFetch) {
      window.apiFetch('api/coletas/create.php', {
        method: 'POST',
        body: payload
      }).then(function (res) {
        if (res && res.success) {
          window.toast('🎉 ' + (res.message || 'Solicitação agendada com sucesso! Protocolo: ' + res.protocolo));
          closeRequestModal();
          carregarPainelUsuario();
          if (res.protocolo && window.imprimirComprovantePDF) {
            window.imprimirComprovantePDF(res.protocolo, true);
          }
        } else {
          window.toast('❌ ' + (res.error || 'Erro ao agendar coleta.'));
        }
      }).catch(function () {
        window.toast('❌ Erro de conexão ao enviar solicitação.');
      });
    }
  }

  /* ==========================================================================
     12. GERENCIAMENTO DE PERFIL DO USUÁRIO CIDADÃO
     ========================================================================== */
  function setVal(id, val) {
    var el = document.getElementById(id);
    if (el && val !== undefined) el.value = val;
  }

  function getVal(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function carregarPerfilUsuario() {
    if (!window.apiFetch) return;

    window.apiFetch('api/auth/me.php').then(function (res) {
      if (!res || !res.authenticated || !res.user) return;

      var u = res.user;
      var name = u.nome || 'Usuário';
      var email = u.email || '';
      var initials = name.split(' ').map(function (n) { return n[0]; }).join('').substring(0, 2).toUpperCase() || 'EC';
      var memberSince = u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : 'Mai/2024';

      var cardAvatar = document.getElementById('usr-card-avatar');
      var cardName = document.getElementById('usr-card-name');
      var cardEmail = document.getElementById('usr-card-email');
      var statPontos = document.getElementById('usr-stat-pontos');
      var statMembro = document.getElementById('usr-stat-membro');

      if (cardAvatar) cardAvatar.textContent = initials;
      if (cardName) cardName.textContent = name;
      if (cardEmail) cardEmail.textContent = email;
      if (statPontos) statPontos.textContent = (u.pontos || 0) + ' pts';
      if (statMembro) statMembro.textContent = memberSince;

      setVal('usr-input-nome', u.nome);
      setVal('usr-input-cpf', u.cpf);
      setVal('usr-input-email', u.email);
      setVal('usr-input-telefone', u.telefone);
      setVal('usr-input-cep', u.cep);
      setVal('usr-input-cidade', u.cidade || 'Santos');
      setVal('usr-input-uf', u.uf || 'SP');
      setVal('usr-input-logradouro', u.logradouro);
      setVal('usr-input-numero', u.numero);
      setVal('usr-input-bairro', u.bairro);
      setVal('usr-input-complemento', u.complemento);

      setVal('usr-input-senha', '');
      setVal('usr-input-senha-conf', '');
    }).catch(function (err) {
      console.warn('Erro ao carregar dados do perfil do usuário:', err);
    });
  }

  function salvarPerfilUsuario(e) {
    if (e && e.preventDefault) e.preventDefault();

    var senha = getVal('usr-input-senha');
    var senhaConf = getVal('usr-input-senha-conf');

    if (senha !== '' || senhaConf !== '') {
      if (senha.length < 6) {
        window.toast('⚠ A nova senha deve ter no mínimo 6 caracteres.');
        return;
      }
      if (senha !== senhaConf) {
        window.toast('⚠ A nova senha e a confirmação não coincidem.');
        return;
      }
    }

    var btnSave = document.getElementById('usr-btn-save');
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.textContent = 'Salvando...';
    }

    var payload = {
      nome: getVal('usr-input-nome'),
      email: getVal('usr-input-email'),
      cpf: getVal('usr-input-cpf'),
      telefone: getVal('usr-input-telefone'),
      cep: getVal('usr-input-cep'),
      cidade: getVal('usr-input-cidade'),
      uf: getVal('usr-input-uf'),
      logradouro: getVal('usr-input-logradouro'),
      numero: getVal('usr-input-numero'),
      bairro: getVal('usr-input-bairro'),
      complemento: getVal('usr-input-complemento'),
      senha: senha
    };

    window.apiFetch('api/auth/update_profile.php', {
      method: 'POST',
      body: payload
    }).then(function (res) {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = 'Salvar alterações';
      }
      if (res && res.success) {
        window.toast('✓ ' + (res.message || 'Perfil atualizado com sucesso!'));
        if (window.syncUserProfile) window.syncUserProfile();
        carregarPerfilUsuario();
      } else {
        window.toast('⚠ ' + (res.error || 'Falha ao atualizar perfil.'));
      }
    }).catch(function (err) {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = 'Salvar alterações';
      }
      console.error('Erro na gravação do perfil:', err);
      window.toast('⚠ Falha na comunicação com o servidor.');
    });
  }

  /* ==========================================================================
     13. INICIALIZAÇÃO DO SCRIPT
     ========================================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    carregarPainelUsuario();
  });

  window.carregarPainelUsuario = carregarPainelUsuario;
  window.switchUserTab = switchUserTab;
  window.carregarColetasDoBanco = carregarColetasDoBanco;
  window.carregarPerfilUsuario = carregarPerfilUsuario;
  window.salvarPerfilUsuario = salvarPerfilUsuario;
  window.setFilter = setFilter;
  window.filterCards = filterCards;
  window.applyFilters = applyFilters;
  window.sortCards = sortCards;
  window.openDetail = openDetail;
  window.closeDetail = closeDetail;
  window.cancelarMinhaColeta = cancelarMinhaColeta;
  window.openRequestModal = openRequestModal;
  window.closeRequestModal = closeRequestModal;
  window.onCompanySelectChange = onCompanySelectChange;
  window.carregarEmpresasNoSelect = carregarEmpresasNoSelect;
  window.submitCollectionRequest = submitCollectionRequest;
  window.maskReqCEP = maskReqCEP;
  window.buscarCEPReq = buscarCEPReq;
  window.carregarCidadesReq = carregarCidadesReq;
  window.initLeafletMap = initLeafletMap;
  window.selecionarEmpresaNoModal = selecionarEmpresaNoModal;
  window.renderizarHistoricoAtividades = renderizarHistoricoAtividades;
  window.openEvalModal = openEvalModal;
  window.closeEvalModal = closeEvalModal;
  window.setRating = setRating;
  window.submitEvaluation = submitEvaluation;
  window.selecionarTipoEndereco = selecionarTipoEndereco;
  window.alternarParaEnderecoPersonalizado = alternarParaEnderecoPersonalizado;
  window.restaurarEnderecoPadrao = restaurarEnderecoPadrao;
})();
