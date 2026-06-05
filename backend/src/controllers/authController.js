const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'gama_super_secret_jwt_key_2026_drones';

exports.login = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  // Buscar usuário no banco junto com o limite de conexões do plano da empresa
  db.get(
    `SELECT u.*, c.name as company_name, c.plan_status, c.logo_url, p.max_devices 
     FROM users u 
     LEFT JOIN companies c ON u.company_id = c.id 
     LEFT JOIN plans p ON c.plan_name = p.name
     WHERE u.username = ?`,
    [username],
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
                    logo_url: user.logo_url
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
    `SELECT u.id, u.username, u.role, u.company_id, u.name, c.name as company_name, c.plan_status, c.logo_url 
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
