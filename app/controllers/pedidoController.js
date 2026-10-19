const { carrinho } = require('../models/carrinho');
const { pedidosModel } = require('../models/pedidosModel');
const { carrinhoSalvoModel } = require('../models/carrinhoSalvoModel');
const { criarPreferencia, buscarPagamento, linkDaPreferencia } = require('../services/mercadoPagoService');

// ── PREPARAR O PAGAMENTO ───────────────────────────────────────
// Reaproveita um pedido pendente idêntico ou cria um novo (reservando o
// estoque) e gera a preferência no Mercado Pago. Itens e quantidades vêm do
// carrinho NA SESSÃO, e os preços do banco — nunca do corpo da requisição.
const prepararPagamento = async (idUsuario, itensPedido) => {
    const pendente = await pedidosModel.findPendenteRecente(idUsuario, itensPedido, 10);
    if (pendente) return { pedido: pendente, preferenceId: pendente.id_preferencia };

    const pedido = await pedidosModel.criarComReserva(idUsuario, itensPedido);
    if (!pedido) return { status: 409, erro: 'Um dos produtos esgotou enquanto você comprava. Confira o carrinho.' };
    try {
        const preferencia = await criarPreferencia(pedido);
        await pedidosModel.definirPreferencia(pedido.id_pedido, preferencia.id);
        return { pedido, preferenceId: preferencia.id };
    } catch (erro) {
        // Sem preferência criada, o pedido não serve: cancela e devolve o estoque
        // O SDK devolve o erro da API (status e causa): ajuda a achar o motivo nos logs
        console.log('Erro ao criar a preferência no Mercado Pago:', erro.message,
            JSON.stringify({ status: erro.status, erro: erro.error, causa: erro.cause }));
        await pedidosModel.cancelarEDevolverEstoque(pedido.id_pedido);
        return { status: 503, erro: 'O pagamento está indisponível no momento. Tente novamente em instantes.' };
    }
};

// Cliques repetidos chegam como requisições simultâneas: a segunda espera a
// primeira terminar e recebe a MESMA preferência, sem criar outro pedido.
const pagamentosEmAndamento = new Map();

// ===== POST /create-preference =====
// Chamado pelo comprar-carrinho.js; responde JSON com o id da preferência,
// usado no navegador para mostrar o botão do Mercado Pago (Wallet Brick).
exports.criarPreferencia = async (req, res) => {
    if (!req.session.usuarioLogado) return res.status(401).json({ erro: 'Entre na sua conta para finalizar a compra.' });
    try {
        const { itens, avisos } = await carrinho.atualizarCarrinho(req.session);
        if (!itens.length) return res.status(400).json({ erro: 'Seu carrinho está vazio.' });
        if (avisos.length) {
            // O carrinho mudou (preço/estoque): a pessoa precisa revisar antes de pagar
            req.session.flash = { status: 'warning', text: avisos.join(' ') };
            return req.session.save(() => res.status(409).json({ erro: 'Seu carrinho foi atualizado. Confira antes de pagar.', recarregar: true }));
        }

        const itensPedido = itens.map((i) => ({ id_produto: i.codproduto, quantidade: i.qtde }));
        const chave = `${req.session.usuarioId}:` + itensPedido.map((i) => `${i.id_produto}x${i.quantidade}`).sort().join(',');
        if (!pagamentosEmAndamento.has(chave)) {
            pagamentosEmAndamento.set(chave,
                prepararPagamento(req.session.usuarioId, itensPedido).finally(() => pagamentosEmAndamento.delete(chave)));
        }
        const resultado = await pagamentosEmAndamento.get(chave);
        if (resultado.erro) return res.status(resultado.status).json({ erro: resultado.erro });
        res.json({
            preferenceId: resultado.preferenceId,
            linkPagamento: linkDaPreferencia(resultado.preferenceId), // página de pagamento do Checkout Pro
            pedido: resultado.pedido.id_pedido
        });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ erro: 'Não foi possível iniciar o pagamento. Tente novamente.' });
    }
};

