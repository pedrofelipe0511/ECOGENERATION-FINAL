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
