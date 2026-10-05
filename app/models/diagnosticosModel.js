const pool = require("../../config/pool_conexoes");

const diagnosticosModel = {

    create: async (dadosJson) => {
        try {
            const [resultado] = await pool.query(
                "INSERT INTO diagnosticos (id_usuario, frequencia, impacto, preparacao, prioridade, tolerancia, nivel_autonomia) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [
                    dadosJson.id_usuario,
                    dadosJson.frequencia,
                    dadosJson.impacto,
                    dadosJson.preparacao,
                    dadosJson.prioridade,
                    dadosJson.tolerancia,
                    dadosJson.nivel_autonomia
                ]
            );
            return resultado;
        } catch (erro) {
            throw erro;
        }
    },

    findAll: async () => {
        try {
            const [resultado] = await pool.query(
                "SELECT * FROM diagnosticos"
            );
            return resultado;
        } catch (erro) {
            throw erro;
        }
        
    },

     findByUsuario: async (id_usuario) => {
    try {
        const [resultado] = await pool.query(
            "SELECT * FROM diagnosticos WHERE id_usuario = ? ORDER BY id_diagnostico DESC",
            [id_usuario]
        );
        return resultado;
    } catch (erro) {
        throw erro;
    }
}
}

module.exports = { diagnosticosModel };