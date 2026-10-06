const pool = require("../../config/pool_conexoes");

const comprasModel = {

    // Regra de negócio: só vende se houver estoque. A baixa do estoque e o
    // registro das compras acontecem numa TRANSAÇÃO — ou todos os itens são
    // gravados, ou nenhum. Usado para um produto avulso e para o kit do
    // diagnóstico. Retorna null se algum item estiver esgotado ou indisponível.
    createKitComBaixaEstoque: async (id_usuario, idsProdutos) => {
        const conexao = await pool.getConnection();
        try {
            await conexao.beginTransaction();
            const compras = [];

            for (const id_produto of idsProdutos) {
                // O "estoque_produto > 0" no WHERE impede vender a mesma última
                // unidade para duas pessoas ao mesmo tempo.
                const [baixa] = await conexao.query(
                    "UPDATE produtos SET estoque_produto = estoque_produto - 1 WHERE id_produto = ? AND status_produto = 1 AND estoque_produto > 0",
                    [id_produto]
                );
                if (baixa.affectedRows === 0) {
                    await conexao.rollback();
                    return null;
                }

                const [[produto]] = await conexao.query(
                    "SELECT nome_produto, preco_produto, imagem_produto FROM produtos WHERE id_produto = ?",
                    [id_produto]
                );
                const [resultado] = await conexao.query(
                    "INSERT INTO compras (id_usuario, id_produto, nome_produto, preco_produto, imagem_produto, status_compra) VALUES (?, ?, ?, ?, ?, ?)",
                    [id_usuario, id_produto, produto.nome_produto, produto.preco_produto, produto.imagem_produto, 'confirmado']
                );
                compras.push({ id_compra: resultado.insertId, ...produto });
            }

            await conexao.commit();
            return compras;
        } catch (erro) {
            await conexao.rollback();
            throw erro;
        } finally {
            conexao.release();
        }
    },

    // Compra de um produto avulso (mesma regra, com um item só)
    createComBaixaEstoque: async (id_usuario, id_produto) => {
        const compras = await comprasModel.createKitComBaixaEstoque(id_usuario, [id_produto]);
        return compras ? compras[0] : null;
    },

    // Buscar todas as compras de um usuário
    findByUsuario: async (id_usuario) => {
        try {
            const [resultado] = await pool.query(
                "SELECT * FROM compras WHERE id_usuario = ? ORDER BY id_compra DESC",
                [id_usuario]
            );
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    // Uma página das compras do usuário (mais recentes primeiro)
    findByUsuarioPaginado: async (id_usuario, limite, offset) => {
        try {
            const [resultado] = await pool.query(
                "SELECT * FROM compras WHERE id_usuario = ? ORDER BY id_compra DESC LIMIT ? OFFSET ?",
                [id_usuario, limite, offset]
            );
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    countByUsuario: async (id_usuario) => {
        try {
            const [resultado] = await pool.query(
                "SELECT COUNT(*) AS total FROM compras WHERE id_usuario = ?",
                [id_usuario]
            );
            return resultado[0].total;
        } catch (erro) {
            throw erro;
        }
    },

    // Buscar uma compra específica pelo ID
    findById: async (id) => {
        try {
            const [resultado] = await pool.query(
                "SELECT * FROM compras WHERE id_compra = ?",
                [id]
            );
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    // Atualizar status de uma compra (para admin)
    updateStatus: async (id, status) => {
        try {
            const [resultado] = await pool.query(
                "UPDATE compras SET status_compra = ? WHERE id_compra = ?",
                [status, id]
            );
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    // Buscar todas as compras (para admin)
    findAll: async () => {
        try {
            const [resultado] = await pool.query(
                "SELECT compras.*, usuarios.nome_usuario, usuarios.email_usuario FROM compras LEFT JOIN usuarios ON compras.id_usuario = usuarios.id_usuario ORDER BY compras.id_compra DESC"
            );
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    // Contar todas as compras (para dashboard)
    countAll: async () => {
        try {
            const [resultado] = await pool.query(
                "SELECT COUNT(*) AS total FROM compras"
            );
            return resultado[0].total;
        } catch (erro) {
            throw erro;
        }
    }

}

module.exports = { comprasModel };
