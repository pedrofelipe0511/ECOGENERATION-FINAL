const { validationResult } = require('express-validator');
const { adminModel } = require("../../models/adminModel");
const { comprasModel } = require("../../models/comprasModel");

exports.listar = async (req, res) => {
  try {
    const usuarios = await adminModel.getAllUsuarios();
    const pedidos = await comprasModel.findAll();
    res.render('admin-usuarios', { titulo: 'Gerenciar Usuários', usuarios, pedidos });
  } catch (erro) {
    console.log(erro);
    res.redirect('/admin');
  }
};

exports.deletar = async (req, res) => {
  if (!validationResult(req).isEmpty()) return res.redirect('/admin/usuarios');
  try {
    await adminModel.deleteUsuario(req.params.id);
    req.session.flash = { status: 'success', text: 'Usuário removido com sucesso.' };
    res.redirect('/admin/usuarios');
  } catch (erro) {
    console.log(erro);
    req.session.flash = { status: 'error', text: 'Erro ao remover usuário.' };
    res.redirect('/admin/usuarios');
  }
};
