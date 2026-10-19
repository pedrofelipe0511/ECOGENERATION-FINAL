const { validationResult } = require('express-validator');
const { carrinho } = require('../models/carrinho');
const { usuariosModel } = require('../models/usuariosModel');
const { consultarCep } = require('./userController');

// Volta para a página de onde a pessoa veio (só se for do próprio site)
const voltar = (req, res, padrao = '/carrinho') => {
    let destino = padrao;
    try {
        const origem = new URL(req.get('Referer') || '');
        if (origem.host === req.get('host')) destino = origem.pathname + origem.search;
    } catch (erro) { /* sem Referer válido: usa o padrão */ }
    req.session.save(() => res.redirect(destino));
};

const avisar = (req, status, text) => { req.session.flash = { status, text }; };

// ===== LISTAR CARRINHO =====
exports.listar = async (req, res) => {
    try {
        const { itens, total, avisos } = await carrinho.atualizarCarrinho(req.session);
        let entrega = null;
        if (req.session.usuarioLogado) {
            const usuarios = await usuariosModel.findById(req.session.usuarioId);
            entrega = { usuario: usuarios[0], endereco: null, erroCep: false };
            try { entrega.endereco = await consultarCep(entrega.usuario.cep_usuario); } catch (erro) { entrega.erroCep = true; }
        }
        res.render('listar-carrinho', {
            titulo: 'Meu Carrinho',
            itens,
            total,
            avisos,
            entrega
        });
    } catch (erro) {
        console.log(erro);
        avisar(req, 'error', 'Não foi possível abrir o carrinho agora.');
        req.session.save(() => res.redirect('/ecoloja'));
    }
};

// ===== ADICIONAR (1 unidade, ou "qtde") =====
exports.adicionar = async (req, res) => {
    if (!validationResult(req).isEmpty()) return voltar(req, res, '/ecoloja');
    try {
        const resultado = await carrinho.addItem(req.session, req.body.id, req.body.qtde || 1);
        if (resultado.erro) {
            avisar(req, 'warning', resultado.erro);
        } else {
            avisar(req, 'success', `"${resultado.produto.nome_produto}" foi adicionado ao carrinho.`);
            if (req.body.ir === 'carrinho') return req.session.save(() => res.redirect('/carrinho'));
        }
        voltar(req, res, '/ecoloja');
    } catch (erro) {
        console.log(erro);
        avisar(req, 'error', 'Não foi possível adicionar ao carrinho.');
        voltar(req, res, '/ecoloja');
    }
};

// ===== ADICIONAR O KIT DO DIAGNÓSTICO (vários produtos de uma vez) =====
exports.adicionarKit = async (req, res) => {
    if (!validationResult(req).isEmpty()) return voltar(req, res, '/diagnostico');
    try {
        const ids = [...new Set(req.body.item)];
        const erros = [];
        for (const id of ids) {
            const resultado = await carrinho.addItem(req.session, id, 1);
            if (resultado.erro) erros.push(resultado.erro);
        }
        if (erros.length) avisar(req, 'warning', erros.join(' '));
        else avisar(req, 'success', 'Kit adicionado ao carrinho.');
        req.session.save(() => res.redirect('/carrinho'));
    } catch (erro) {
        console.log(erro);
        avisar(req, 'error', 'Não foi possível adicionar o kit ao carrinho.');
        voltar(req, res, '/diagnostico');
    }
};

// ===== DIMINUIR 1 UNIDADE =====
exports.diminuir = async (req, res) => {
    try {
        if (validationResult(req).isEmpty()) await carrinho.removeItem(req.session, req.body.id, 1);
    } catch (erro) {
        console.log(erro);
        avisar(req, 'error', 'Não foi possível alterar o carrinho agora.');
    }
    voltar(req, res);
};

// ===== REMOVER O ITEM INTEIRO =====
exports.remover = async (req, res) => {
    try {
        if (validationResult(req).isEmpty()) {
            await carrinho.excluirItem(req.session, req.body.id);
            avisar(req, 'success', 'Item removido do carrinho.');
        }
    } catch (erro) {
        console.log(erro);
        avisar(req, 'error', 'Não foi possível alterar o carrinho agora.');
    }
    voltar(req, res);
};
