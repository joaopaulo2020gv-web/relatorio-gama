const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
require('dotenv').config();

const db = require('./database/db');
const auth = require('./middleware/auth');
const authController = require('./controllers/authController');
const superAdminController = require('./controllers/superAdminController');
const clientAdminController = require('./controllers/clientAdminController');
const reportController = require('./controllers/reportController');

const app = express();
const PORT = process.env.PORT || 5000;

// Configurar o CORS para aceitar conexões de qualquer porta (desenvolvimento)
app.use(cors());
app.use(express.json());

// Diretório de uploads persistente
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Servir arquivos de upload como estáticos
app.use('/api/uploads', express.static(UPLOADS_DIR));

// Configurar armazenamento do Multer em disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomBytes(12).toString('hex');
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uniqueId}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado. Envie apenas JPG, PNG ou WEBP.'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // limite de 10MB
});

// ==========================================
// ROTAS DE AUTENTICAÇÃO
// ==========================================
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', auth.authenticateToken, authController.getCurrentUser);

// ==========================================
// ROTAS DO SUPER ADMIN (Nível 3)
// ==========================================
app.get('/api/super/companies', 
  auth.authenticateToken, 
  auth.requireSuperAdmin, 
  superAdminController.listCompanies
);
app.post('/api/super/companies', 
  auth.authenticateToken, 
  auth.requireSuperAdmin, 
  superAdminController.createCompany
);
app.put('/api/super/companies/:id', 
  auth.authenticateToken, 
  auth.requireSuperAdmin, 
  superAdminController.updateCompany
);
app.delete('/api/super/companies/:id', 
  auth.authenticateToken, 
  auth.requireSuperAdmin, 
  superAdminController.deleteCompany
);
app.get('/api/super/stats', 
  auth.authenticateToken, 
  auth.requireSuperAdmin, 
  superAdminController.getSystemStats
);
app.put('/api/super/profile', 
  auth.authenticateToken, 
  auth.requireSuperAdmin, 
  superAdminController.updateSuperAdminProfile
);

app.get('/api/super/plans', 
  auth.authenticateToken, 
  auth.requireSuperAdmin, 
  superAdminController.listPlans
);
app.post('/api/super/plans', 
  auth.authenticateToken, 
  auth.requireSuperAdmin, 
  superAdminController.createPlan
);
app.put('/api/super/plans/:id', 
  auth.authenticateToken, 
  auth.requireSuperAdmin, 
  superAdminController.updatePlan
);
app.delete('/api/super/plans/:id', 
  auth.authenticateToken, 
  auth.requireSuperAdmin, 
  superAdminController.deletePlan
);

// ==========================================
// ROTAS DO ADMIN DA EMPRESA (Nível 2)
// ==========================================
app.get('/api/admin/company', 
  auth.authenticateToken, 
  auth.requireCompanyAdmin, 
  clientAdminController.getCompanyDetails
);
// Upload de logo (usando middleware do multer)
app.put('/api/admin/company', 
  auth.authenticateToken, 
  auth.requireCompanyAdmin, 
  upload.single('logo'), 
  clientAdminController.updateCompanyDetails
);
app.get('/api/admin/pilots', 
  auth.authenticateToken, 
  auth.requireCompanyAdmin, 
  clientAdminController.listPilots
);
app.post('/api/admin/pilots', 
  auth.authenticateToken, 
  auth.requireCompanyAdmin, 
  clientAdminController.createPilot
);
app.delete('/api/admin/pilots/:id', 
  auth.authenticateToken, 
  auth.requireCompanyAdmin, 
  clientAdminController.deletePilot
);
app.put('/api/admin/pilots/:id/password', 
  auth.authenticateToken, 
  auth.requireCompanyAdmin, 
  clientAdminController.updatePilotPassword
);
app.put('/api/admin/profile', 
  auth.authenticateToken, 
  auth.requireCompanyAdmin, 
  clientAdminController.updateAdminProfile
);


// ==========================================
// ROTAS DE RELATÓRIOS
// ==========================================
app.post('/api/reports', 
  auth.authenticateToken, 
  reportController.createReport
);
app.get('/api/reports', 
  auth.authenticateToken, 
  reportController.listReports
);
app.get('/api/reports/:id', 
  auth.authenticateToken, 
  reportController.getReportById
);
app.delete('/api/reports/:id', 
  auth.authenticateToken, 
  reportController.deleteReport
);

// Rota de upload de fotos individuais do relatório (pH, mapas)
app.post('/api/reports/upload', 
  auth.authenticateToken, 
  upload.single('photo'), 
  reportController.uploadFile
);

// Rota padrão de verificação de status
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API do AgroSkan funcionando!' });
});

// Inicialização do servidor (condicional para local ou serverless)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

module.exports = app;
