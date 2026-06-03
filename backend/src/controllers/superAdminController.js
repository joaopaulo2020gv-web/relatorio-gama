const bcrypt = require('bcryptjs');
const db = require('../database/db');

// Listar todas as empresas clientes
exports.listCompanies = (req, res) => {
  db.all(
    `SELECT c.*, 
     (SELECT COUNT(*) FROM users WHERE company_id = c.id AND role = 'pilot') as pilot_count,
     (SELECT COUNT(*) FROM reports WHERE company_id = c.id) as report_count
     FROM companies c 
     ORDER BY c.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao listar empresas.' });
      }
      return res.json({ companies: rows });
    }
  );
};

// Criar nova empresa + usuário administrador inicial dessa empresa
exports.createCompany = async (req, res) => {
  const { 
    name, 
    cnpj, 
    plan_name, 
    plan_expires_at, 
    admin_name, 
    admin_username, 
    admin_password 
  } = req.body;

  if (!name || !admin_name || !admin_username || !admin_password) {
    return res.status(400).json({ error: 'Nome da empresa, nome do admin, usuário e senha são obrigatórios.' });
  }

  // Obter um cliente do pool do PostgreSQL para executar a transação com segurança
  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Inserir Empresa
    const companyRes = await client.query(
      `INSERT INTO companies (name, cnpj, plan_name, plan_status, plan_expires_at) 
       VALUES ($1, $2, $3, 'active', $4) RETURNING id`,
      [name, cnpj || '', plan_name || 'Básico', plan_expires_at || '']
    );

    const companyId = companyRes.rows[0].id;

    // 2. Hash da senha do administrador
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(admin_password, salt);

    // 3. Inserir Usuário Administrador
    await client.query(
      `INSERT INTO users (username, password, role, company_id, name) 
       VALUES ($1, $2, 'admin', $3, $4)`,
      [admin_username, hashedPassword, companyId, admin_name]
    );

    await client.query("COMMIT");

    return res.status(201).json({ 
      message: 'Empresa e administrador cadastrados com sucesso!',
      company_id: companyId
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error('Erro na transação de criar empresa:', err);
    // Verificar se o erro foi de usuário já existente no PostgreSQL
    if (err.message.includes('unique constraint') || err.message.includes('UNIQUE constraint') || err.message.includes('users_username_key')) {
      return res.status(400).json({ error: 'O nome de usuário do administrador já está em uso.' });
    }
    return res.status(500).json({ error: 'Erro ao cadastrar empresa e administrador.' });
  } finally {
    client.release();
  }
};

// Atualizar plano e status da empresa
exports.updateCompany = (req, res) => {
  const { id } = req.params;
  const { name, cnpj, plan_name, plan_status, plan_expires_at } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'O nome da empresa é obrigatório.' });
  }

  db.run(
    `UPDATE companies 
     SET name = ?, cnpj = ?, plan_name = ?, plan_status = ?, plan_expires_at = ? 
     WHERE id = ?`,
    [name, cnpj || '', plan_name || 'Básico', plan_status || 'active', plan_expires_at || '', id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao atualizar empresa.' });
      }
      return res.json({ message: 'Empresa atualizada com sucesso!' });
    }
  );
};

// Excluir empresa (em cascata)
exports.deleteCompany = (req, res) => {
  const { id } = req.params;

  db.run(`DELETE FROM companies WHERE id = ?`, [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Erro ao excluir empresa.' });
    }
    return res.json({ message: 'Empresa excluída com sucesso!' });
  });
};

// Estatísticas globais do sistema
exports.getSystemStats = (req, res) => {
  db.get(
    `SELECT 
      (SELECT COUNT(*) FROM companies) as total_companies,
      (SELECT COUNT(*) FROM companies WHERE plan_status = 'active') as active_companies,
      (SELECT COUNT(*) FROM users WHERE role = 'pilot') as total_pilots,
      (SELECT COUNT(*) FROM reports) as total_reports`,
    [],
    (err, stats) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao obter estatísticas.' });
      }
      return res.json({ stats });
    }
  );
};
