const db = require('../database/db');
const emailService = require('../services/emailService');
require('dotenv').config();

// Endpoint público para Webhook da Hotmart
exports.hotmartWebhook = async (req, res) => {
  const tokenHeader = req.headers['h2t-shopkey'] || req.headers['h2t-secret'] || req.query.secret;
  const expectedToken = process.env.HOTMART_TOKEN;

  // Validação simples de token se configurado
  if (expectedToken && tokenHeader !== expectedToken) {
    console.warn('Alerta: Requisição rejeitada no webhook da Hotmart - Token inválido.');
    return res.status(401).json({ error: 'Token de segurança inválido.' });
  }

  const payload = req.body;
  console.log('Webhook da Hotmart recebido:', JSON.stringify(payload));

  // Tratar múltiplos formatos de payload da Hotmart (API v2 ou Postback antigo)
  const email = (payload.data && payload.data.buyer && payload.data.buyer.email) || payload.email;
  const name = (payload.data && payload.data.buyer && payload.data.buyer.name) || payload.name || 'Cliente';
  const eventStatus = (payload.data && payload.data.purchase && payload.data.purchase.status) || payload.status || payload.event;

  if (!email) {
    return res.status(400).json({ error: 'E-mail do comprador não encontrado no payload.' });
  }

  // Status de aprovação comuns na Hotmart
  const isApproved = ['APPROVED', 'approved', 'complete', 'COMPLETE', 'PURCHASE_APPROVED'].includes(eventStatus);

  if (isApproved) {
    console.log(`Pagamento Hotmart aprovado para o e-mail: ${email}`);

    // Buscar o usuário administrador associado a esse e-mail no banco de dados
    db.get(
      `SELECT u.id, u.username, u.name, u.company_id, c.name as company_name 
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.email = ? AND u.role = 'admin'`,
      [email.trim().toLowerCase()],
      async (err, user) => {
        if (err) {
          console.error('Erro ao consultar usuário no webhook da Hotmart:', err);
          return res.status(500).json({ error: 'Erro interno no banco de dados.' });
        }

        if (!user) {
          console.warn(`Aviso: Nenhum usuário administrador com e-mail ${email} foi encontrado no AgroSkan para ativar.`);
          // Retornamos 200 para a Hotmart não ficar reenviando o webhook infinitamente
          return res.status(200).json({ message: 'Webhook recebido, mas e-mail não cadastrado na plataforma.' });
        }

        // Estender validade da empresa por 30 dias a partir de hoje
        const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        db.run(
          `UPDATE companies SET plan_status = 'active', plan_expires_at = ? WHERE id = ?`,
          [planExpiresAt, user.company_id],
          async (updateErr) => {
            if (updateErr) {
              console.error('Erro ao ativar empresa no webhook da Hotmart:', updateErr);
              return res.status(500).json({ error: 'Erro ao ativar empresa.' });
            }

            console.log(`Empresa "${user.company_name}" (ID ${user.company_id}) ativada com sucesso via Hotmart até ${planExpiresAt}!`);

            // Disparar e-mail de boas-vindas com o remetente próprio
            await emailService.sendWelcomeEmail(email, user.name, user.username, user.company_name);

            return res.status(200).json({ message: 'Empresa ativada e e-mail enviado com sucesso.' });
          }
        );
      }
    );
  } else {
    console.log(`Evento Hotmart recebido (${eventStatus}) mas não é de aprovação.`);
    return res.status(200).json({ message: 'Evento processado (sem ações adicionais).' });
  }
};

