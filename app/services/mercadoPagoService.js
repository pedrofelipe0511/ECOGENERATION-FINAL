// Integração com o Mercado Pago (Checkout Pro) pelo SDK oficial "mercadopago",
// como no material PSW3 – 20: MercadoPagoConfig + Preference.
// O access token fica SÓ no servidor (variável de ambiente MP_ACCESS_TOKEN).
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { getBaseUrl } = require('../helpers/tokens');

const MINUTOS_PARA_PAGAR = 30; // depois disso a cobrança expira

// Cria o cliente uma única vez (e só quando for usado)
let cliente = null;
const obterCliente = () => {
    if (!process.env.MP_ACCESS_TOKEN) throw new Error('MP_ACCESS_TOKEN não configurado');
    if (!cliente) {
        cliente = new MercadoPagoConfig({
            accessToken: process.env.MP_ACCESS_TOKEN,
            options: { timeout: 10000 }
        });
    }
    return cliente;
};

// Cria a preferência a partir do pedido JÁ gravado no banco:
// itens, quantidades e preços vêm do pedido, nunca do navegador.
const criarPreferencia = async (pedido) => {
    const base = getBaseUrl();
    const ehHttps = base.startsWith('https://');
    const retorno = `${base}/feedback`;

    const body = {
        items: pedido.itens.map((item) => ({
            id: String(item.id_produto),
            title: item.nome_produto,
            quantity: Number(item.quantidade || 1),
            unit_price: Number(item.preco_unitario ?? item.preco_produto),
            currency_id: 'BRL'
        })),
        external_reference: String(pedido.id_pedido), // liga o pagamento ao nosso pedido
        back_urls: { success: retorno, failure: retorno, pending: retorno },
        statement_descriptor: 'ECOGENERATION',
        expires: true,
        expiration_date_to: new Date(Date.now() + MINUTOS_PARA_PAGAR * 60 * 1000).toISOString()
    };
    // O retorno automático e o aviso (webhook) exigem endereço público com HTTPS
    if (ehHttps) body.auto_return = 'approved';
    if (ehHttps && !base.includes('.app.github.dev')) body.notification_url = `${base}/pagamento/notificacao`;

    const preferencia = await new Preference(obterCliente()).create({
        body,
        requestOptions: { idempotencyKey: `pedido-${pedido.id_pedido}` }
    });
    return { id: preferencia.id, linkPagamento: preferencia.init_point };
};

// Consulta o pagamento DIRETO na API: é a única fonte confiável do status
// (os parâmetros que voltam na URL podem ser alterados por qualquer pessoa).
const buscarPagamento = async (idPagamento) => {
    const pagamento = await new Payment(obterCliente()).get({ id: String(idPagamento) });
    return {
        id: String(pagamento.id),
        status: pagamento.status, // approved, pending, in_process, rejected, cancelled...
        detalhe: pagamento.status_detail,
        idPedido: parseInt(pagamento.external_reference, 10),
        valor: Number(pagamento.transaction_amount)
    };
};

// Link para pagar (ou tentar de novo) um pedido pendente
const linkDaPreferencia = (idPreferencia) =>
    `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${encodeURIComponent(idPreferencia)}`;

module.exports = { criarPreferencia, buscarPagamento, linkDaPreferencia, MINUTOS_PARA_PAGAR };
