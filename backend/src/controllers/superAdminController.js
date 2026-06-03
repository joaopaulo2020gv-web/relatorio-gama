const bcrypt = require('bcryptjs');
const db = require('../database/db');

// Listar todas as empresas clientes
exports.listCompanies = (req, res) => {
  db.all(
    `SELECT c.*, 
     (SELECT name FROM users WHERE company_id = c.id AND role = 'admin' LIMIT 1) as admin_name,
     (SELECT username FROM users WHERE company_id = c.id AND role = 'admin' LIMIT 1) as admin_username,
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

// Atualizar plano e status da empresa, incluindo os dados de seu administrador principal
exports.updateCompany = async (req, res) => {
  const { id } = req.params;
  const { 
    name, 
    cnpj, 
    plan_name, 
    plan_status, 
    plan_expires_at,
    admin_name,
    admin_username,
    admin_password
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'O nome da empresa é obrigatório.' });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Atualizar dados da empresa
    await client.query(
      `UPDATE companies 
       SET name = $1, cnpj = $2, plan_name = $3, plan_status = $4, plan_expires_at = $5 
       WHERE id = $6`,
      [name, cnpj || '', plan_name || 'Básico', plan_status || 'active', plan_expires_at || '', id]
    );

    // 2. Se as informações do administrador principal foram enviadas, atualizamos também
    if (admin_name || admin_username) {
      // Buscar o ID do usuário administrador principal dessa empresa
      const adminRes = await client.query(
        `SELECT id FROM users WHERE company_id = $1 AND role = 'admin' LIMIT 1`,
        [id]
      );

      if (adminRes.rows.length > 0) {
        const adminUserId = adminRes.rows[0].id;

        if (admin_password && admin_password.trim() !== '') {
          // Atualiza incluindo a nova senha
          const salt = bcrypt.genSaltSync(10);
          const hashedPassword = bcrypt.hashSync(admin_password, salt);
          await client.query(
            `UPDATE users 
             SET name = $1, username = $2, password = $3 
             WHERE id = $4`,
            [admin_name, admin_username, hashedPassword, adminUserId]
          );
        } else {
          // Atualiza sem mexer na senha
          await client.query(
            `UPDATE users 
             SET name = $1, username = $2 
             WHERE id = $3`,
            [admin_name, admin_username, adminUserId]
          );
        }
      } else {
        // Caso não exista administrador cadastrado (cenário atípico), criamos um novo
        if (admin_name && admin_username && admin_password) {
          const salt = bcrypt.genSaltSync(10);
          const hashedPassword = bcrypt.hashSync(admin_password, salt);
          await client.query(
            `INSERT INTO users (username, password, role, company_id, name) 
             VALUES ($1, $2, 'admin', $3, $4)`,
            [admin_username, hashedPassword, id, admin_name]
          );
        }
      }
    }

    await client.query("COMMIT");
    return res.json({ message: 'Empresa e administrador atualizados com sucesso!' });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error('Erro na transação de atualizar empresa:', err);
    
    // Tratar violação de chave única de nome de usuário do admin
    if (err.message.includes('unique constraint') || err.message.includes('UNIQUE constraint') || err.message.includes('users_username_key')) {
      return res.status(400).json({ error: 'O nome de usuário do administrador já está em uso.' });
    }
    return res.status(500).json({ error: 'Erro ao atualizar empresa e administrador.' });
  } finally {
    client.release();
  }
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
