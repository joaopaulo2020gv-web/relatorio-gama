const bcrypt = require('bcryptjs');
const db = require('../database/db');
const cloudinary = require('cloudinary').v2;

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

  try {
    // Verificar se há um arquivo de imagem de logo novo
    let logo_url = req.body.logo_url; // Se for string mantida
    if (req.file) {
      const streamUpload = (fileBuffer) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'relatorio_gama/logos' },
            (error, result) => {
              if (result) {
                resolve(result);
              } else {
                reject(error);
              }
            }
          );
          stream.write(fileBuffer);
          stream.end();
        });
      };
      const result = await streamUpload(req.file.buffer);
      logo_url = result.secure_url;
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
      function(err) {
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
};

// Listar funcionários (pilotos) da empresa
exports.listPilots = (req, res) => {
  const companyId = req.user.company_id;

  db.all(
    `SELECT id, username, name, created_at 
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
  const { name, username, password } = req.body;

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
        `INSERT INTO users (username, password, role, company_id, name) 
         VALUES (?, ?, 'pilot', ?, ?)`,
        [username, hashedPassword, companyId, name],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
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
exports.deletePilot = (req, res) => {
  const companyId = req.user.company_id;
  const { id } = req.params;

  db.run(
    `DELETE FROM users WHERE id = ? AND company_id = ? AND role = 'pilot'`,
    [id, companyId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao excluir piloto.' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Piloto não encontrado ou não pertence a esta empresa.' });
      }
      return res.json({ message: 'Piloto excluído com sucesso!' });
    }
  );
};
