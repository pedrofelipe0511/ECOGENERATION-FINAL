const pool = require("../../config/pool_conexoes");
const { STATUS_USUARIO } = require("./usuariosModel");

// Model exclusivo para operações administrativas
const adminModel = {

  // ===== USUÁRIOS =====
  getAllUsuarios: async () => {
    try {
      const [resultado] = await pool.query(
        "SELECT id_usuario, nome_usuario, email_usuario, status_usuario FROM usuarios ORDER BY id_usuario DESC"
      );
      return resultado;
    } catch (erro) { throw erro; }
  },

  getUsuariosRecentes: async () => {
    try {
      const [resultado] = await pool.query(
        "SELECT id_usuario, nome_usuario, email_usuario FROM usuarios WHERE status_usuario = 1 ORDER BY id_usuario DESC LIMIT 5"
      );
      return resultado;
    } catch (erro) { throw erro; }
  },

  deleteUsuario: async (id) => {
    try {
      const [resultado] = await pool.query(
        "UPDATE usuarios SET status_usuario = ? WHERE id_usuario = ?", [STATUS_USUARIO.EXCLUIDO, id]
      );
      return resultado;
    } catch (erro) { throw erro; }
  },

  countUsuarios: async () => {
    try {
      const [resultado] = await pool.query(
        "SELECT COUNT(*) as total FROM usuarios WHERE status_usuario = 1"
      );
      return resultado[0].total;
    } catch (erro) { throw erro; }
  },

  // ===== DIAGNÓSTICOS =====
  getAllDiagnosticos: async () => {
    try {
      const [resultado] = await pool.query(
        `SELECT d.id_diagnostico, d.nivel_autonomia, d.frequencia, d.impacto,
         d.preparacao, d.prioridade, d.tolerancia,
         u.nome_usuario, u.email_usuario
         FROM diagnosticos d
         LEFT JOIN usuarios u ON d.id_usuario = u.id_usuario
         ORDER BY d.id_diagnostico DESC`
      );
      return resultado;
    } catch (erro) { throw erro; }
  },

  getDiagnosticosRecentes: async () => {
    try {
      const [resultado] = await pool.query(
        `SELECT d.id_diagnostico, d.nivel_autonomia,
         u.nome_usuario, u.email_usuario
         FROM diagnosticos d
         LEFT JOIN usuarios u ON d.id_usuario = u.id_usuario
         ORDER BY d.id_diagnostico DESC LIMIT 5`
      );
      return resultado;
    } catch (erro) { throw erro; }
  },

  deleteDiagnostico: async (id) => {
    try {
      const [resultado] = await pool.query(
        "DELETE FROM diagnosticos WHERE id_diagnostico = ?", [id]
      );
      return resultado;
    } catch (erro) { throw erro; }
  },

  countDiagnosticos: async () => {
    try {
      const [resultado] = await pool.query(
        "SELECT COUNT(*) as total FROM diagnosticos"
      );
      return resultado[0].total;
    } catch (erro) { throw erro; }
  },

  // ===== PRODUTOS =====
  getAllProdutos: async () => {
    try {
      const [resultado] = await pool.query(
        "SELECT * FROM produtos ORDER BY id_produto DESC"
      );
      return resultado;
    } catch (erro) { throw erro; }
  },

  getProduto: async (id) => {
    try {
      const [resultado] = await pool.query(
        "SELECT * FROM produtos WHERE id_produto = ?", [id]
      );
      return resultado[0] || null;
    } catch (erro) { throw erro; }
  },

  countProdutos: async () => {
    try {
      const [resultado] = await pool.query(
        "SELECT COUNT(*) as total FROM produtos WHERE status_produto = 1"
      );
      return resultado[0].total;
    } catch (erro) { throw erro; }
  },

  getProdutosBaixoEstoque: async () => {
    try {
      const [resultado] = await pool.query(
        "SELECT * FROM produtos WHERE estoque_produto <= 5 AND status_produto = 1"
      );
      return resultado;
    } catch (erro) { throw erro; }
  },

  addProduto: async (dados) => {
    try {
      const [resultado] = await pool.query(
        "INSERT INTO produtos (nome_produto, categoria_produto, preco_produto, descricao_produto, estoque_produto, imagem_produto, rota_produto) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [dados.nome, dados.categoria, dados.preco, dados.descricao, dados.estoque, dados.imagem || 'favicon2.png', dados.rota || null]
      );
      return resultado;
    } catch (erro) { throw erro; }
  },

  updateProduto: async (id, dados) => {
    try {
      let query, params;
      if (dados.imagem) {
        query = "UPDATE produtos SET nome_produto = ?, categoria_produto = ?, preco_produto = ?, descricao_produto = ?, estoque_produto = ?, imagem_produto = ? WHERE id_produto = ?";
        params = [dados.nome, dados.categoria, dados.preco, dados.descricao, dados.estoque, dados.imagem, id];
      } else {
        query = "UPDATE produtos SET nome_produto = ?, categoria_produto = ?, preco_produto = ?, descricao_produto = ?, estoque_produto = ? WHERE id_produto = ?";
        params = [dados.nome, dados.categoria, dados.preco, dados.descricao, dados.estoque, id];
      }
      const [resultado] = await pool.query(query, params);
      return resultado;
    } catch (erro) { throw erro; }
  },

  deleteProduto: async (id) => {
    try {
      const [resultado] = await pool.query(
        "UPDATE produtos SET status_produto = 0 WHERE id_produto = ?", [id]
      );
      return resultado;
    } catch (erro) { throw erro; }
  }

};

module.exports = { adminModel };
