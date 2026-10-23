/* ============================================================
   server.js — API do Painel B2B (Express + PostgreSQL)
   Rotas ficam em rotas-filtros.js
   ============================================================ */
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const PORTA = process.env.PORT || 3000;

const pool = new Pool({
  user:     process.env.PGUSER     || 'postgres',
  host:     process.env.PGHOST     || 'localhost',
  database: process.env.PGDATABASE || 'painel_b2b',
  password: process.env.PGPASSWORD || 'Postgres',   // ideal: definir PGPASSWORD no ambiente
  port:     process.env.PGPORT     || 5432,
});

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', require('./rotas-filtros')(pool));        // /api/filtros e /api/contagem
app.get('/', (req, res) => res.send('API Painel B2B funcionando!'));

app.listen(PORTA, () => console.log(`API rodando em http://localhost:${PORTA}`));
