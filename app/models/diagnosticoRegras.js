// Regras de negócio do Diagnóstico de Autonomia Energética.
// Fica no Model (MVC): o controller só recebe as respostas, chama
// calcularDiagnostico() e decide qual view renderizar.

// Valores aceitos em cada pergunta (usados também na validação da rota).
const OPCOES = {
    frequencia: ['nunca', 'poucas', 'regularmente', 'algumas', 'frequentemente'],
    duracao: ['menos1h', '1a4h', '4a12h', 'mais12h'],
    preparacao: ['sistema_completo', 'gerador', 'power_bank', 'lanternas', 'nenhuma'],
    prioridade: ['iluminacao', 'carregamento', 'climatizacao', 'trabalho'],
    moradia: ['casa_propria', 'apartamento', 'aluguel', 'area_rural'],
    orcamento: ['ate200', '200a500', '500a1000', 'acima1000']
};

// Vulnerabilidade (0–10) = frequência das quedas + duração das quedas
const PONTOS_FREQUENCIA = { nunca: 0, poucas: 1, regularmente: 3, algumas: 4, frequentemente: 5 };
const PONTOS_DURACAO = { menos1h: 0, '1a4h': 1, '4a12h': 3, mais12h: 5 };

// Preparo (0–10) = soma do que a pessoa já tem, limitada a 10
const PONTOS_PREPARACAO = { sistema_completo: 10, gerador: 7, power_bank: 3, lanternas: 1 };

const CATEGORIAS = ['entrada', 'medio', 'avancado'];

const CATEGORIA_POR_PERFIL = {
    independente: 'avancado',
    critico: 'entrada',
    medio: 'medio',
    preventivo: 'entrada'
};

// Prioridades que exigem mais potência sobem um nível de categoria
const NIVEIS_EXTRA_POR_PRIORIDADE = { iluminacao: 0, carregamento: 0, climatizacao: 1, trabalho: 1 };

// RN: o orçamento informado é um TETO — a recomendação nunca passa dele,
// nem na categoria, nem no preço de cada produto.
const TETO_POR_ORCAMENTO = {
    ate200: { categoria: 'entrada', precoMaximo: 200 },
    '200a500': { categoria: 'medio', precoMaximo: 500 },
    '500a1000': { categoria: 'medio', precoMaximo: 1000 },
    acima1000: { categoria: 'avancado', precoMaximo: null }
};

const calcularDiagnostico = ({ frequencia, duracao, preparacao, prioridade, orcamento }) => {
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

    const teto = TETO_POR_ORCAMENTO[orcamento] || TETO_POR_ORCAMENTO.ate200;
    const indiceDesejado = Math.min(
        CATEGORIAS.length - 1,
        CATEGORIAS.indexOf(CATEGORIA_POR_PERFIL[perfil]) + (NIVEIS_EXTRA_POR_PRIORIDADE[prioridade] || 0)
    );
    const indiceFinal = Math.min(indiceDesejado, CATEGORIAS.indexOf(teto.categoria));

    return {
        vulnerabilidade,
        preparo,
        preparacoes,
        perfil,
        categoria: CATEGORIAS[indiceFinal],
        precoMaximo: teto.precoMaximo
    };
};

module.exports = { OPCOES, calcularDiagnostico };
