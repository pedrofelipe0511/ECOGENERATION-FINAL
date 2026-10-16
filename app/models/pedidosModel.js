const pool = require("../../config/pool_conexoes");

// Status do pedido (regra de negócio):
// aguardando_pagamento -> pago -> enviado -> entregue | cancelado
const STATUS_PEDIDO = ['aguardando_pagamento', 'pago', 'enviado', 'entregue', 'cancelado'];

// Textos mostrados nas telas para cada status
const ROTULO_STATUS = {
    aguardando_pagamento: 'Aguardando pagamento', pago: 'Pago', enviado: 'Enviado', entregue: 'Entregue', cancelado: 'Cancelado'
};
const ROTULO_PAGAMENTO = {
    pendente: 'Ainda não pago', pending: 'Pendente', in_process: 'Em análise', approved: 'Aprovado',
    rejected: 'Recusado', cancelled: 'Cancelado', refunded: 'Devolvido', charged_back: 'Estornado',
    nao_aplicavel: 'Anterior ao Mercado Pago'
};

// Busca os itens de vários pedidos de uma vez e encaixa em cada pedido
const anexarItens = async (pedidos) => {
    if (!pedidos.length) return pedidos;
    const ids = pedidos.map((p) => p.id_pedido);
    const [itens] = await pool.query("SELECT * FROM itens_pedido WHERE id_pedido IN (?) ORDER BY id_item", [ids]);
    pedidos.forEach((p) => { p.itens = itens.filter((i) => i.id_pedido === p.id_pedido); });
    return pedidos;
};

