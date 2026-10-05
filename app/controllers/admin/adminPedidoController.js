const { validationResult } = require('express-validator');
const { comprasModel } = require("../../models/comprasModel");

// Status que um pedido pode assumir (os mesmos do <select> da tela de pedidos)
const STATUS_PEDIDO = ['confirmado', 'enviado', 'entregue', 'cancelado'];

exports.STATUS_PEDIDO = STATUS_PEDIDO;

exports.listar = async (req, res) => {
  try {
    const pedidos = await comprasModel.findAll();
    res.render('admin-pedidos', { titulo: 'Gerenciar Pedidos', pedidos });
  } catch (erro) {
    console.log(erro);
    res.redirect('/admin');
  }
};

exports.atualizarStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.session.flash = { status: 'error', text: 'Status de pedido inválido.' };
    return res.redirect('/admin/pedidos');
  }
  try {
    const { status } = req.body;
    await comprasModel.updateStatus(req.params.id, status);
    req.session.flash = { status: 'success', text: `Status do pedido #${req.params.id} atualizado para "${status}".` };
    res.redirect('/admin/pedidos');
  } catch (erro) {
    console.log(erro);
    req.session.flash = { status: 'error', text: 'Erro ao atualizar status do pedido.' };
    res.redirect('/admin/pedidos');
  }
};
