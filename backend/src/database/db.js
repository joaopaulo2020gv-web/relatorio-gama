const { Pool } = require('pg');
const initPg = require('./init_pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("AVISO: A variável de ambiente DATABASE_URL não está definida no arquivo .env.");
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: connectionString && (connectionString.includes('neon.tech') || connectionString.includes('sslmode=require'))
    ? { rejectUnauthorized: false }
    : false
});

// Inicializar tabelas no banco de dados
initPg(pool).then(() => {
  console.log("Banco de dados PostgreSQL conectado e inicializado com sucesso.");
}).catch((err) => {
  console.error("Falha crítica ao inicializar banco de dados PostgreSQL:", err.message);
});

// Converte placeholders "?" do SQLite para "$1, $2..." do PostgreSQL
function convertPlaceholders(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

// Normaliza os argumentos caso o array de parâmetros seja omitido
function normalizeArgs(params, callback) {
  if (typeof params === 'function') {
    return { actualParams: [], actualCallback: params };
  }
  return { actualParams: params || [], actualCallback: callback };
}

const db = {
  // Expor o pool para uso em transações mais complexas (como cadastro de empresas)
  pool,

  query(sql, params, callback) {
    const { actualParams, actualCallback } = normalizeArgs(params, callback);
    const pgSql = convertPlaceholders(sql);
    pool.query(pgSql, actualParams, actualCallback);
  },

  all(sql, params, callback) {
    const { actualParams, actualCallback } = normalizeArgs(params, callback);
    const pgSql = convertPlaceholders(sql);
    pool.query(pgSql, actualParams, (err, res) => {
      if (actualCallback) {
        actualCallback(err, res ? res.rows : undefined);
      }
    });
  },

  get(sql, params, callback) {
    const { actualParams, actualCallback } = normalizeArgs(params, callback);
    const pgSql = convertPlaceholders(sql);
    pool.query(pgSql, actualParams, (err, res) => {
      if (actualCallback) {
        actualCallback(err, res && res.rows ? res.rows[0] : undefined);
      }
    });
  },

  run(sql, params, callback) {
    const { actualParams, actualCallback } = normalizeArgs(params, callback);
    let pgSql = sql;
    const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
    
    if (isInsert && !sql.toUpperCase().includes('RETURNING')) {
      pgSql += ' RETURNING id';
    }
    
    pgSql = convertPlaceholders(pgSql);

    pool.query(pgSql, actualParams, (err, res) => {
      if (actualCallback) {
        const context = {
          changes: res ? res.rowCount : 0
        };
        if (isInsert && res && res.rows && res.rows.length > 0) {
          // Atribuir o ID gerado para emular o "this.lastID" do SQLite
          context.lastID = res.rows[0].id;
        }
        actualCallback.call(context, err);
      }
    });
  },

  serialize(callback) {
    if (callback) callback();
  }
};

module.exports = db;
