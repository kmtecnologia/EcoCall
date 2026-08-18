/* ==========================================================================
   EcoCall — Núcleo JS compartilhado por todas as páginas
   - toast()               exibe mensagem temporária (#tst / #tmsg)
   - transicaoPara()       navega ativando o loading-screen
   - logout()              encerra sessão para a home pública
   - showLoader()          helper genérico de loader + redirect
   - syncUserProfile()     carrega e sincroniza dados do usuário logado na sidebar e topbar
   - Auto-ativa o item de nav correspondente à URL atual
   ========================================================================== */
(function () {
  'use strict';

  function getLoader() {
    return document.getElementById('loading-screen');
  }

  function setLoaderText(text) {
    var loader = getLoader();
    if (!loader) return;
    var p = loader.querySelector('p');
    if (p && text) p.textContent = text;
  }

  function showLoader(dest, opts) {
    opts = opts || {};
    var loader = getLoader();
    if (loader) loader.classList.add('is-active');
    if (opts.text) setLoaderText(opts.text);
    var delay = typeof opts.delay === 'number' ? opts.delay : 800;
    if (dest) setTimeout(function () { window.location.href = dest; }, delay);
  }

  function transicaoPara(url, e) {
    if (e && e.preventDefault) e.preventDefault();
    showLoader(url, { delay: 700 });
  }

  function apiFetch(endpoint, options) {
    options = options || {};
    options.headers = options.headers || {};
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    return fetch(endpoint, options)
      .then(function (res) {
        return res.text().then(function (text) {
          try {
            return JSON.parse(text);
          } catch (e) {
            console.error('API Non-JSON Response from ' + endpoint + ':', text);
            return { error: 'Resposta inesperada do servidor: ' + (text ? text.substring(0, 120) : 'vazia') };
          }
        });
      })
      .catch(function (err) {
        console.error('API Error:', err);
        return { error: 'Falha de conexão com o servidor. Verifique se o Apache/PHP está ativo no XAMPP.' };
      });
  }

  function logout(e) {
    if (e && e.preventDefault) e.preventDefault();
    try { sessionStorage.removeItem('ecocall_user'); } catch (err) {}
    apiFetch('api/auth/logout.php', { method: 'POST' }).then(function (res) {
      showLoader('ecocall-home.html', {
        delay: 600,
        text: 'Encerrando sessão…'
      });
    });
  }

  function toast(message, duration) {
    duration = duration || 3000;
    var t = document.getElementById('tst') || document.getElementById('toast');
    if (!t) return;
    var msgEl = document.getElementById('tmsg') || document.getElementById('toastMsg');
    if (msgEl) msgEl.textContent = message;
    t.classList.add('on');
    t.classList.add('show');
    setTimeout(function () {
      t.classList.remove('on');
      t.classList.remove('show');
    }, duration);
  }

  function applyUserDataToDOM(u) {
    if (!u) return;
    var nome = u.nome || u.razao_social || 'Usuário';
    var email = u.email || '';
    var parts = nome.split(' ').filter(Boolean);
    var initials = parts.map(function (n) { return n[0]; }).join('').substring(0, 2).toUpperCase() || 'EC';
    var cidade = (u.cidade || 'Santos') + (u.uf ? (', ' + u.uf) : '');

    var avatarEls = document.querySelectorAll('#dash-sidebar-avatar, #pf-sidebar-avatar, .sidebar-footer .avatar-mini');
    var nameEls   = document.querySelectorAll('#dash-sidebar-name, #pf-sidebar-name, .sidebar-footer .user-name');
    var emailEls  = document.querySelectorAll('#dash-sidebar-email, #pf-sidebar-email, .sidebar-footer .user-email');
    var cityEls   = document.querySelectorAll('#dash-topbar-city, #pf-topbar-city, .user-location-badge span:not(.dot)');

    avatarEls.forEach(function (el) { el.textContent = initials; });
    nameEls.forEach(function (el) { el.textContent = nome; });
    emailEls.forEach(function (el) { el.textContent = email; });
    cityEls.forEach(function (el) {
      if (el.tagName === 'SPAN' && !el.classList.contains('dot')) {
        el.textContent = cidade;
      }
    });

    var greetingEl = document.getElementById('dash-greeting');
    if (greetingEl) {
      var primeiroNome = parts[0] || nome;
      var hr = new Date().getHours();
      var saudacao = hr < 12 ? 'Bom dia' : (hr < 18 ? 'Boa tarde' : 'Boa noite');
      greetingEl.textContent = saudacao + ', ' + primeiroNome + ' 👋';
    }
  }

  function syncUserProfile(cachedUser) {
    var page = (location.pathname.split('/').pop() || '').toLowerCase();

    if (cachedUser) {
      applyUserDataToDOM(cachedUser);
      try { sessionStorage.setItem('ecocall_user', JSON.stringify(cachedUser)); } catch (e) {}
      return Promise.resolve(cachedUser);
    }

    try {
      var stored = sessionStorage.getItem('ecocall_user');
      if (stored) {
        var parsed = JSON.parse(stored);
        applyUserDataToDOM(parsed);
        if (parsed.tipo === 'empresa' && page === 'ecocall-dashbord_usuario.html') {
          window.location.replace('dashboard_empresa.html');
          return Promise.resolve(parsed);
        }
      }
    } catch (e) {}

    var isAuthProtected = [
      'ecocall-dashbord_usuario.html',
      'minhas-coletas.html',
      'dashboard_empresa.html'
    ].indexOf(page) !== -1;

    if (!isAuthProtected && !document.querySelector('.sidebar-footer')) {
      return Promise.resolve(null);
    }

    return apiFetch('api/auth/me.php').then(function (res) {
      if (res && res.authenticated) {
        var userType = (res.user && res.user.tipo) || (res.empresa ? 'empresa' : 'user');
        var userData = (userType === 'empresa' && res.empresa) ? res.empresa : res.user;
        if (!userData.tipo) userData.tipo = userType;
        if (!userData.nome && res.user && res.user.nome) userData.nome = res.user.nome;
        try { sessionStorage.setItem('ecocall_user', JSON.stringify(userData)); } catch (e) {}
        applyUserDataToDOM(userData);

        // Guarda de rotas: se for empresa na tela de usuário, direciona para o painel da empresa
        if (userType === 'empresa' && page === 'ecocall-dashbord_usuario.html') {
          window.location.replace('dashboard_empresa.html');
          return userData;
        }

        // Guarda de rotas: se for usuário comum em tela restrita de empresa, direciona para painel do usuário
        if (userType === 'user' && page === 'dashboard_empresa.html') {
          window.location.replace('ecocall-dashbord_usuario.html');
          return userData;
        }

        return userData;
      } else if (isAuthProtected) {
        try { sessionStorage.removeItem('ecocall_user'); } catch (e) {}
        toast('Sessão expirada. Redirecionando...');
        setTimeout(function () { window.location.href = 'ecocall-login.html'; }, 1000);
      }
      return null;
    });
  }

  function imprimirComprovantePDF(protocoloOrId, printAuto) {
    if (!protocoloOrId) {
      toast('⚠ Protocolo não identificado.');
      return;
    }
    var autoPrint = printAuto !== false ? 1 : 0;
    var paramKey = (typeof protocoloOrId === 'number' || /^\d+$/.test(protocoloOrId)) ? 'id' : 'protocolo';
    var url = 'api/coletas/pdf.php?' + paramKey + '=' + encodeURIComponent(protocoloOrId) + '&print=' + autoPrint;
    toast('📄 Gerando comprovante em PDF com FPDF...');
    window.open(url, '_blank');
  }

  function initColetasSSE() {
    if (typeof EventSource === 'undefined') return;
    try {
      var es = new EventSource('api/coletas/sse.php');
      es.addEventListener('status_updated', function (e) {
        try {
          var data = JSON.parse(e.data);
          if (data && data.latest) {
            var proto = data.latest.protocolo || ('COL-' + data.latest.id);
            var st = data.latest.status || '';
            toast('🌱 Protocolo ' + proto + ' atualizado em tempo real: "' + st + '"!');
            
            if (window.carregarColetasDoBanco) window.carregarColetasDoBanco();
            if (window.carregarPainelUsuario) window.carregarPainelUsuario();
            if (window.carregarRelatoriosEmpresa) window.carregarRelatoriosEmpresa();
          }
        } catch (err) {}
      });
    } catch (err) {}
  }

  function highlightActiveNav() {
    var current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var links = document.querySelectorAll('.sidebar-menu .nav-item, .nav-menu .nav-link');
    links.forEach(function (link) {
      var href = (link.getAttribute('href') || '').toLowerCase();
      if (href && href === current) link.classList.add('active');
    });
  }

  window.toast = toast;
  window.transicaoPara = transicaoPara;
  window.logout = logout;
  window.showLoader = showLoader;
  window.apiFetch = apiFetch;
  window.syncUserProfile = syncUserProfile;
  window.applyUserDataToDOM = applyUserDataToDOM;
  window.imprimirComprovantePDF = imprimirComprovantePDF;
  window.initColetasSSE = initColetasSSE;

  document.addEventListener('DOMContentLoaded', function () {
    highlightActiveNav();
    syncUserProfile();
    initColetasSSE();
  });
})();
