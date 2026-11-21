const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../database/db');
const emailService = require('../services/emailService');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'gama_super_secret_jwt_key_2026_drones';

exports.login = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  const cleanUsername = username.trim();

  // Buscar usuário no banco junto com o limite de conexões do plano da empresa (insensível a maiúsculas/minúsculas e espaços)
  db.get(
    `SELECT u.*, c.name as company_name, c.cnpj, c.plan_status, c.logo_url, p.max_devices 
     FROM users u 
     LEFT JOIN companies c ON u.company_id = c.id 
     LEFT JOIN plans p ON c.plan_name = p.name
     WHERE LOWER(TRIM(u.username)) = LOWER(TRIM(?))`,
    [cleanUsername],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Erro interno do servidor.' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
      }

      // Validar senha
      const isPasswordValid = bcrypt.compareSync(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
      }

      // Se não for superadmin, verificar se o plano da empresa está ativo
      if (user.role !== 'superadmin') {
        if (!user.plan_status || user.plan_status !== 'active') {
          return res.status(403).json({ 
            error: 'O acesso da sua empresa está suspenso ou inativo. Entre em contato com o suporte do AgroSkan.' 
          });
        }
      }

      // Se for SuperAdmin, não há limite de dispositivos
      if (user.role === 'superadmin') {
        const token = jwt.sign(
          { 
            id: user.id, 
            username: user.username, 
            role: user.role, 
            company_id: user.company_id,
            name: user.name 
          },
          JWT_SECRET,
          { expiresIn: '30d' }
        );

        return res.json({
          token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            company_id: user.company_id,
            name: user.name,
            company_name: user.company_name,
            cnpj: user.cnpj,
            logo_url: user.logo_url
          }
        });
      }

      // Lógica de limite de conexões simultâneas para Admin e Pilotos
      db.all(
        `SELECT id FROM user_sessions WHERE company_id = ? ORDER BY created_at ASC`,
        [user.company_id],
        (sessionErr, sessions) => {
          if (sessionErr) {
            return res.status(500).json({ error: 'Erro ao validar sessões de acesso.' });
          }

          const maxDevices = parseInt(user.max_devices, 10) || 1;

          // Se exceder o limite (usando >= para liberar espaço para a nova sessão)
          if (sessions.length >= maxDevices) {
            const toDeleteCount = sessions.length - maxDevices + 1;
            const toDeleteIds = sessions.slice(0, toDeleteCount).map(s => s.id);

            db.run(
              `DELETE FROM user_sessions WHERE id IN (${toDeleteIds.join(',')})`,
              [],
              (delErr) => {
                if (delErr) {
                  console.error('Erro ao remover sessão expirada:', delErr);
                }
                insertSessionAndSendToken();
              }
            );
          } else {
            insertSessionAndSendToken();
          }

          function insertSessionAndSendToken() {
            const sessionTokenId = Math.random().toString(36).substring(2) + Date.now().toString(36);

            db.run(
              `INSERT INTO user_sessions (user_id, company_id, session_token_id) VALUES (?, ?, ?)`,
              [user.id, user.company_id, sessionTokenId],
              (insErr) => {
                if (insErr) {
                  return res.status(500).json({ error: 'Erro ao criar sessão de acesso.' });
                }

                const token = jwt.sign(
                  { 
                    id: user.id, 
                    username: user.username, 
                    role: user.role, 
                    company_id: user.company_id,
                    name: user.name,
                    session_token_id: sessionTokenId
                  },
                  JWT_SECRET,
                  { expiresIn: '30d' }
                );

                return res.json({
                  token,
                  user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    company_id: user.company_id,
                    name: user.name,
                    company_name: user.company_name,
                    cnpj: user.cnpj,
                    logo_url: user.logo_url,
                    commission_type: user.commission_type,
                    salary_base: user.salary_base,
                    commission_per_ha: user.commission_per_ha,
                    commission_percentage: user.commission_percentage
                  }
                });
              }
            );
          }
        }
      );
    }
  );
};

