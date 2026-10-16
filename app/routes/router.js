// Orquestrador: junta todas as rotas da aplicação em um só lugar.
// A lógica de cada uma fica nos controllers (app/controllers) — este
// arquivo só define QUAIS rotas existem e QUEM cuida de cada uma.
const express = require("express");
const router = express.Router();

router.use('/', require('./produtoRoutes'));
router.use('/', require('./authRoutes'));
router.use('/', require('./userRoutes'));
router.use('/', require('./carrinhoRoutes'));
router.use('/', require('./pedidoRoutes'));
router.use('/', require('./diagnosticoRoutes'));
router.use('/', require('./adminRoutes'));

module.exports = router;
