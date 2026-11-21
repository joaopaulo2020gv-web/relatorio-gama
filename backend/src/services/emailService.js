const nodemailer = require('nodemailer');
const https = require('https');
require('dotenv').config();

/**
 * Envia e-mail via Brevo REST API v3 (https://api.brevo.com/v3/smtp/email)
 * Método ideal para ambientes onde as portas SMTP (587/465) podem estar bloqueadas por firewall.
 */
const sendViaBrevoApi = (apiKey, fromEmail, fromName, toEmail, toName, subject, htmlContent) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      sender: {
        name: fromName || 'AgroSkan',
        email: fromEmail
      },
      to: [
        {
          email: toEmail,
          name: toName || toEmail
        }
      ],
      subject: subject,
      htmlContent: htmlContent
    });

    const options = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body || '{}'));
        } else {
          reject(new Error(`Brevo API Error (${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
};

/**
 * Retorna o transportador Nodemailer configurado com Brevo ou outro provedor SMTP
 */
const getTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  // Se o usuário configurar SMTP_USER e SMTP_PASS, podemos usar smtp-relay.brevo.com por padrão se SMTP_HOST não for especificado
  const host = SMTP_HOST || (SMTP_USER ? 'smtp-relay.brevo.com' : null);

  if (!host || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  const port = parseInt(SMTP_PORT, 10) || 587;

  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: port === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
};

/**
 * Função genérica de envio de e-mail com fallback automático:
 * 1. Brevo API (se BREVO_API_KEY existir)
 * 2. Brevo SMTP / Nodemailer (se SMTP_USER e SMTP_PASS existirem)
 * 3. Log no console caso não esteja configurado
 */
const dispatchEmail = async ({ toEmail, toName, subject, htmlContent }) => {
  const fromEmail = process.env.SMTP_FROM || process.env.BREVO_SENDER || 'suporte@agroskan.com';
  const fromName = 'AgroSkan';
  const brevoApiKey = process.env.BREVO_API_KEY;
  const transporter = getTransporter();

  // 1. Tentar via Brevo REST API
  if (brevoApiKey) {
    try {
      console.log(`Enviando e-mail via Brevo API para: ${toEmail}...`);
      const result = await sendViaBrevoApi(brevoApiKey, fromEmail, fromName, toEmail, toName, subject, htmlContent);
      console.log(`E-mail enviado com sucesso via Brevo API para ${toEmail}! MessageId:`, result.messageId || 'OK');
      return { success: true, method: 'brevo-api' };
    } catch (err) {
      console.error(`Falha ao enviar via Brevo API para ${toEmail}:`, err.message);
      // Se tiver transportador SMTP configurado, tenta como fallback
      if (!transporter) throw err;
      console.warn('Tentando fallback via SMTP...');
    }
  }

  // 2. Tentar via Brevo SMTP / Nodemailer
  if (transporter) {
    try {
      console.log(`Enviando e-mail via SMTP (${process.env.SMTP_HOST || 'smtp-relay.brevo.com'}) para: ${toEmail}...`);
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: toEmail,
        subject: subject,
        html: htmlContent
      });
      console.log(`E-mail enviado com sucesso via SMTP para ${toEmail}`);
      return { success: true, method: 'smtp' };
    } catch (err) {
      console.error(`Falha ao enviar via SMTP para ${toEmail}:`, err.message);
      throw err;
    }
  }

  // 3. Fallback: Simulação em console
  console.warn('AVISO: Brevo API (BREVO_API_KEY) ou SMTP (SMTP_USER/SMTP_PASS) não estão configurados no arquivo .env.');
  console.log('--- SIMULAÇÃO DE ENVIO DE E-MAIL (BREVO) ---');
  console.log(`Para: ${toEmail}`);
  console.log(`Assunto: ${subject}`);
  console.log('--------------------------------------------');
  return { success: true, simulated: true };
};

/**
 * Envia e-mail de ativação e dados de acesso para o cliente
 */
const sendWelcomeEmail = async (toEmail, clientName, username, companyName) => {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; color: #334155; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #10b981; margin: 0; font-size: 28px; font-weight: 800;">AgroSkan</h2>
        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Gestão de Relatórios de Pulverização por Drones</p>
      </div>
      
      <p style="font-size: 16px; line-height: 1.5;">Olá <strong>${clientName}</strong>,</p>
      
      <p style="font-size: 15px; line-height: 1.6; color: #475569;">
        É com grande satisfação que informamos que a sua conta da empresa <strong>${companyName}</strong> no AgroSkan foi ativada com sucesso!
      </p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <h4 style="margin: 0 0 12px 0; color: #1e293b; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px;">Seus Dados de Acesso:</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: bold; width: 140px; font-size: 14px;">Plataforma:</td>
            <td style="padding: 8px 0; font-weight: bold; font-size: 14px;"><a href="${process.env.APP_URL || 'https://agroskan.com.br'}" style="color: #10b981; text-decoration: none;">Acessar AgroSkan</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: bold; font-size: 14px;">Usuário (login):</td>
            <td style="padding: 8px 0; font-family: monospace; font-size: 15px; font-weight: bold; color: #0f172a;">${username}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: bold; font-size: 14px;">Senha:</td>
            <td style="padding: 8px 0; color: #64748b; font-style: italic; font-size: 13px;">A senha cadastrada na plataforma.</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 15px; line-height: 1.6; color: #475569;">
        Você já pode acessar a plataforma, cadastrar seus pilotos e começar a gerar relatórios profissionais de pulverização para seus clientes.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.APP_URL || 'https://agroskan.com.br'}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: bold; font-size: 15px; display: inline-block;">
          Entrar na Minha Conta
        </a>
      </div>

      <p style="margin-top: 32px; font-size: 14px; color: #64748b;">Atenciosamente,<br/><strong style="color: #1e293b;">Equipe AgroSkan</strong></p>
      
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        Este é um e-mail transacional gerado automaticamente pelo serviço AgroSkan via Brevo.
      </p>
    </div>
  `;

  return await dispatchEmail({
    toEmail,
    toName: clientName,
    subject: `Bem-vindo ao AgroSkan - Sua conta foi ativada!`,
    htmlContent: html
  });
};

/**
 * Envia e-mail de recuperação de senha com token e link de redefinição
 * @param {string} toEmail E-mail do usuário
 * @param {string} userName Nome do usuário
 * @param {string} resetLink Link completo para redefinir senha
 * @param {string} resetToken Token ou código de verificação
 */
const sendPasswordResetEmail = async (toEmail, userName, resetLink, resetToken) => {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; color: #334155; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #10b981; margin: 0; font-size: 28px; font-weight: 800;">AgroSkan</h2>
        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Recuperação de Acesso à Conta</p>
      </div>
      
      <p style="font-size: 16px; line-height: 1.5;">Olá, <strong>${userName || 'Usuário AgroSkan'}</strong>!</p>
      
      <p style="font-size: 15px; line-height: 1.6; color: #475569;">
        Recebemos uma solicitação para redefinir a senha da sua conta no <strong>AgroSkan</strong>.
      </p>

      <p style="font-size: 15px; line-height: 1.6; color: #475569;">
        Para criar uma nova senha, clique no botão seguro abaixo:
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}" target="_blank" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);">
          Redefinir Minha Senha
        </a>
      </div>

      <div style="background-color: #f8fafc; padding: 16px; border-radius: 12px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
          Ou se preferir, copie e cole o link direto no seu navegador:
        </p>
        <p style="margin: 0; font-size: 12px; word-break: break-all; color: #0284c7; font-family: monospace;">
          ${resetLink}
        </p>
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
          <span style="font-size: 12px; color: #64748b;">Seu código de validação: </span>
          <strong style="font-family: monospace; font-size: 14px; color: #0f172a; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${resetToken}</strong>
        </div>
      </div>

      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; font-size: 13px; color: #92400e;">
          ⚠️ <strong>Importante:</strong> Este link é válido por <strong>1 hora</strong>. Se você não solicitou a redefinição de senha, desconsidere esta mensagem. Sua conta continuará segura.
        </p>
      </div>

      <p style="margin-top: 32px; font-size: 14px; color: #64748b;">Atenciosamente,<br/><strong style="color: #1e293b;">Equipe de Suporte AgroSkan</strong></p>
      
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        Mensagem transacional automática de segurança enviada via Brevo para ${toEmail}.
      </p>
    </div>
  `;

  return await dispatchEmail({
    toEmail,
    toName: userName,
    subject: `AgroSkan - Recuperação de Senha`,
    htmlContent: html
  });
};

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  dispatchEmail
};
