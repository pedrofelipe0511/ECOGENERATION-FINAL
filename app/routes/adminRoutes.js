const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const adminAuth = require('../middlewares/adminAuth');
const upload = require('../middlewares/upload');
const { STATUS_PEDIDO } = require('../controllers/admin/adminPedidoController');

// Upload da imagem do produto com erro amigável (em vez de página de erro)
const uploadImagemProduto = (req, res, next) => {
  upload.single('imagem')(req, res, (erro) => {
    if (erro) {
      req.session.flash = { status: 'error', text: 'Imagem inválida ou maior que 5 MB.' };
      return res.redirect(req.params.id ? `/admin/produtos/${req.params.id}/editar` : '/admin/produtos/novo');
    }
    next();
  });
};

// Regras de validação do produto (rodam depois do Multer: o corpo é multipart)
const regrasProduto = [
  check('nome').trim().notEmpty().withMessage('Informe o nome do produto.')
    .isLength({ max: 100 }).withMessage('O nome deve ter no máximo 100 caracteres.'),
  check('categoria').isIn(['entrada', 'medio', 'avancado']).withMessage('Categoria inválida.'),
  check('preco').isFloat({ min: 0.01, max: 99999999 }).withMessage('Informe um preço válido.').toFloat(),
  check('descricao').trim().optional({ checkFalsy: true })
    .isLength({ max: 255 }).withMessage('A descrição deve ter no máximo 255 caracteres.'),
  check('estoque').isInt({ min: 0 }).withMessage('O estoque deve ser um número inteiro a partir de 0.').toInt(),
  check('tipo_energia').optional({ checkFalsy: true })
    .isIn(['bateria', 'bateria_usb', 'luz', 'ventilador', 'painel']).withMessage('Tipo de energia inválido.'),
  check('capacidade_energia').custom((valor, { req }) => {
    if (!['bateria', 'bateria_usb', 'luz', 'ventilador'].includes(req.body.tipo_energia)) return true;
    const numero = Number(valor);
    return valor !== '' && valor !== undefined && Number.isFinite(numero) && numero > 0 && numero <= 99999;
  }).withMessage('Informe a capacidade (Wh para baterias, horas para lâmpadas e ventiladores).'),
];

const regraId = check('id').isInt({ min: 1 });

const adminAuthController = require('../controllers/admin/adminAuthController');
const adminDashboardController = require('../controllers/admin/adminDashboardController');
const adminUsuarioController = require('../controllers/admin/adminUsuarioController');
const adminDiagnosticoController = require('../controllers/admin/adminDiagnosticoController');
const adminPedidoController = require('../controllers/admin/adminPedidoController');
const adminProdutoController = require('../controllers/admin/adminProdutoController');

// LOGIN / LOGOUT
router.get('/admin-login', adminAuthController.loginForm);
router.post('/admin-login', adminAuthController.loginSubmit);
router.get('/admin-logout', adminAuthController.logout);

// DASHBOARD
router.get('/admin', adminAuth, adminDashboardController.dashboard);

// Exclusões e alterações usam POST: com o cookie de sessão "sameSite: lax",
// outro site não consegue disparar essas ações com um simples link.

// USUÁRIOS
router.get('/admin/usuarios', adminAuth, adminUsuarioController.listar);
router.post('/admin/usuarios/deletar/:id', adminAuth, regraId, adminUsuarioController.deletar);

// DIAGNÓSTICOS
router.get('/admin/diagnosticos', adminAuth, adminDiagnosticoController.listar);
router.post('/admin/diagnosticos/deletar/:id', adminAuth, regraId, adminDiagnosticoController.deletar);

// PEDIDOS
router.get('/admin/pedidos', adminAuth, adminPedidoController.listar);
router.post('/admin/pedidos/:id/status', adminAuth,
  [regraId, check('status').isIn(STATUS_PEDIDO)],
  adminPedidoController.atualizarStatus
);

// PRODUTOS
router.get('/admin/produtos', adminAuth, adminProdutoController.listar);
router.get('/admin/produtos/novo', adminAuth, adminProdutoController.novoForm);
router.post('/admin/produtos', adminAuth, uploadImagemProduto, regrasProduto, adminProdutoController.criar);
router.get('/admin/produtos/:id/editar', adminAuth, adminProdutoController.editarForm);
router.post('/admin/produtos/:id', adminAuth, uploadImagemProduto, [regraId, ...regrasProduto], adminProdutoController.atualizar);
router.post('/admin/produtos/:id/deletar', adminAuth, regraId, adminProdutoController.deletar);

module.exports = router;
