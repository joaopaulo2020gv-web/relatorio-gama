
const bcrypt = require('bcryptjs');
const db = require('../database/db');

// Obter dados cadastrais da empresa do administrador logado
exports.getCompanyDetails = (req, res) => {
  const companyId = req.user.company_id;

  if (!companyId) {
    return res.status(400).json({ error: 'Este usuário não está associado a nenhuma empresa.' });
  }

  db.get("SELECT * FROM companies WHERE id = ?", [companyId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar dados da empresa.' });
    }
    return res.json({ company: row });
  });
};

// Atualizar dados cadastrais da empresa
exports.updateCompanyDetails = async (req, res) => {
  const companyId = req.user.company_id;
  const {
    name,
    cnpj,
    bank_name,
    bank_agency,
    bank_account,
    bank_owner,
    bank_cpf_pix
  } = req.body;

  if (!companyId) {
    return res.status(400).json({ error: 'Este usuário não está associado a nenhuma empresa.' });
  }

  if (!name) {
    return res.status(400).json({ error: 'O nome da empresa é obrigatório.' });
  }

  db.get("SELECT cnpj FROM companies WHERE id = ?", [companyId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao verificar o CNPJ atual da empresa.' });
    }

    const currentCnpj = (row && row.cnpj) ? row.cnpj.trim() : '';
    const newCnpj = cnpj ? cnpj.trim() : '';

    if (currentCnpj !== '' && currentCnpj !== newCnpj) {
      return res.status(400).json({ error: 'O CNPJ da empresa já foi cadastrado e não pode mais ser alterado. Solicite ao suporte técnico caso precise de ajuda.' });
    }

    try {
      // Verificar se há um arquivo de imagem de logo novo
      let logo_url = req.body.logo_url; // Se for string mantida
      if (req.file) {
        logo_url = `/api/uploads/${req.file.filename}`;
      }

      db.run(
        `UPDATE companies 
         SET name = ?, cnpj = ?, logo_url = COALESCE(?, logo_url), 
             bank_name = ?, bank_agency = ?, bank_account = ?, bank_owner = ?, bank_cpf_pix = ?
         WHERE id = ?`,
        [
          name,
          cnpj || '',
          logo_url,
          bank_name || '',
          bank_agency || '',
          bank_account || '',
          bank_owner || '',
          bank_cpf_pix || '',
          companyId
        ],
        function (err) {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao atualizar dados da empresa.' });
          }
          return res.json({
            message: 'Dados da empresa atualizados com sucesso!',
            logo_url: logo_url
          });
        }
      );
    } catch (err) {
      console.error('Erro ao fazer upload da logo:', err);
      return res.status(500).json({ error: 'Erro ao fazer upload do logotipo.' });
    }
  });
};

// Listar funcionários (pilotos) da empresa
exports.listPilots = (req, res) => {
  const companyId = req.user.company_id;

  db.all(
    `SELECT id, username, name, created_at, commission_type, salary_base, commission_per_ha, commission_percentage 
     FROM users 
     WHERE company_id = ? AND role = 'pilot'
     ORDER BY name ASC`,
    [companyId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao listar pilotos.' });
      }
      return res.json({ pilots: rows });
    }
  );
};

// Criar novo funcionário (piloto)
exports.createPilot = (req, res) => {
  const companyId = req.user.company_id;
  const { name, username, password, commission_type, salary_base, commission_per_ha, commission_percentage } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Nome, usuário e senha são obrigatórios.' });
  }

  // Verificar limite de pilotos do plano da empresa
  db.get(
    `SELECT c.plan_name, 
     (SELECT COUNT(*) FROM users WHERE company_id = c.id AND role = 'pilot') as current_pilots
     FROM companies c WHERE c.id = ?`,
    [companyId],
    (err, row) => {
      if (err || !row) {
        return res.status(500).json({ error: 'Erro ao verificar plano da empresa.' });
      }

      // Plano Básico limite: 3 pilotos. Se for Pro, ilimitado (ou 50)
      const limit = row.plan_name === 'Pro' ? 100 : 3;
      if (row.current_pilots >= limit) {
        return res.status(400).json({
          error: `Seu plano atual (${row.plan_name}) permite no máximo ${limit} pilotos. Faça upgrade para cadastrar mais.`
        });
      }

      // Hash da senha
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(password, salt);

      db.run(
        `INSERT INTO users (username, password, role, company_id, name, commission_type, salary_base, commission_per_ha, commission_percentage) 
         VALUES (?, ?, 'pilot', ?, ?, ?, ?, ?, ?)`,
        [
          username, 
          hashedPassword, 
          companyId, 
          name, 
          commission_type || 'commission_per_ha', 
          parseFloat(salary_base) || 0, 
          parseFloat(commission_per_ha) || 0, 
          parseFloat(commission_percentage) || 0
        ],
        function (err) {
          if (err) {
            if (
              err.message.includes('UNIQUE constraint failed') ||
              err.message.includes('duplicate key') ||
              err.message.includes('unique constraint')
            ) {
              return res.status(400).json({ error: 'O nome de usuário já está em uso.' });
            }
            return res.status(500).json({ error: 'Erro ao cadastrar piloto.' });
          }
          return res.status(201).json({
            message: 'Piloto cadastrado com sucesso!',
            pilot_id: this.lastID
          });
        }
      );
    }
  );
};

