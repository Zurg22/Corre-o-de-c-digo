const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
 
const app = express();
 
app.use(cors());
app.use(express.json());
 
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'painel_b2b',
    password: 'Postgres',
    port: 5432
});
 
/* =====================================
   LISTA DE GRUPOS COM QUANTIDADE
===================================== */
app.get('/api/grupos', async (req, res) => {
 
    try {
 
        const resultado = await pool.query(`
            SELECT
                grupo,
                COUNT(*) AS quantidade
            FROM dados_painel_b2b
            WHERE grupo IS NOT NULL
            GROUP BY grupo
            ORDER BY quantidade DESC
        `);
 
        res.json(resultado.rows);
 
    } catch (erro) {
 
        console.error(erro);
 
        res.status(500).json({
            erro: erro.message
        });
 
    }
 
});
 
/* =====================================
   QUANTIDADE DE UM GRUPO ESPECÍFICO
===================================== */
app.get('/api/grupo/:nome', async (req, res) => {
 
    try {
 
        const nomeGrupo = req.params.nome;
 
        const resultado = await pool.query(
            `
            SELECT COUNT(*) AS quantidade
            FROM dados_painel_b2b
            WHERE grupo = $1
            `,
            [nomeGrupo]
        );
 
        res.json(resultado.rows[0]);
 
    } catch (erro) {
 
        console.error(erro);
 
        res.status(500).json({
            erro: erro.message
        });
 
    }
 
});
 
/* =====================================
   FILTROS  ->  /api/filtros  e  /api/contagem
   (ADICIONADO: antes não estava registrado)
===================================== */
app.use('/api', require('./rotas-filtros')(pool));
 
/* =====================================
   TESTE DA API
===================================== */
app.get('/', (req, res) => {
 
    res.send('API Painel B2B funcionando!');
 
});
 
/* =====================================
   INICIAR SERVIDOR
===================================== */
app.listen(3000, () => {
 
    console.log(
        'API rodando em http://localhost:3000'
    );
 
});
