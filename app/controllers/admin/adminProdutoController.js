const path = require('path');
const { validationResult } = require('express-validator');
const { adminModel } = require("../../models/adminModel");
const { removerArquivo } = require('../../helpers/imagens');

const pastaImagens = path.join(__dirname, '../../public/imagens');

// Tipo de energia e capacidade usados pelo kit do diagnóstico.
// Painel e "não entra no kit" não usam capacidade.
const TIPOS_COM_CAPACIDADE = ['bateria', 'bateria_usb', 'luz', 'ventilador'];
const dadosEnergia = (body) => {
  const tipoEnergia = body.tipo_energia || null;
  const capacidadeEnergia = TIPOS_COM_CAPACIDADE.includes(tipoEnergia) ? Number(body.capacidade_energia) : null;
  return { tipoEnergia, capacidadeEnergia };
};

// Só apaga imagens enviadas pelo painel (produto_*); as imagens originais do
// projeto podem ser usadas em outras páginas e nunca são removidas.
const removerImagemProduto = (nomeArquivo) => {
  if (nomeArquivo && path.basename(nomeArquivo).startsWith('produto_')) {
    removerArquivo(path.join(pastaImagens, path.basename(nomeArquivo)));
  }
};

// Volta ao formulário com a primeira mensagem de erro e descarta o upload
const voltarComErros = (req, res, errors, destino) => {
  if (req.file) removerArquivo(req.file.path);
  req.session.flash = { status: 'error', text: errors.array()[0].msg || 'Dados inválidos.' };
  res.redirect(destino);
};

exports.listar = async (req, res) => {
  try {
    const produtos = await adminModel.getAllProdutos();
    res.render('admin-produtos', { titulo: 'Gerenciar Produtos', produtos });
  } catch (erro) {
    console.log(erro);
    res.redirect('/admin');
  }
};

exports.novoForm = (req, res) => {
  res.render('admin-produto-editar', {
    titulo: 'Novo Produto',
    produto: null,
    isNovo: true
  });
};

exports.criar = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return voltarComErros(req, res, errors, '/admin/produtos/novo');
  try {
    const { nome, categoria, preco, descricao, estoque } = req.body;
    const imagem = req.file ? req.file.filename : null;
    await adminModel.addProduto({ nome, categoria, preco, descricao, estoque, imagem, ...dadosEnergia(req.body) });
    req.session.flash = { status: 'success', text: `Produto "${nome}" criado com sucesso!` };
    res.redirect('/admin/produtos');
  } catch (erro) {
    console.log(erro);
    if (req.file) removerArquivo(req.file.path);
    req.session.flash = { status: 'error', text: 'Erro ao criar produto. Tente novamente.' };
    res.redirect('/admin/produtos');
  }
};

exports.editarForm = async (req, res) => {
  try {
    const produto = await adminModel.getProduto(req.params.id);
    if (!produto) return res.redirect('/admin/produtos');
    res.render('admin-produto-editar', { titulo: 'Editar Produto', produto, isNovo: false });
  } catch (erro) {
    console.log(erro);
    res.redirect('/admin/produtos');
  }
};

exports.atualizar = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return voltarComErros(req, res, errors, `/admin/produtos/${req.params.id}/editar`);
  try {
    const { nome, categoria, preco, descricao, estoque } = req.body;
    const imagem = req.file ? req.file.filename : null;
    const anterior = await adminModel.getProduto(req.params.id);
    if (!anterior) {
      if (req.file) removerArquivo(req.file.path);
      return res.redirect('/admin/produtos');
    }
    await adminModel.updateProduto(req.params.id, { nome, categoria, preco, descricao, estoque, imagem, ...dadosEnergia(req.body) });
    if (imagem && anterior.imagem_produto !== imagem) removerImagemProduto(anterior.imagem_produto);
    req.session.flash = { status: 'success', text: `Produto "${nome}" atualizado com sucesso!` };
    res.redirect('/admin/produtos');
  } catch (erro) {
    console.log(erro);
    if (req.file) removerArquivo(req.file.path);
    req.session.flash = { status: 'error', text: 'Erro ao atualizar produto. Tente novamente.' };
    res.redirect('/admin/produtos');
  }
};

exports.deletar = async (req, res) => {
  if (!validationResult(req).isEmpty()) return res.redirect('/admin/produtos');
  try {
    await adminModel.deleteProduto(req.params.id);
    req.session.flash = { status: 'success', text: 'Produto removido com sucesso.' };
    res.redirect('/admin/produtos');
  } catch (erro) {
    console.log(erro);
    req.session.flash = { status: 'error', text: 'Erro ao remover produto. Tente novamente.' };
    res.redirect('/admin/produtos');
  }
};
