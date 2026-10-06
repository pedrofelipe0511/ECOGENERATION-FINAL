const bcrypt = require("bcryptjs");
const { validationResult } = require('express-validator');
const { usuariosModel } = require("../models/usuariosModel");
const { diagnosticosModel } = require("../models/diagnosticosModel");
const { comprasModel } = require("../models/comprasModel");
const { regenerarSessao, salvarSessao, CHAVES_ADMIN } = require('../helpers/sessao');
const { removerArquivo } = require('../helpers/imagens');
const path = require('path');
const perfilDir = path.join(__dirname, '../public/imagens/perfil');

const consultarCep = async (cep) => {
    const numeros = String(cep || '').replace(/\D/g, '');
    if (numeros.length !== 8) return null;
    const response = await fetch(`https://viacep.com.br/ws/${numeros}/json/`);
    if (!response.ok) throw new Error('ViaCEP indisponível');
    const dados = await response.json();
    return dados.erro ? null : dados;
};

// Histórico no perfil: quantos itens por página em cada lista
const ITENS_POR_PAGINA = 3;

// Busca uma página de uma lista do usuário. A página pedida na URL é
// ajustada para ficar entre 1 e a última página existente.
const paginar = async (model, idUsuario, paginaPedida) => {
    const total = await model.countByUsuario(idUsuario);
    const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
    const pagina = Math.min(Math.max(1, parseInt(paginaPedida, 10) || 1), totalPaginas);
    const itens = await model.findByUsuarioPaginado(idUsuario, ITENS_POR_PAGINA, (pagina - 1) * ITENS_POR_PAGINA);
    return { itens, pagina, totalPaginas, total };
};

// ===== PERFIL DO USUÁRIO =====
// ?pc= página das compras | ?pd= página dos diagnósticos
exports.perfil = async (req, res) => {
    try {
        const usuarios = await usuariosModel.findById(req.session.usuarioId);
        const usuario = usuarios[0];
        const paginaCompras = await paginar(comprasModel, req.session.usuarioId, req.query.pc);
        const paginaDiagnosticos = await paginar(diagnosticosModel, req.session.usuarioId, req.query.pd);
        let endereco = null;
        let erroCep = false;
        try { endereco = await consultarCep(usuario.cep_usuario); } catch (erro) { erroCep = true; }
        res.render('perfil', {
            titulo: 'Meu Perfil',
            usuario,
            diagnosticos: paginaDiagnosticos.itens,
            compras: paginaCompras.itens,
            paginaCompras,
            paginaDiagnosticos,
            itensPorPagina: ITENS_POR_PAGINA,
            endereco,
            erroCep
        });
    } catch (erro) {
        console.log(erro);
        res.redirect('/');
    }
};

exports.atualizarPerfil = async (req, res) => {
    const id = req.session.usuarioId;

    // Qualquer saída sem sucesso descarta a imagem recém-enviada (evita arquivo órfão)
    const voltarComErro = (texto) => {
        if (req.file) removerArquivo(req.file.path);
        req.session.flash = { status: 'error', text: texto };
        return res.redirect('/perfil');
    };

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return voltarComErro(errors.array()[0].msg);
    }

    try {
        const nome = req.body.nome;
        const telefone = req.body.telefone;
        const cep = req.body.cep;
        const senhaAtual = String(req.body.senha_atual || '');
        const senha = String(req.body.senha || '');

        const desejaAlterarSenha = Boolean(senhaAtual || senha);
        if (desejaAlterarSenha) {
            if (!senhaAtual || !senha) {
                return voltarComErro('Para alterar a senha, informe a senha atual, a nova senha e a confirmação.');
            }
            const hashAtual = await usuariosModel.findPasswordById(id);
            if (typeof hashAtual !== 'string' || !(await bcrypt.compare(senhaAtual, hashAtual))) {
                return voltarComErro('Senha atual incorreta.');
            }
        }

        const usuarios = await usuariosModel.findById(id);
        if (!usuarios[0]) {
            if (req.file) removerArquivo(req.file.path);
            return res.redirect('/login');
        }
        const imagemAnterior = usuarios[0].imagem_perfil_usuario;
        const imagem = req.file ? `imagens/perfil/${req.file.filename}` : undefined;
        const dadosAtualizacao = {
            nome,
            telefone: telefone || null,
            cep: cep || null,
            numero: req.body.numero || null,
            complemento: req.body.complemento || null,
            imagem
        };

        if (desejaAlterarSenha) {
            dadosAtualizacao.senha = senha;
        }

        await usuariosModel.update(id, dadosAtualizacao);
        // Remove a imagem antiga (só se for uma foto de perfil deste usuário)
        if (req.file && imagemAnterior && imagemAnterior.startsWith(`imagens/perfil/perfil_${id}_`)) {
            const caminho = path.join(perfilDir, path.basename(imagemAnterior));
            if (caminho.startsWith(perfilDir)) removerArquivo(caminho);
        }
        req.session.usuarioNome = nome;
        req.session.flash = { status: 'success', text: 'Perfil atualizado com sucesso.' };
        req.session.save(() => res.redirect('/perfil'));
    } catch (erro) {
        console.log(erro);
        return voltarComErro('Erro ao atualizar o perfil. Verifique os dados e tente novamente.');
    }
};

// ===== EXCLUIR CONTA =====
exports.excluirConta = async (req, res) => {
    try {
        await usuariosModel.delete(req.session.usuarioId);
        // Sessão nova, sem o usuário — e o flash sobrevive para a próxima página
        await regenerarSessao(req, CHAVES_ADMIN);
        req.session.flash = { status: 'success', text: 'Sua conta foi removida com sucesso.' };
        await salvarSessao(req);
        res.redirect('/login');
    } catch (erro) {
        console.log(erro);
        req.session.flash = { status: 'error', text: 'Erro ao excluir conta. Tente novamente.' };
        res.redirect('/perfil');
    }
};

exports.consultarCep = consultarCep;
