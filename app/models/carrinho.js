// Carrinho de compras (material PSW3 – carrinho de compras).
// Os itens ficam na SESSÃO de cada usuário (req.session.carrinho) — nunca numa
// variável do módulo, que seria compartilhada entre todos os visitantes.
// Preço, nome e imagem vêm sempre do banco (Model de produtos).
// Quem está logado também tem o carrinho salvo na conta (carrinho_itens):
// ele volta ao entrar de novo, em qualquer aparelho, até a compra ser paga.
const { produtosModel } = require('./produtosModel');
const { carrinhoSalvoModel } = require('./carrinhoSalvoModel');

const LIMITE_POR_ITEM = 10;

const buscarProduto = async (id) => {
    const resultados = await produtosModel.findById(id); // só produtos ativos
    return resultados && resultados[0] ? resultados[0] : null;
};

const idDoCliente = (sessao) => (sessao.usuarioLogado && sessao.usuarioId ? sessao.usuarioId : null);

const carrinho = {

    itens: (sessao) => sessao.carrinho || [],

    // Grava o carrinho da sessão na conta (só para quem está logado)
    salvar: async (sessao) => {
        const id = idDoCliente(sessao);
        if (!id) return;
        await carrinhoSalvoModel.substituir(id,
            carrinho.itens(sessao).map((i) => ({ id_produto: i.codproduto, quantidade: i.qtde })));
    },

    // Traz para a sessão o carrinho salvo na conta (pode ter mudado em outro
    // aparelho, ou perdido itens já pagos). Mantém os dados de preço da sessão
    // para ainda conseguir avisar quando um preço mudar.
    sincronizar: async (sessao) => {
        const id = idDoCliente(sessao);
        if (!id) return;
        const salvos = await carrinhoSalvoModel.buscar(id);
        const atuais = carrinho.itens(sessao);
        sessao.carrinho = salvos.map((s) => {
            const atual = atuais.find((i) => i.codproduto === s.id_produto);
            return atual
                ? { ...atual, qtde: s.quantidade }
                : { codproduto: s.id_produto, qtde: s.quantidade, preco: null, produto: null, imagem: null };
        });
    },

    // Ao entrar na conta: junta o carrinho montado como visitante com o salvo
    // (fica a MAIOR quantidade de cada produto, para não duplicar itens)
    mesclarComConta: async (sessao) => {
        const id = idDoCliente(sessao);
        if (!id) return;
        const salvos = await carrinhoSalvoModel.buscar(id);
        const itens = carrinho.itens(sessao);
        for (const s of salvos) {
            const atual = itens.find((i) => i.codproduto === s.id_produto);
            if (atual) atual.qtde = Math.max(atual.qtde, s.quantidade);
            else itens.push({ codproduto: s.id_produto, qtde: s.quantidade, preco: null, produto: null, imagem: null });
        }
        sessao.carrinho = itens;
        await carrinho.salvar(sessao);
    },

    // Adiciona "qtde" unidades. Devolve { erro } se não for possível.
    addItem: async (sessao, codProduto, qtde = 1) => {
        const produto = await buscarProduto(codProduto);
        if (!produto) return { erro: 'Este produto não está mais disponível.' };

        await carrinho.sincronizar(sessao);
        const itens = carrinho.itens(sessao);
        const existente = itens.find((i) => i.codproduto === produto.id_produto);
        const novaQtde = (existente ? existente.qtde : 0) + qtde;

        if (novaQtde > produto.estoque_produto) {
            return { erro: produto.estoque_produto > 0
                ? `Temos só ${produto.estoque_produto} unidade(s) de "${produto.nome_produto}" em estoque.`
                : `"${produto.nome_produto}" está esgotado no momento.` };
        }
        if (novaQtde > LIMITE_POR_ITEM) return { erro: `O limite é de ${LIMITE_POR_ITEM} unidades por produto.` };

        const dados = {
            codproduto: produto.id_produto,
            qtde: novaQtde,
            preco: Number(produto.preco_produto),
            produto: produto.nome_produto,
            imagem: produto.imagem_produto
        };
        if (existente) Object.assign(existente, dados);
        else itens.push(dados);
        sessao.carrinho = itens;
        await carrinho.salvar(sessao);
        return { ok: true, produto };
    },

    // Diminui "qtde" unidades; se chegar a zero, tira o item do carrinho
    removeItem: async (sessao, codProduto, qtde = 1) => {
        await carrinho.sincronizar(sessao);
        const itens = carrinho.itens(sessao);
        const item = itens.find((i) => i.codproduto === codProduto);
        if (!item) return;
        item.qtde -= qtde;
        sessao.carrinho = item.qtde > 0 ? itens : itens.filter((i) => i !== item);
        await carrinho.salvar(sessao);
    },

    // Remove o item inteiro
    excluirItem: async (sessao, codProduto) => {
        await carrinho.sincronizar(sessao);
        sessao.carrinho = carrinho.itens(sessao).filter((i) => i.codproduto !== codProduto);
        await carrinho.salvar(sessao);
    },

    esvaziar: async (sessao) => {
        sessao.carrinho = [];
        await carrinho.salvar(sessao);
    },

    getQtdeItens: (sessao) => carrinho.itens(sessao).reduce((total, i) => total + i.qtde, 0),

    // Confere o carrinho com o banco: atualiza preço/nome/imagem, tira produtos
    // que saíram da loja e ajusta quantidades maiores que o estoque.
    atualizarCarrinho: async (sessao) => {
        await carrinho.sincronizar(sessao);
        const avisos = [];
        const atualizados = [];
        let mudouQtde = false;
        for (const item of carrinho.itens(sessao)) {
            const produto = await buscarProduto(item.codproduto);
            if (!produto || produto.estoque_produto <= 0) {
                avisos.push(`"${produto ? produto.nome_produto : (item.produto || 'Um produto')}" saiu do carrinho porque não está mais disponível.`);
                mudouQtde = true;
                continue;
            }
            let qtde = item.qtde;
            if (qtde > produto.estoque_produto) {
                qtde = produto.estoque_produto;
                avisos.push(`A quantidade de "${produto.nome_produto}" foi ajustada para ${qtde} (estoque disponível).`);
                mudouQtde = true;
            }
            if (item.preco !== null && item.preco !== undefined && Number(produto.preco_produto) !== item.preco) {
                avisos.push(`O preço de "${produto.nome_produto}" foi atualizado.`);
            }
            atualizados.push({
                codproduto: produto.id_produto,
                qtde,
                preco: Number(produto.preco_produto),
                produto: produto.nome_produto,
                imagem: produto.imagem_produto
            });
        }
        sessao.carrinho = atualizados;
        if (mudouQtde) await carrinho.salvar(sessao);
        const total = Math.round(atualizados.reduce((soma, i) => soma + i.preco * i.qtde, 0) * 100) / 100;
        return { itens: atualizados, total, avisos };
    }
};

module.exports = { carrinho, LIMITE_POR_ITEM };
