const mysql = require("mysql2");

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    // O Clever Cloud limita 5 conexões por usuário do banco. Em desenvolvimento
    // use DB_CONNECTION_LIMIT=1 para não disputar conexões com o site no Render.
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 4,
    queueLimit: 0
});

pool.getConnection((err, conn) => {
    if (err) {
        console.log(err);
    } else {
        console.log("Conectado ao MySQL!");
        conn.release(); // devolve a conexão de teste ao pool
    }
});

module.exports = pool.promise();
