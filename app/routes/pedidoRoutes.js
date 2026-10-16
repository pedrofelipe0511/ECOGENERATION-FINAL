const express = require("express");
const router = express.Router();
const { check } = require('express-validator');
const requireLogin = require("../middlewares/requireLogin");
const pedidoController = require("../controllers/pedidoController");

// Mercado Pago Checkout Pro (material PSW3 – 20)
// POST /create-preference: cria o pedido a partir do carrinho e devolve a preferência
router.post('/create-preference', pedidoController.criarPreferencia);
// GET /feedback: retorno do Mercado Pago (back_urls)
router.get('/feedback', requireLogin, pedidoController.feedback);
// Pagar de novo um pedido pendente e aviso automático (webhook)
router.get('/pedido/:id/pagar', requireLogin, check('id').isInt({ min: 1 }), pedidoController.pagarPedido);
router.post('/pagamento/notificacao', pedidoController.notificacao);

module.exports = router;