// Excluir funcionário (piloto)
exports.deletePilot = async (req, res) => {
  const companyId = req.user.company_id;
  const { id } = req.params;

  const pilotId = parseInt(id, 10);
  if (isNaN(pilotId)) {
    return res.status(400).json({ error: 'ID de piloto inválido.' });
  }

  // Obter um cliente do pool do PostgreSQL para executar a transação com segurança
  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Verificar se o piloto realmente pertence à empresa do admin e é piloto
    const pilotRes = await client.query(
      `SELECT id FROM users WHERE id = $1 AND company_id = $2 AND role = 'pilot'`,
      [pilotId, companyId]
    );

    if (pilotRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: 'Piloto não encontrado ou não pertence a esta empresa.' });
    }

    // 2. Buscar o ID do usuário admin da empresa para transferir os relatórios
    const adminRes = await client.query(
      `SELECT id FROM users WHERE company_id = $1 AND role = 'admin' ORDER BY id ASC LIMIT 1`,
      [companyId]
    );

    if (adminRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: 'Não foi possível encontrar o administrador da empresa para transferir os relatórios.' });
    }

    const adminId = adminRes.rows[0].id;

    // 3. Atualizar todos os relatórios do piloto para o administrador da empresa
    await client.query(
      `UPDATE reports SET pilot_id = $1 WHERE pilot_id = $2 AND company_id = $3`,
      [adminId, pilotId, companyId]
    );

    // 4. Remover as sessões ativas do piloto para deslogá-lo
    await client.query(
      `DELETE FROM user_sessions WHERE user_id = $1 AND company_id = $2`,
      [pilotId, companyId]
    );

    // 5. Excluir o piloto
    await client.query(
      `DELETE FROM users WHERE id = $1 AND company_id = $2 AND role = 'pilot'`,
      [pilotId, companyId]
    );

    await client.query("COMMIT");

    return res.json({ message: 'Piloto excluído com sucesso e seus relatórios foram transferidos para o administrador!' });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error('Erro ao excluir piloto:', err);
    return res.status(500).json({ error: 'Erro ao excluir piloto.' });
  } finally {
    client.release();
  }
};