// Endpoint público para Webhook do Asaas
exports.asaasWebhook = async (req, res) => {
  const tokenHeader = req.headers['asaas-access-token'];
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;

  if (expectedToken && tokenHeader !== expectedToken) {
    console.warn('Alerta: Requisição rejeitada no webhook do Asaas - Token inválido.');
    return res.status(401).json({ error: 'Token de segurança inválido.' });
  }

  const payload = req.body;
  console.log('Webhook do Asaas recebido:', JSON.stringify(payload));

  const event = payload.event;
  const payment = payload.payment;

  if (!payment) {
    return res.status(400).json({ error: 'Dados do pagamento não encontrados no payload.' });
  }

  const isApproved = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event);

  if (isApproved) {
    // Buscar preferencialmente por externalReference (que pode carregar o ID da empresa)
    // Se não houver, buscar pelo e-mail do cliente
    const externalRef = payment.externalReference;
    const customerEmail = payment.email || payment.customerEmail;

    console.log(`Pagamento Asaas aprovado. Ref: ${externalRef}, Email: ${customerEmail}`);

    if (externalRef) {
      // Buscar empresa por ID
      db.get(
        `SELECT c.id, c.name, (SELECT email FROM users WHERE company_id = c.id AND role = 'admin' LIMIT 1) as admin_email,
                (SELECT name FROM users WHERE company_id = c.id AND role = 'admin' LIMIT 1) as admin_name,
                (SELECT username FROM users WHERE company_id = c.id AND role = 'admin' LIMIT 1) as admin_username
         FROM companies c WHERE c.id = ?`,
        [parseInt(externalRef, 10)],
        (err, company) => {
          if (err || !company) {
            console.error('Erro ao buscar empresa por externalReference:', err);
            // Tentar fallback por e-mail se ID falhar
            return findByEmailFallback();
          }

          activateCompany(company);
        }
      );
    } else {
      findByEmailFallback();
    }

    function findByEmailFallback() {
      if (!customerEmail) {
        return res.status(400).json({ error: 'E-mail do cliente ou referência externa não informados.' });
      }

      db.get(
        `SELECT u.id, u.username, u.name, u.company_id, c.name as company_name 
         FROM users u
         LEFT JOIN companies c ON u.company_id = c.id
         WHERE u.email = ? AND u.role = 'admin'`,
        [customerEmail.trim().toLowerCase()],
        (err, user) => {
          if (err || !user) {
            console.warn(`Aviso: Nenhum usuário administrador com e-mail ${customerEmail} encontrado para ativação do Asaas.`);
            return res.status(200).json({ message: 'Webhook recebido, mas cliente não cadastrado no AgroSkan.' });
          }

          activateCompany({
            id: user.company_id,
            name: user.company_name,
            admin_email: customerEmail,
            admin_name: user.name,
            admin_username: user.username
          });
        }
      );
    }

    function activateCompany(companyInfo) {
      const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      db.run(
        `UPDATE companies SET plan_status = 'active', plan_expires_at = ? WHERE id = ?`,
        [planExpiresAt, companyInfo.id],
        async (updateErr) => {
          if (updateErr) {
            console.error('Erro ao ativar empresa no webhook do Asaas:', updateErr);
            return res.status(500).json({ error: 'Erro ao ativar empresa.' });
          }

          console.log(`Empresa "${companyInfo.name}" (ID ${companyInfo.id}) ativada com sucesso via Asaas até ${planExpiresAt}!`);

          if (companyInfo.admin_email) {
            await emailService.sendWelcomeEmail(
              companyInfo.admin_email, 
              companyInfo.admin_name || 'Cliente', 
              companyInfo.admin_username, 
              companyInfo.name
            );
          }

          return res.status(200).json({ message: 'Empresa ativada e e-mail enviado com sucesso.' });
        }
      );
    }
  } else {
    console.log(`Evento Asaas recebido (${event}) não requer ativação.`);
    return res.status(200).json({ message: 'Evento processado.' });
  }
};

// Endpoint protegido (SuperAdmin) para ver o status das configurações
exports.getIntegrationsStatus = (req, res) => {
  res.json({
    smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    hotmartConfigured: !!process.env.HOTMART_TOKEN,
    asaasConfigured: !!(process.env.ASAAS_API_KEY && process.env.ASAAS_WEBHOOK_TOKEN)
  });
};
