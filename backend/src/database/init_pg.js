const bcrypt = require('bcryptjs');

async function initPg(pool) {
  const client = await pool.connect();
  try {
    console.log('Iniciando inicialização do schema no PostgreSQL...');

    // 0. Tabela de Planos
    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        max_devices INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabela "plans" verificada/criada.');

    // Executar migração de coluna max_devices na tabela plans se ela já existe
    await client.query(`
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 1;
    `);

    // Inicializar planos padrões se a tabela estiver vazia
    const checkPlans = await client.query("SELECT COUNT(*) as count FROM plans");
    if (parseInt(checkPlans.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO plans (name, description, max_devices) VALUES 
        ('Básico', 'Até 3 pilotos', 1),
        ('Pro', 'Ilimitados', 999)
      `);
      console.log('Planos padrões "Básico" e "Pro" criados com sucesso!');
    }

    // 1. Tabela de Empresas
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        cnpj TEXT,
        logo_url TEXT,
        bank_name TEXT,
        bank_agency TEXT,
        bank_account TEXT,
        bank_owner TEXT,
        bank_cpf_pix TEXT,
        plan_name TEXT DEFAULT 'Básico',
        plan_status TEXT DEFAULT 'active',
        plan_expires_at TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabela "companies" verificada/criada.');

    // 2. Tabela de Usuários
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('superadmin', 'admin', 'pilot')),
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabela "users" verificada/criada.');

    // 2.1. Tabela de Sessões Ativas (PWA / Limite de conexões)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        session_token_id TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabela "user_sessions" verificada/criada.');

    // 3. Tabela de Relatórios
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        pilot_id INTEGER NOT NULL REFERENCES users(id),
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        client_name TEXT NOT NULL,
        farm_name TEXT NOT NULL,
        client_email TEXT,
        client_document TEXT,
        farm_address TEXT,
        culture TEXT NOT NULL,
        report_date TEXT NOT NULL,
        flights_data TEXT, 
        weather_temp REAL,
        weather_humidity REAL,
        weather_desc TEXT,
        delta_t REAL,
        caldas_data TEXT, 
        ph_photo_url TEXT,
        ph_desc TEXT,
        maps_data TEXT, 
        observations TEXT,
        total_area REAL DEFAULT 0,
        price_per_ha REAL DEFAULT 0,
        total_price REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabela "reports" verificada/criada.');

    // Executar migração de colunas na tabela reports se ela já existe
    await client.query(`
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS client_email TEXT;
    `);
    await client.query(`
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS client_document TEXT;
    `);
    await client.query(`
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS farm_address TEXT;
    `);
    await client.query(`
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS pilot_signature TEXT;
    `);
    await client.query(`
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS client_signature TEXT;
    `);
    await client.query(`
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS weather_forecast TEXT;
    `);
    console.log('Colunas opcionais de migração (client_email, client_document, farm_address, pilot_signature, client_signature, weather_forecast) verificadas/criadas na tabela "reports".');

    // 4. Inserir SuperAdmin padrão se não existir
    const checkRes = await client.query("SELECT COUNT(*) as count FROM users WHERE role = 'superadmin'");
    const count = parseInt(checkRes.rows[0].count, 10);
    
    if (count === 0) {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('gamaadmin123', salt);
      await client.query(
        "INSERT INTO users (username, password, role, name) VALUES ($1, $2, $3, $4)",
        ['superadmin', hashedPassword, 'superadmin', 'Administrador Geral']
      );
      console.log('SuperAdmin inicial criado com sucesso!');
      console.log('Usuário: superadmin | Senha: gamaadmin123');
    } else {
      console.log('SuperAdmin já cadastrado.');
    }

    console.log('Inicialização do banco concluída com sucesso!');
  } catch (err) {
    console.error('Erro ao inicializar banco PostgreSQL:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = initPg;