const pedidosModel = {

    // Cria o pedido RESERVANDO o estoque, numa transação: ou todos os itens
    // são reservados e gravados, ou nada muda. Preço e nome vêm do banco.
    // Retorna null se algum produto estiver esgotado ou indisponível.
    // itensPedido: [{ id_produto, quantidade }]
    criarComReserva: async (id_usuario, itensPedido) => {
        const conexao = await pool.getConnection();
        try {
            await conexao.beginTransaction();
            const itens = [];
            for (const { id_produto, quantidade } of itensPedido) {
                // "estoque_produto >= ?" impede vender mais do que existe,
                // inclusive quando duas pessoas compram ao mesmo tempo
                const [baixa] = await conexao.query(
                    "UPDATE produtos SET estoque_produto = estoque_produto - ? WHERE id_produto = ? AND status_produto = 1 AND estoque_produto >= ?",
                    [quantidade, id_produto, quantidade]
                );
                if (baixa.affectedRows === 0) {
                    await conexao.rollback();
                    return null;
                }
                const [[produto]] = await conexao.query(
                    "SELECT id_produto, nome_produto, preco_produto, imagem_produto FROM produtos WHERE id_produto = ?",
                    [id_produto]
                );
                itens.push({ ...produto, quantidade });
            }

            const total = Math.round(itens.reduce((soma, p) => soma + Number(p.preco_produto) * p.quantidade, 0) * 100) / 100;
            const [pedido] = await conexao.query(
                "INSERT INTO pedidos (id_usuario, total_pedido, status_pedido, status_pagamento) VALUES (?, ?, 'aguardando_pagamento', 'pendente')",
                [id_usuario, total]
            );
            for (const p of itens) {
                await conexao.query(
                    "INSERT INTO itens_pedido (id_pedido, id_produto, nome_produto, imagem_produto, preco_unitario, quantidade) VALUES (?, ?, ?, ?, ?, ?)",
                    [pedido.insertId, p.id_produto, p.nome_produto, p.imagem_produto, p.preco_produto, p.quantidade]
                );
            }

            await conexao.commit();
            return { id_pedido: pedido.insertId, total, itens };
        } catch (erro) {
            await conexao.rollback();
            throw erro;
        } finally {
            conexao.release();
        }
    },

    // Pedido ainda não pago, com cobrança criada há pouco, com EXATAMENTE os
    // mesmos produtos e quantidades: evita reservar o estoque duas vezes
    findPendenteRecente: async (id_usuario, itensPedido, minutos) => {
        try {
            const [pedidos] = await pool.query(
                `SELECT * FROM pedidos
                 WHERE id_usuario = ? AND status_pedido = 'aguardando_pagamento' AND id_preferencia IS NOT NULL
                   AND data_pedido > NOW() - INTERVAL ? MINUTE
                 ORDER BY id_pedido DESC`,
                [id_usuario, minutos]
            );
            const assinatura = (lista) => lista.map((i) => `${i.id_produto}x${i.quantidade}`).sort().join(',');
            const procurado = assinatura(itensPedido);
            return (await anexarItens(pedidos)).find((p) => assinatura(p.itens) === procurado) || null;
        } catch (erro) {
            throw erro;
        }
    },

    definirPreferencia: async (id_pedido, id_preferencia) => {
        try {
            await pool.query("UPDATE pedidos SET id_preferencia = ? WHERE id_pedido = ?", [id_preferencia, id_pedido]);
        } catch (erro) {
            throw erro;
        }
    },

    findById: async (id_pedido) => {
        try {
            const [resultado] = await pool.query("SELECT * FROM pedidos WHERE id_pedido = ?", [id_pedido]);
            return (await anexarItens(resultado))[0] || null;
        } catch (erro) {
            throw erro;
        }
    },

    // Registra o pagamento confirmado pela API do Mercado Pago. Se o pedido
    // já tinha sido cancelado por abandono (estoque devolvido), reserva de novo.
    marcarPago: async (id_pedido, id_pagamento, status_pagamento) => {
        const conexao = await pool.getConnection();
        try {
            await conexao.beginTransaction();
            const [[pedido]] = await conexao.query("SELECT status_pedido FROM pedidos WHERE id_pedido = ? FOR UPDATE", [id_pedido]);
            if (!pedido || !['aguardando_pagamento', 'cancelado'].includes(pedido.status_pedido)) {
                await conexao.commit();
                return false; // já estava pago (ou enviado/entregue): nada a fazer
            }
            if (pedido.status_pedido === 'cancelado') {
                await conexao.query(
                    `UPDATE produtos p JOIN itens_pedido i ON i.id_produto = p.id_produto
                     SET p.estoque_produto = p.estoque_produto - i.quantidade
                     WHERE i.id_pedido = ?`,
                    [id_pedido]
                );
            }
            await conexao.query(
                "UPDATE pedidos SET status_pedido = 'pago', status_pagamento = ?, id_pagamento = ? WHERE id_pedido = ?",
                [status_pagamento, id_pagamento, id_pedido]
            );
            await conexao.commit();
            return true;
        } catch (erro) {
            await conexao.rollback();
            throw erro;
        } finally {
            conexao.release();
        }
    },

    // Pagamento ainda em análise (ex.: pendente, em processamento)
    registrarPagamentoPendente: async (id_pedido, id_pagamento, status_pagamento) => {
        try {
            await pool.query(
                "UPDATE pedidos SET status_pagamento = ?, id_pagamento = ? WHERE id_pedido = ? AND status_pedido = 'aguardando_pagamento'",
                [status_pagamento, id_pagamento, id_pedido]
            );
        } catch (erro) {
            throw erro;
        }
    },

    // Cancela e DEVOLVE o estoque reservado. Só age sobre pedidos ainda não
    // pagos, então chamar duas vezes não devolve o estoque em dobro.
    cancelarEDevolverEstoque: async (id_pedido, status_pagamento = null, id_pagamento = null) => {
        const conexao = await pool.getConnection();
        try {
            await conexao.beginTransaction();
            const [cancelado] = await conexao.query(
                `UPDATE pedidos SET status_pedido = 'cancelado',
                        status_pagamento = COALESCE(?, status_pagamento), id_pagamento = COALESCE(?, id_pagamento)
                 WHERE id_pedido = ? AND status_pedido = 'aguardando_pagamento'`,
                [status_pagamento, id_pagamento, id_pedido]
            );
            if (cancelado.affectedRows > 0) {
                await conexao.query(
                    `UPDATE produtos p JOIN itens_pedido i ON i.id_produto = p.id_produto
                     SET p.estoque_produto = p.estoque_produto + i.quantidade
                     WHERE i.id_pedido = ?`,
                    [id_pedido]
                );
            }
            await conexao.commit();
            return cancelado.affectedRows > 0;
        } catch (erro) {
            await conexao.rollback();
            throw erro;
        } finally {
            conexao.release();
        }
    },

    // Pedidos abandonados (sem pagamento há mais de X minutos) são
    // cancelados e devolvem o estoque reservado.
    cancelarExpirados: async (minutos) => {
        try {
            const [antigos] = await pool.query(
                "SELECT id_pedido FROM pedidos WHERE status_pedido = 'aguardando_pagamento' AND status_pagamento IN ('pendente', 'rejected', 'cancelled') AND data_pedido < NOW() - INTERVAL ? MINUTE",
                [minutos]
            );
            for (const { id_pedido } of antigos) await pedidosModel.cancelarEDevolverEstoque(id_pedido);
            return antigos.length;
        } catch (erro) {
            throw erro;
        }
    },

    // Admin: muda o status; cancelar um pedido ainda não pago devolve o estoque
    atualizarStatus: async (id_pedido, status) => {
        try {
            if (status === 'cancelado') {
                const devolveu = await pedidosModel.cancelarEDevolverEstoque(id_pedido);
                if (devolveu) return;
            }
            await pool.query("UPDATE pedidos SET status_pedido = ? WHERE id_pedido = ?", [status, id_pedido]);
        } catch (erro) {
            throw erro;
        }
    },

    // Uma página dos pedidos do usuário (mais recentes primeiro), com itens
    findByUsuarioPaginado: async (id_usuario, limite, offset) => {
        try {
            const [resultado] = await pool.query(
                "SELECT * FROM pedidos WHERE id_usuario = ? ORDER BY id_pedido DESC LIMIT ? OFFSET ?",
                [id_usuario, limite, offset]
            );
            return anexarItens(resultado);
        } catch (erro) {
            throw erro;
        }
    },

    countByUsuario: async (id_usuario) => {
        try {
            const [resultado] = await pool.query("SELECT COUNT(*) AS total FROM pedidos WHERE id_usuario = ?", [id_usuario]);
            return resultado[0].total;
        } catch (erro) {
            throw erro;
        }
    },

    // Admin: todos os pedidos com o nome do cliente e os itens
    findAll: async () => {
        try {
            const [resultado] = await pool.query(
                `SELECT p.*, u.nome_usuario, u.email_usuario
                 FROM pedidos p LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
                 ORDER BY p.id_pedido DESC`
            );
            return anexarItens(resultado);
        } catch (erro) {
            throw erro;
        }
    },

    countAll: async () => {
        try {
            const [resultado] = await pool.query("SELECT COUNT(*) AS total FROM pedidos");
            return resultado[0].total;
        } catch (erro) {
            throw erro;
        }
    }
};

module.exports = { pedidosModel, STATUS_PEDIDO, ROTULO_STATUS, ROTULO_PAGAMENTO };
