// Interação do carrinho com o Mercado Pago (material PSW3 – 20: comprar-carrinho.js).
// O navegador só pede a preferência: os itens e preços são montados no servidor
// a partir do carrinho da sessão. Aqui só usamos a chave PÚBLICA.
document.addEventListener('DOMContentLoaded', function () {
  var area = document.getElementById('area-checkout');
  if (!area) return; // carrinho vazio ou visitante sem login

  var botao = document.getElementById('checkout-btn');
  var erro = document.getElementById('checkout-erro');
  var pagamento = document.getElementById('container-pagamento');
  var voltar = document.getElementById('go-back');
  var textoBotao = botao.textContent;
  var publicKey = area.dataset.publicKey;
  var mercadopago = publicKey && window.MercadoPago ? new MercadoPago(publicKey, { locale: 'pt-BR' }) : null;

  function mostrarErro(mensagem) {
    erro.textContent = mensagem;
    erro.hidden = false;
    botao.disabled = false;
    botao.removeAttribute('aria-busy');
    botao.textContent = textoBotao;
  }

  // Cria o botão de pagamento (Wallet Brick) com o id da preferência
  async function createCheckoutButton(preferenceId) {
    var bricksBuilder = mercadopago.bricks();
    if (window.checkoutButton) window.checkoutButton.unmount(); // evita botões duplicados
    window.checkoutButton = await bricksBuilder.create('wallet', 'button-checkout', {
      initialization: { preferenceId: preferenceId },
      callbacks: {
        onError: function (e) { console.error(e); },
        onReady: function () {}
      }
    });
  }

  botao.addEventListener('click', async function () {
    if (botao.disabled) return;
    botao.disabled = true; // evita vários cliques e vários pedidos
    botao.setAttribute('aria-busy', 'true');
    botao.textContent = 'Preparando pagamento…';
    erro.hidden = true;

    try {
      var resposta = await fetch('/create-preference', {
        method: 'POST',
        headers: { Accept: 'application/json' }
      });
      var dados = await resposta.json().catch(function () { return {}; });

      if (dados.recarregar) return window.location.reload(); // carrinho mudou: mostra os avisos
      if (!resposta.ok || !dados.preferenceId) {
        return mostrarErro(dados.erro || 'Não foi possível iniciar o pagamento. Tente novamente.');
      }

      if (!mercadopago) {
        // Sem a chave pública, vai direto para a página do Mercado Pago
        window.location.href = 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=' + encodeURIComponent(dados.preferenceId);
        return;
      }

      await createCheckoutButton(dados.preferenceId);
      botao.hidden = true;
      pagamento.hidden = false;
    } catch (e) {
      mostrarErro('Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.');
    }
  });

  // Voltar: esconde o pagamento e libera o botão de novo
  voltar.addEventListener('click', function () {
    if (window.checkoutButton) {
      window.checkoutButton.unmount();
      window.checkoutButton = null;
    }
    pagamento.hidden = true;
    botao.hidden = false;
    botao.disabled = false;
    botao.removeAttribute('aria-busy');
    botao.textContent = textoBotao;
    botao.focus();
  });
});
