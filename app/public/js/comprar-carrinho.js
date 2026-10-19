// Interação do carrinho com o Mercado Pago (material PSW3 – 20: comprar-carrinho.js).
// O navegador só pede a preferência: os itens e preços são montados no servidor
// a partir do carrinho da sessão. Depois mostramos um botão que leva direto à
// página de pagamento do Checkout Pro (sem o botão/animação do SDK).
document.addEventListener('DOMContentLoaded', function () {
  var area = document.getElementById('area-checkout');
  if (!area) return; // carrinho vazio ou visitante sem login

  var botao = document.getElementById('checkout-btn');
  var erro = document.getElementById('checkout-erro');
  var pagamento = document.getElementById('container-pagamento');
  var linkPagamento = document.getElementById('link-pagamento');
  var voltar = document.getElementById('go-back');
  var textoBotao = botao.textContent;

  function liberarBotao() {
    botao.disabled = false;
    botao.removeAttribute('aria-busy');
    botao.textContent = textoBotao;
  }

  function mostrarErro(mensagem) {
    erro.textContent = mensagem;
    erro.hidden = false;
    liberarBotao();
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
      if (!resposta.ok || !dados.linkPagamento) {
        return mostrarErro(dados.erro || 'Não foi possível iniciar o pagamento. Tente novamente.');
      }

      linkPagamento.href = dados.linkPagamento;
      botao.hidden = true;
      pagamento.hidden = false;
      linkPagamento.focus();
    } catch (e) {
      mostrarErro('Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.');
    }
  });

  // Voltar: esconde o pagamento e libera o botão de novo
  voltar.addEventListener('click', function () {
    pagamento.hidden = true;
    linkPagamento.href = '#';
    botao.hidden = false;
    liberarBotao();
    botao.focus();
  });
});