// Alterar senha de piloto pelo administrador da empresa
exports.updatePilotPassword = (req, res) => {
  const companyId = req.user.company_id;
  const { id } = req.params;
  const { password } = req.body;

  const pilotId = parseInt(id, 10);
  if (isNaN(pilotId)) {
    return res.status(400).json({ error: 'ID de piloto inválido.' });
  }

  if (!password || password.trim() === '') {
    return res.status(400).json({ error: 'A nova senha é obrigatória.' });
  }

  // Verificar se o piloto pertence à mesma empresa do administrador
  db.get(
    "SELECT id FROM users WHERE id = ? AND company_id = ? AND role = 'pilot'",
    [pilotId, companyId],
    (err, row) => {
      if (err) {
        console.error('Erro ao verificar piloto:', err);
        return res.status(500).json({ error: 'Erro ao verificar piloto.' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Piloto não encontrado ou não pertence a esta empresa.' });
      }

      // Hash da nova senha
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(password, salt);

      // Atualizar a senha
      db.run(
        "UPDATE users SET password = ? WHERE id = ? AND company_id = ? AND role = 'pilot'",
        [hashedPassword, pilotId, companyId],
        function (err) {
          if (err) {
            console.error('Erro ao redefinir senha do piloto:', err);
            return res.status(500).json({ error: 'Erro ao redefinir senha do piloto.' });
          }
          return res.json({ message: 'Senha do piloto redefinida com sucesso!' });
        }
      );
    }
  );
};

// Atualizar perfil do próprio administrador (e opcionalmente alterar senha)
exports.updateAdminProfile = (req, res) => {
  const { id } = req.user; // Obtido do token de autenticação
  const { name, username, currentPassword, newPassword } = req.body;

  if (!name || !name.trim() || !username || !username.trim()) {
    return res.status(400).json({ error: 'Nome e usuário são obrigatórios.' });
  }

  // Primeiro, buscar os dados atuais do usuário para verificar senha e unicidade
  db.get(
    "SELECT id, password FROM users WHERE id = ?",
    [id],
    (err, user) => {
      if (err || !user) {
        return res.status(500).json({ error: 'Erro ao buscar dados do administrador.' });
      }

      // Verificar se o nome de usuário (username) já está em uso por outra pessoa
      db.get(
        "SELECT id FROM users WHERE username = ? AND id != ?",
        [username.trim(), id],
        (err, existingUser) => {
          if (err) {
            return res.status(500).json({ error: 'Erro ao verificar nome de usuário.' });
          }

          if (existingUser) {
            return res.status(400).json({ error: 'O nome de usuário já está em uso.' });
          }

          const hasNewPassword = newPassword && newPassword.trim() !== '';

          if (hasNewPassword) {
            if (!currentPassword || currentPassword.trim() === '') {
              return res.status(400).json({ error: 'A senha atual é necessária para definir uma nova senha.' });
            }

            // Comparar a senha atual com a senha criptografada no banco
            const isPasswordCorrect = bcrypt.compareSync(currentPassword, user.password);
            if (!isPasswordCorrect) {
              return res.status(400).json({ error: 'A senha atual informada está incorreta.' });
            }

            // Gerar hash da nova senha
            const salt = bcrypt.genSaltSync(10);
            const hashedNewPassword = bcrypt.hashSync(newPassword, salt);

            // Atualizar nome, username e senha
            db.run(
              "UPDATE users SET name = ?, username = ?, password = ? WHERE id = ? AND role = 'admin'",
              [name.trim(), username.trim(), hashedNewPassword, id],
              function (err) {
                if (err) {
                  console.error('Erro ao atualizar dados do administrador:', err);
                  return res.status(500).json({ error: 'Erro ao atualizar dados do administrador.' });
                }
                return res.json({
                  message: 'Perfil e senha atualizados com sucesso!',
                  user: { name: name.trim(), username: username.trim() }
                });
              }
            );
          } else {
            // Apenas atualizar nome e username
            db.run(
              "UPDATE users SET name = ?, username = ? WHERE id = ? AND role = 'admin'",
              [name.trim(), username.trim(), id],
              function (err) {
                if (err) {
                  console.error('Erro ao atualizar dados do administrador:', err);
                  return res.status(500).json({ error: 'Erro ao atualizar dados do administrador.' });
                }
                return res.json({
                  message: 'Perfil atualizado com sucesso!',
                  user: { name: name.trim(), username: username.trim() }
                });
              }
            );
          }
        }
      );
    }
  );
};

// Atualizar remuneração do piloto pelo administrador da empresa
exports.updatePilotRemuneration = (req, res) => {
  const companyId = req.user.company_id;
  const { id } = req.params;
  const { commission_type, salary_base, commission_per_ha, commission_percentage } = req.body;

  const pilotId = parseInt(id, 10);
  if (isNaN(pilotId)) {
    return res.status(400).json({ error: 'ID de piloto inválido.' });
  }

  if (!commission_type) {
    return res.status(400).json({ error: 'O tipo de remuneração é obrigatório.' });
  }

  // Verificar se o piloto pertence à mesma empresa do administrador
  db.get(
    "SELECT id FROM users WHERE id = ? AND company_id = ? AND role = 'pilot'",
    [pilotId, companyId],
    (err, row) => {
      if (err) {
        console.error('Erro ao verificar piloto:', err);
        return res.status(500).json({ error: 'Erro ao verificar piloto.' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Piloto não encontrado ou não pertence a esta empresa.' });
      }

      // Atualizar a remuneração
      db.run(
        `UPDATE users 
         SET commission_type = ?, salary_base = ?, commission_per_ha = ?, commission_percentage = ? 
         WHERE id = ? AND company_id = ? AND role = 'pilot'`,
        [
          commission_type, 
          parseFloat(salary_base) || 0, 
          parseFloat(commission_per_ha) || 0, 
          parseFloat(commission_percentage) || 0, 
          pilotId, 
          companyId
        ],
        function (err) {
          if (err) {
            console.error('Erro ao configurar remuneração do piloto:', err);
            return res.status(500).json({ error: 'Erro ao configurar remuneração do piloto.' });
          }
          return res.json({ message: 'Remuneração do piloto atualizada com sucesso!' });
        }
      );
    }
  );
};

