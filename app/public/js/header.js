document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const navCategorias = document.getElementById('nav-categorias');
  if (!hamburger || !navCategorias) return;

  // Abre/fecha o menu e avisa o leitor de tela (aria-expanded)
  const definirMenu = (aberto) => {
    navCategorias.classList.toggle('open', aberto);
    hamburger.classList.toggle('open', aberto);
    hamburger.setAttribute('aria-expanded', String(aberto));
    hamburger.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
  };

  hamburger.addEventListener('click', () => {
    definirMenu(!navCategorias.classList.contains('open'));
  });

  document.querySelectorAll('#nav-categorias a').forEach(link => {
    link.addEventListener('click', () => definirMenu(false));
  });

  // Fecha com Esc (e devolve o foco ao botão) ou tocando fora do menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navCategorias.classList.contains('open')) {
      definirMenu(false);
      hamburger.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (navCategorias.classList.contains('open') &&
        !navCategorias.contains(e.target) && !hamburger.contains(e.target)) {
      definirMenu(false);
    }
  });
});

// Dark mode
(function() {
  var html = document.documentElement;
  var logo = document.querySelector('.logo');
  var saved = localStorage.getItem('eco-theme') || 'light';
  html.setAttribute('data-theme', saved);

  function updateLogo(theme) {
    if (!logo) return;
    logo.src = theme === 'dark' ? '/imagens/logo-darkmode.svg' : '/imagens/GENERATIONN.svg';
  }

  updateLogo(saved);

  // Há dois botões de tema (topo no computador, dentro do menu no celular)
  var botoes = document.querySelectorAll('.dark-toggle');
  function marcarBotoes(theme) {
    botoes.forEach(function(b) { b.setAttribute('aria-pressed', String(theme === 'dark')); });
  }
  marcarBotoes(saved);

  botoes.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('eco-theme', next);
      updateLogo(next);
      marcarBotoes(next);
    });
  });
})();