// ── CONFIRMAR O PAGAMENTO NA API ───────────────────────────────
const aplicarPagamento = async (pagamento) => {
    const pedido = await pedidosModel.findById(pagamento.idPedido);
    if (!pedido) return null;

    if (pagamento.status === 'approved') {
        // RN: só marca como pago se o valor pago for o valor do pedido
        if (Math.abs(pagamento.valor - Number(pedido.total_pedido)) > 0.01) {
            console.log(`Pagamento ${pagamento.id} com valor diferente do pedido #${pedido.id_pedido}`);
            return pedido;
        }
        const acabouDePagar = await pedidosModel.marcarPago(pedido.id_pedido, pagamento.id, pagamento.status);
        // Compra paga: os produtos dela saem do carrinho salvo na conta
        // (vale também quando a confirmação chega pelo aviso do Mercado Pago)
        if (acabouDePagar) await carrinhoSalvoModel.removerItensDoPedido(pedido.id_pedido);
    } else if (['cancelled', 'refunded', 'charged_back'].includes(pagamento.status)) {
        await pedidosModel.cancelarEDevolverEstoque(pedido.id_pedido, pagamento.status, pagamento.id);
    } else {
        // pending, in_process ou rejected: a pessoa ainda pode pagar (ou tentar outro cartão)
        await pedidosModel.registrarPagamentoPendente(pedido.id_pedido, pagamento.id, pagamento.status);
    }
    return pedidosModel.findById(pedido.id_pedido);
};

// ===== GET /feedback =====
// Para onde o Mercado Pago devolve a pessoa (back_urls). Os parâmetros da URL
// só dizem ONDE olhar: o status do pagamento vem da consulta à API.
exports.feedback = async (req, res) => {
    const idPedido = parseInt(req.query.external_reference, 10);
    const idPagamento = req.query.payment_id || req.query.collection_id;
    try {
        let pedido = Number.isInteger(idPedido) ? await pedidosModel.findById(idPedido) : null;
        // Só o dono do pedido vê esta página
        if (!pedido || pedido.id_usuario !== req.session.usuarioId) return res.redirect('/perfil');

        if (idPagamento && idPagamento !== 'null') {
            const pagamento = await buscarPagamento(idPagamento);
            if (pagamento.idPedido === pedido.id_pedido) pedido = await aplicarPagamento(pagamento);
        }

        // Pagamento aprovado ou em análise: o pedido está feito, o carrinho esvazia
        if (pedido.status_pedido === 'pago' || ['pending', 'in_process'].includes(pedido.status_pagamento)) {
            await carrinho.esvaziar(req.session);
            res.locals.qtdeCarrinho = 0; // o cabeçalho desta página já mostra o carrinho vazio
        }

        req.session.save(() => res.render('pagamento', {
            titulo: 'Pagamento',
            pedido,
            linkPagar: pedido.status_pedido === 'aguardando_pagamento' && pedido.id_preferencia ? linkDaPreferencia(pedido.id_preferencia) : null
        }));
    } catch (erro) {
        console.log('Erro no retorno do pagamento:', erro.message);
        req.session.flash = { status: 'warning', text: 'Não conseguimos confirmar o pagamento agora. Veja o status em "Meus pedidos" em instantes.' };
        req.session.save(() => res.redirect('/perfil#minhas-compras'));
    }
};

// ===== PAGAR DE NOVO UM PEDIDO PENDENTE (link em "Meus pedidos") =====
exports.pagarPedido = async (req, res) => {
    try {
        const pedido = await pedidosModel.findById(parseInt(req.params.id, 10));
        if (!pedido || pedido.id_usuario !== req.session.usuarioId || pedido.status_pedido !== 'aguardando_pagamento' || !pedido.id_preferencia) {
            req.session.flash = { status: 'warning', text: 'Este pedido não pode mais ser pago. Faça uma nova compra.' };
            return req.session.save(() => res.redirect('/perfil#minhas-compras'));
        }
        res.redirect(linkDaPreferencia(pedido.id_preferencia));
    } catch (erro) {
        console.log(erro);
        res.redirect('/perfil#minhas-compras');
    }
};

// ===== AVISO AUTOMÁTICO DO MERCADO PAGO (webhook) =====
// Funciona quando o site está num endereço público (Render). O aviso só
// diz qual pagamento mudou; o status é sempre conferido na API.
exports.notificacao = async (req, res) => {
    res.sendStatus(200); // responde logo, o Mercado Pago não espera o processamento
    const tipo = req.body?.type || req.query.type || req.query.topic;
    const idPagamento = req.body?.data?.id || req.query['data.id'] || req.query.id;
    if (tipo !== 'payment' || !idPagamento) return;
    try {
        await aplicarPagamento(await buscarPagamento(idPagamento));
    } catch (erro) {
        console.log('Erro ao processar aviso do Mercado Pago:', erro.message);
    }
};