// Obter dados do usuário logado (para validação do token no frontend)
exports.getCurrentUser = (req, res) => {
  const { id } = req.user;

  db.get(
    `SELECT u.id, u.username, u.role, u.company_id, u.name, u.commission_type, u.salary_base, u.commission_per_ha, u.commission_percentage, c.name as company_name, c.cnpj, c.plan_status, c.logo_url 
     FROM users u 
     LEFT JOIN companies c ON u.company_id = c.id 
     WHERE u.id = ?`,
    [id],
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      if (user.role !== 'superadmin' && user.plan_status !== 'active') {
        return res.status(403).json({ error: 'Plano suspenso ou inativo.' });
      }

      return res.json({ user });
    }
  );
};

// Auto-registro público para novas empresas e administradores
exports.register = async (req, res) => {
  const { 
    companyName, 
    cnpj, 
    adminName, 
    adminUsername, 
    adminPassword,
    adminEmail
  } = req.body;

  if (!companyName || !adminName || !adminUsername || !adminPassword || !adminEmail) {
    return res.status(400).json({ error: 'Nome da empresa, nome do administrador, e-mail, usuário e senha são obrigatórios.' });
  }

  // Obter um cliente do pool do PostgreSQL para executar a transação de forma segura
  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Inserir Empresa
    // O plano padrão ao se auto-cadastrar é 'Básico' e sem expiração definida inicialmente
    const companyRes = await client.query(
      `INSERT INTO companies (name, cnpj, plan_name, plan_status, plan_expires_at) 
       VALUES ($1, $2, 'Básico', 'active', '') RETURNING id`,
      [companyName, cnpj || '']
    );

    const companyId = companyRes.rows[0].id;

    // 2. Hash da senha do administrador
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(adminPassword, salt);

    // 3. Inserir Usuário Administrador da nova empresa
    await client.query(
      `INSERT INTO users (username, password, role, company_id, name, email) 
       VALUES ($1, $2, 'admin', $3, $4, $5)`,
      [adminUsername.trim().toLowerCase(), hashedPassword, companyId, adminName, adminEmail.trim().toLowerCase()]
    );

    await client.query("COMMIT");

    return res.status(201).json({ 
      message: 'Conta criada com sucesso! Você já pode realizar o login.',
      company_id: companyId
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error('Erro na transação de cadastro público:', err);
    if (err.message.includes('unique constraint') || err.message.includes('UNIQUE constraint') || err.message.includes('users_username_key')) {
      return res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
    }
    return res.status(500).json({ error: 'Erro interno ao criar conta e registrar empresa.' });
  } finally {
    client.release();
  }
};

// Solicitar recuperação de senha (envio de e-mail com link/token via Brevo)
exports.forgotPassword = async (req, res) => {
  const { emailOrUsername } = req.body;

  if (!emailOrUsername || !emailOrUsername.trim()) {
    return res.status(400).json({ error: 'Informe seu e-mail ou nome de usuário.' });
  }

  const queryIdentifier = emailOrUsername.trim().toLowerCase();

  // Buscar usuário por e-mail ou nome de usuário (insensível a maiúsculas)
  db.get(
    `SELECT u.id, u.username, u.name, u.email 
     FROM users u 
     WHERE LOWER(TRIM(u.email)) = ? OR LOWER(TRIM(u.username)) = ?`,
    [queryIdentifier, queryIdentifier],
    async (err, user) => {
      if (err) {
        console.error('Erro ao buscar usuário para recuperação:', err);
        return res.status(500).json({ error: 'Erro interno ao processar recuperação.' });
      }

      if (!user) {
        return res.status(404).json({ error: 'Nenhuma conta encontrada com este e-mail ou usuário.' });
      }

      if (!user.email || !user.email.includes('@')) {
        return res.status(400).json({ 
          error: 'Esta conta não possui um e-mail válido cadastrado. Entre em contato com o administrador da sua empresa ou com o suporte.' 
        });
      }

      try {
        // Gerar token criptográfico único
        const token = crypto.randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora de validade

        // Inserir token no banco
        db.run(
          `INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)`,
          [user.id, token, expiresAt],
          async (insErr) => {
            if (insErr) {
              console.error('Erro ao salvar token de recuperação:', insErr);
              return res.status(500).json({ error: 'Erro ao gerar token de recuperação.' });
            }

            // Montar link de recuperação
            const baseUrl = process.env.APP_URL || (req.headers.origin || 'https://agroskan.com.br');
            const resetLink = `${baseUrl}/?reset_token=${token}`;

            try {
              await emailService.sendPasswordResetEmail(user.email, user.name, resetLink, token);
              
              // Mascarar o e-mail para exibição segura (ex: j***o@gmail.com)
              const [userPart, domainPart] = user.email.split('@');
              const maskedUser = userPart.length > 2 
                ? `${userPart[0]}***${userPart[userPart.length - 1]}` 
                : `${userPart[0]}***`;
              const maskedEmail = `${maskedUser}@${domainPart}`;

              return res.json({ 
                message: `Instruções de recuperação foram enviadas para o e-mail ${maskedEmail}. Verifique sua caixa de entrada e spam.` 
              });
            } catch (mailErr) {
              console.error('Erro ao enviar e-mail via Brevo:', mailErr);
              return res.status(500).json({ 
                error: 'Falha ao enviar e-mail pelo serviço Brevo. Verifique as configurações de SMTP/API no servidor.' 
              });
            }
          }
        );
      } catch (genErr) {
        console.error('Erro geral ao gerar token:', genErr);
        return res.status(500).json({ error: 'Erro ao processar solicitação.' });
      }
    }
  );
};

// Redefinir senha com o token recebido
exports.resetPassword = (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token de recuperação e nova senha são obrigatórios.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }

  const cleanToken = token.trim();

  // Validar se o token existe, não foi usado e ainda não expirou
  db.get(
    `SELECT pr.*, u.id as user_id, u.username, u.name 
     FROM password_resets pr
     JOIN users u ON pr.user_id = u.id
     WHERE pr.token = ? AND pr.used = FALSE AND pr.expires_at > CURRENT_TIMESTAMP`,
    [cleanToken],
    (err, resetRecord) => {
      if (err) {
        console.error('Erro ao validar token de redefinição:', err);
        return res.status(500).json({ error: 'Erro interno ao validar solicitação.' });
      }

      if (!resetRecord) {
        return res.status(400).json({ 
          error: 'O link ou token de recuperação é inválido ou já expirou. Por favor, solicite uma nova recuperação.' 
        });
      }

      // Hash da nova senha
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(newPassword, salt);

      // Atualizar a senha do usuário
      db.run(
        `UPDATE users SET password = ? WHERE id = ?`,
        [hashedPassword, resetRecord.user_id],
        (updErr) => {
          if (updErr) {
            console.error('Erro ao atualizar senha no banco:', updErr);
            return res.status(500).json({ error: 'Erro ao atualizar a senha.' });
          }

          // Marcar o token como utilizado para não ser reutilizado
          db.run(
            `UPDATE password_resets SET used = TRUE WHERE id = ?`,
            [resetRecord.id],
            (markErr) => {
              if (markErr) {
                console.warn('Aviso: Erro ao marcar token como usado:', markErr);
              }

              // Limpar sessões do usuário
              db.run(
                `DELETE FROM user_sessions WHERE user_id = ?`,
                [resetRecord.user_id],
                () => {}
              );

              return res.json({ 
                message: 'Sua senha foi redefinida com sucesso! Você já pode realizar login com sua nova senha.' 
              });
            }
          );
        }
      );
    }
  );
};


