const { validationResult } = require('express-validator');
const { pedidosModel, STATUS_PEDIDO, ROTULO_STATUS, ROTULO_PAGAMENTO } = require("../../models/pedidosModel");

exports.STATUS_PEDIDO = STATUS_PEDIDO;

exports.listar = async (req, res) => {
  try {
    const pedidos = await pedidosModel.findAll();
    res.render('admin-pedidos', { titulo: 'Gerenciar Pedidos', pedidos, statusPedido: STATUS_PEDIDO, rotuloStatus: ROTULO_STATUS, rotuloPagamento: ROTULO_PAGAMENTO });
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
    await pedidosModel.atualizarStatus(req.params.id, status);
    req.session.flash = { status: 'success', text: `Status do pedido #${req.params.id} atualizado para "${ROTULO_STATUS[status]}".` };
    res.redirect('/admin/pedidos');
  } catch (erro) {
    console.log(erro);
    req.session.flash = { status: 'error', text: 'Erro ao atualizar status do pedido.' };
    res.redirect('/admin/pedidos');
  }
};
