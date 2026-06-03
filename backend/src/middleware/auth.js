const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'gama_super_secret_jwt_key_2026_drones';

// Middleware principal para verificar se o token é válido
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Espera formato "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token de autenticação não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
    req.user = user;
    next();
  });
};

// Middleware para autorizar apenas SuperAdmin (Nível 3)
const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    next();
  } else {
    res.status(403).json({ error: 'Acesso restrito apenas ao Administrador Geral (SuperAdmin).' });
  }
};

// Middleware para autorizar Admin do Cliente (Nível 2) ou SuperAdmin
const requireCompanyAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    next();
  } else {
    res.status(403).json({ error: 'Acesso restrito apenas ao Administrador do Cliente.' });
  }
};

module.exports = {
  authenticateToken,
  requireSuperAdmin,
  requireCompanyAdmin
};
