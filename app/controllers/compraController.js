const { validationResult } = require('express-validator');
const { produtosModel } = require("../models/produtosModel");
const { comprasModel } = require("../models/comprasModel");
const { usuariosModel } = require("../models/usuariosModel");
const { consultarCep } = require('./userController');

// ===== CONFIRMAR COMPRA (tela) =====
exports.confirmarCompraForm = async (req, res) => {
    try {
        const resultados = await produtosModel.findById(req.params.id);
        if (!resultados || resultados.length === 0) {
            return res.redirect('/ecoloja');
        }
        const produto = resultados[0];
        if (produto.estoque_produto <= 0) {
            req.session.flash = { status: 'warning', text: 'Este produto está esgotado no momento.' };
            return req.session.save(() => res.redirect(`/produto/${produto.id_produto}`));
        }
        const usuarios = await usuariosModel.findById(req.session.usuarioId);
        const usuario = usuarios[0];
        let endereco = null;
        let erroCep = false;
        try {
            endereco = await consultarCep(usuario.cep_usuario);
        } catch (erroCepApi) {
            erroCep = true;
        }
        res.render('confirmar-compra', { titulo: 'Confirmar Compra', produto, usuario, endereco, erroCep });
    } catch (erro) {
        console.log(erro);
        res.redirect('/ecoloja');
    }
};

// ===== PROCESSAR COMPRA =====
exports.confirmarCompraSubmit = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.session.flash = { status: 'error', text: 'Selecione uma forma de pagamento válida.' };
        return req.session.save(() => res.redirect(`/confirmar-compra/${req.params.id}`));
    }
    try {
        // Regra de negócio no Model: baixa o estoque e grava a compra numa transação
        const compra = await comprasModel.createComBaixaEstoque(req.session.usuarioId, req.params.id);
        if (!compra) {
            req.session.flash = { status: 'warning', text: 'Este produto esgotou ou não está mais disponível.' };
            return req.session.save(() => res.redirect('/ecoloja'));
        }

        // Guarda o id da compra na sessão para exibir na página de sucesso
        req.session.ultimaCompraId = compra.id_compra;
        req.session.ultimaCompraProduto = compra.nome_produto;
        req.session.ultimaCompraPreco = compra.preco_produto;
        req.session.flash = { status: 'success', text: 'Compra realizada com sucesso!' };

        req.session.save(() => res.redirect('/compra-sucesso'));
    } catch (erro) {
        console.log(erro);
        req.session.flash = { status: 'error', text: 'Não foi possível concluir a compra. Tente novamente.' };
        req.session.save(() => res.redirect('/ecoloja'));
    }
};

// ===== KIT DO DIAGNÓSTICO =====
// Os ids vêm da URL/formulário (?item=4&item=6); preço, nome e estoque
// são sempre lidos do banco, nunca do navegador.
const idsDoKit = (valor) => [...new Set([].concat(valor || []).map((id) => parseInt(id, 10)))];

const buscarProdutosDoKit = async (ids) => {
    const produtos = [];
    for (const id of ids) {
        const resultados = await produtosModel.findById(id);
        if (!resultados || resultados.length === 0 || resultados[0].estoque_produto <= 0) return null;
        produtos.push(resultados[0]);
    }
    return produtos;
};

const kitIndisponivel = (req, res) => {
    req.session.flash = { status: 'warning', text: 'Um dos produtos do kit esgotou ou não está mais disponível. Refaça o diagnóstico para ver um novo kit.' };
    return req.session.save(() => res.redirect('/diagnostico'));
};

// ===== CONFIRMAR KIT (tela) =====
exports.confirmarKitForm = async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.redirect('/diagnostico');
    try {
        const produtos = await buscarProdutosDoKit(idsDoKit(req.query.item));
        if (!produtos) return kitIndisponivel(req, res);

        const usuarios = await usuariosModel.findById(req.session.usuarioId);
        const usuario = usuarios[0];
        let endereco = null;
        let erroCep = false;
        try {
            endereco = await consultarCep(usuario.cep_usuario);
        } catch (erroCepApi) {
            erroCep = true;
        }
        const total = produtos.reduce((soma, p) => soma + Number(p.preco_produto), 0);
        res.render('confirmar-kit', { titulo: 'Confirmar Kit', produtos, total, usuario, endereco, erroCep });
    } catch (erro) {
        console.log(erro);
        res.redirect('/diagnostico');
    }
};

// ===== PROCESSAR KIT =====
exports.confirmarKitSubmit = async (req, res) => {
    const ids = idsDoKit(req.body.item);
    if (!validationResult(req).isEmpty()) {
        req.session.flash = { status: 'error', text: 'Selecione uma forma de pagamento válida.' };
        const query = ids.map((id) => `item=${id}`).join('&');
        return req.session.save(() => res.redirect(`/confirmar-kit?${query}`));
    }
    try {
        // Regra de negócio no Model: todos os itens ou nenhum, numa transação
        const compras = await comprasModel.createKitComBaixaEstoque(req.session.usuarioId, ids);
        if (!compras) return kitIndisponivel(req, res);

        const total = compras.reduce((soma, c) => soma + Number(c.preco_produto), 0);
        req.session.ultimaCompraId = compras.map((c) => c.id_compra).join(', #');
        req.session.ultimaCompraProduto = 'Kit: ' + compras.map((c) => c.nome_produto).join(' + ');
        req.session.ultimaCompraPreco = total.toFixed(2);
        req.session.flash = { status: 'success', text: 'Kit comprado com sucesso!' };
        req.session.save(() => res.redirect('/compra-sucesso'));
    } catch (erro) {
        console.log(erro);
        req.session.flash = { status: 'error', text: 'Não foi possível concluir a compra do kit. Tente novamente.' };
        req.session.save(() => res.redirect('/diagnostico'));
    }
};

// ===== COMPRA SUCESSO =====
exports.compraSucesso = (req, res) => {
    const nomeProduto = req.session.ultimaCompraProduto || 'Produto';
    const precoProduto = req.session.ultimaCompraPreco || '0.00';
    const compraId = req.session.ultimaCompraId || '---';
    res.render('compra-sucesso', {
        titulo: 'Compra Realizada!',
        nomeProduto,
        precoProduto,
        compraId
    });
};
