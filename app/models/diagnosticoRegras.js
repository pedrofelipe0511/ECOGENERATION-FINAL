// Regras de negócio do Diagnóstico de Autonomia Energética.
// Fica no Model (MVC): o controller só recebe as respostas, chama
// calcularDiagnostico() / montarKit() e decide qual view renderizar.

// Valores aceitos em cada pergunta (usados também na validação da rota).
const OPCOES = {
    frequencia: ['nunca', 'poucas', 'regularmente', 'algumas', 'frequentemente'],
    duracao: ['menos1h', '1a4h', '4a12h', 'mais12h'],
    preparacao: ['sistema_completo', 'gerador', 'power_bank', 'lanternas', 'nenhuma'],
    aparelhos: ['celular', 'luz', 'ventilador', 'wifi', 'notebook'],
    moradia: ['casa_propria', 'apartamento', 'aluguel', 'area_rural'],
    orcamento: ['ate200', '200a500', '500a1000', 'acima1000']
};

// ── PERFIL ─────────────────────────────────────────────────────

// Vulnerabilidade (0–10) = frequência das quedas + duração das quedas
const PONTOS_FREQUENCIA = { nunca: 0, poucas: 1, regularmente: 3, algumas: 4, frequentemente: 5 };
const PONTOS_DURACAO = { menos1h: 0, '1a4h': 1, '4a12h': 3, mais12h: 5 };

// Preparo (0–10) = soma do que a pessoa já tem, limitada a 10
const PONTOS_PREPARACAO = { sistema_completo: 10, gerador: 7, power_bank: 3, lanternas: 1 };

const calcularDiagnostico = ({ frequencia, duracao, preparacao }) => {
    const vulnerabilidade = (PONTOS_FREQUENCIA[frequencia] || 0) + (PONTOS_DURACAO[duracao] || 0);

    const preparacoes = Array.isArray(preparacao) ? preparacao : preparacao ? [preparacao] : [];
    let preparo = 0;
    if (!preparacoes.includes('nenhuma')) {
        preparo = preparacoes.reduce((total, item) => total + (PONTOS_PREPARACAO[item] || 0), 0);
        preparo = Math.min(preparo, 10);
    }

    let perfil;
    if (preparo >= 8) {
        perfil = 'independente';
    } else if (vulnerabilidade >= 6 && preparo <= 3) {
        perfil = 'critico';
    } else if (vulnerabilidade >= 3 || preparo >= 2) {
        perfil = 'medio';
    } else {
        perfil = 'preventivo';
    }

    return { vulnerabilidade, preparo, preparacoes, perfil };
};

// ── KIT RECOMENDADO ────────────────────────────────────────────
// Os números abaixo são médias usadas SÓ no cálculo interno. O usuário
// nunca os vê: o resultado é traduzido em frases ("a noite toda").

// RN: o orçamento informado é um TETO — o kit nunca passa dele.
const TETO_POR_ORCAMENTO = { ate200: 200, '200a500': 500, '500a1000': 1000, acima1000: null };

// Quanto tempo o kit precisa aguentar, a partir da duração das quedas
const HORAS_POR_DURACAO = { menos1h: 1, '1a4h': 4, '4a12h': 8, mais12h: 24 };
const FRASE_TEMPO_TODO = { menos1h: 'a queda toda', '1a4h': 'a queda toda', '4a12h': 'a noite toda', mais12h: 'um dia inteiro' };

// Consumo médio de cada aparelho (watts) e energia de uma carga de celular (Wh)
const CONSUMO_W = { luz: 9, ventilador: 35, wifi: 10, notebook: 45 };
const ENERGIA_CARGA_CELULAR = 15;
const CARGAS_CELULAR = { menos1h: 1, '1a4h': 1, '4a12h': 1, mais12h: 2 };
const APROVEITAMENTO_BATERIA = 0.85; // perdas na conversão

// Aparelhos que precisam de tomada: só uma 'bateria' (estação/gerador) alimenta
const PRECISA_TOMADA = ['ventilador', 'wifi', 'notebook'];

// Ordem de atendimento: do que gasta menos para o que gasta mais
const ORDEM_APARELHOS = ['celular', 'luz', 'wifi', 'ventilador', 'notebook'];

const NOME_APARELHO = { celular: 'Celular', luz: 'Luz de um cômodo', ventilador: 'Ventilador', wifi: 'Wi-Fi', notebook: 'Notebook' };
const ICONE_APARELHO = { celular: '📱', luz: '💡', ventilador: '🌀', wifi: '📶', notebook: '💻' };

const MAX_ITENS_KIT = 3;

const formatarHoras = (horas) => {
    if (horas < 1) return 'menos de 1 hora';
    const arredondado = Math.round(horas);
    return arredondado === 1 ? 'cerca de 1 hora' : `cerca de ${arredondado} horas`;
};

