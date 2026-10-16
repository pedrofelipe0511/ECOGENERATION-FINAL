const { adminModel } = require("../../models/adminModel");
const { pedidosModel } = require("../../models/pedidosModel");

exports.dashboard = async (req, res) => {
  try {
    const totalUsuarios = await adminModel.countUsuarios();
    const totalDiagnosticos = await adminModel.countDiagnosticos();
    const totalProdutos = await adminModel.countProdutos();
    const totalPedidos = await pedidosModel.countAll();

    const usuariosRecentes = await adminModel.getUsuariosRecentes();
    const diagnosticosRecentes = await adminModel.getDiagnosticosRecentes();
    const produtosBaixoEstoque = await adminModel.getProdutosBaixoEstoque();

    res.render('admin-dashboard', {
      titulo: 'Painel de Administração',
      totalUsuarios,
      totalDiagnosticos,
      totalProdutos,
      totalPedidos,
      usuariosRecentes,
      diagnosticosRecentes,
      produtosBaixoEstoque
    });
  } catch (erro) {
    console.log(erro);
    res.redirect('/admin-login');
  }
};