// Calcula o que um conjunto de produtos cobre para os aparelhos pedidos
const avaliarKit = (itens, aparelhos, duracao) => {
    const horasNecessarias = HORAS_POR_DURACAO[duracao];
    const temPainel = itens.some((p) => p.tipo_energia === 'painel');
    // Em quedas longas, um painel recarrega as baterias de dia: conta como uma recarga
    const multiplicador = duracao === 'mais12h' && temPainel ? 2 : 1;

    const somaWh = (tipo) => itens.filter((p) => p.tipo_energia === tipo)
        .reduce((t, p) => t + Number(p.capacidade_energia || 0), 0) * APROVEITAMENTO_BATERIA * multiplicador;
    let energiaTomada = somaWh('bateria');
    let energiaUsb = somaWh('bateria_usb');
    const horasProprias = (tipo) => Math.max(0, ...itens.filter((p) => p.tipo_energia === tipo).map((p) => Number(p.capacidade_energia || 0)));

    // Tira energia primeiro do USB (quando o aparelho aceita) e depois da tomada
    const consumir = (necessario, aceitaUsb) => {
        let obtido = 0;
        if (aceitaUsb) {
            const doUsb = Math.min(energiaUsb, necessario);
            energiaUsb -= doUsb; obtido += doUsb;
        }
        const daTomada = Math.min(energiaTomada, necessario - obtido);
        energiaTomada -= daTomada; obtido += daTomada;
        return obtido;
    };

    const cobertura = ORDEM_APARELHOS.filter((a) => aparelhos.includes(a)).map((aparelho) => {
        let fracao;
        let frase;
        let algumUso; // o kit faz o aparelho funcionar por um tempo útil?
        if (aparelho === 'celular') {
            const cargasPossiveis = Math.floor((energiaUsb + energiaTomada) / ENERGIA_CARGA_CELULAR);
            const cargasNecessarias = CARGAS_CELULAR[duracao];
            const energia = consumir(cargasNecessarias * ENERGIA_CARGA_CELULAR, true);
            fracao = energia / (cargasNecessarias * ENERGIA_CARGA_CELULAR);
            algumUso = cargasPossiveis >= 1;
            frase = cargasPossiveis >= 10 ? 'carrega mais de 10 vezes'
                : cargasPossiveis >= 1 ? `carrega cerca de ${cargasPossiveis} ${cargasPossiveis === 1 ? 'vez' : 'vezes'}`
                : 'carrega só uma parte da bateria';
        } else {
            const proprias = horasProprias(aparelho);
            const faltam = Math.max(0, horasNecessarias - proprias);
            const energia = faltam > 0 ? consumir(faltam * CONSUMO_W[aparelho], !PRECISA_TOMADA.includes(aparelho)) : 0;
            const horas = proprias + energia / CONSUMO_W[aparelho];
            fracao = horas / horasNecessarias;
            algumUso = horas >= 1 || (horasNecessarias <= 1 && horas >= 0.5);
            frase = fracao >= 1 ? FRASE_TEMPO_TODO[duracao] : `só por ${formatarHoras(horas)}`;
        }
        fracao = Math.min(1, fracao);

        let status = fracao >= 1 ? 'ok' : algumUso ? 'parcial' : 'nao';
        if (status === 'nao') {
            const semTomada = PRECISA_TOMADA.includes(aparelho) && !itens.some((p) => p.tipo_energia === 'bateria');
            frase = semTomada ? 'precisa de uma estação de energia com tomada' : 'este kit não dá conta';
        }
        return { aparelho, nome: NOME_APARELHO[aparelho], icone: ICONE_APARELHO[aparelho], status, frase, fracao };
    });

    const total = itens.reduce((t, p) => t + Number(p.preco_produto), 0);
    return {
        itens,
        total: Math.round(total * 100) / 100,
        cobertura,
        cobertos: cobertura.filter((c) => c.status === 'ok').length,
        pontos: cobertura.reduce((t, c) => t + c.fracao, 0)
    };
};

// Gera todas as combinações de 1 até MAX_ITENS_KIT produtos
const combinacoes = (lista) => {
    const resultado = [];
    const montar = (inicio, atual) => {
        if (atual.length) resultado.push(atual);
        if (atual.length === MAX_ITENS_KIT) return;
        for (let i = inicio; i < lista.length; i++) montar(i + 1, [...atual, lista[i]]);
    };
    montar(0, []);
    return resultado;
};

// Melhor kit: cobre mais aparelhos por inteiro; empate -> cobre mais no total;
// empate -> mais barato; empate -> menos itens
const melhorKit = (kits) => kits.reduce((melhor, kit) => {
    if (!melhor) return kit;
    if (kit.cobertos !== melhor.cobertos) return kit.cobertos > melhor.cobertos ? kit : melhor;
    if (Math.abs(kit.pontos - melhor.pontos) > 0.001) return kit.pontos > melhor.pontos ? kit : melhor;
    if (kit.total !== melhor.total) return kit.total < melhor.total ? kit : melhor;
    return kit.itens.length < melhor.itens.length ? kit : melhor;
}, null);

// RN: monta o kit dentro do orçamento e, se ele não cobrir tudo, sugere o
// kit mais barato que cobre (sem esconder que ele custa mais).
const montarKit = ({ aparelhos, duracao, orcamento }, produtos) => {
    const lista = Array.isArray(aparelhos) ? aparelhos : aparelhos ? [aparelhos] : [];
    const teto = TETO_POR_ORCAMENTO[orcamento] ?? null;
    const todos = combinacoes(produtos).map((itens) => avaliarKit(itens, lista, duracao));
    const dentroDoOrcamento = todos.filter((k) => teto === null || k.total <= teto);

    let kit = melhorKit(dentroDoOrcamento);
    if (kit && kit.pontos === 0) kit = null; // nada útil cabe no orçamento

    let alternativa = null;
    if (!kit || kit.cobertos < lista.length) {
        const cobremTudo = todos.filter((k) => k.cobertos === lista.length);
        alternativa = cobremTudo.length
            ? cobremTudo.reduce((a, b) => (b.total < a.total || (b.total === a.total && b.itens.length < a.itens.length) ? b : a))
            : null;
        if (alternativa && kit && alternativa.total <= kit.total) alternativa = null;
    }

    return { kit, alternativa, teto, aparelhos: lista };
};

module.exports = { OPCOES, calcularDiagnostico, montarKit, NOME_APARELHO, ICONE_APARELHO };
