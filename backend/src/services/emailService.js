const nodemailer = require('nodemailer');
require('dotenv').config();

// Criar transportador opcionalmente com base nas variáveis do .env
const getTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('AVISO: Serviço de e-mail SMTP não está totalmente configurado no arquivo .env. Os e-mails serão apenas exibidos no console.');
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10) || 587,
    secure: parseInt(SMTP_PORT, 10) === 465, // true para porta 465, false para outras
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
};

/**
 * Envia e-mail de ativação e dados de acesso para o cliente
 * @param {string} toEmail E-mail do cliente
 * @param {string} clientName Nome do cliente
 * @param {string} username Usuário cadastrado
 * @param {string} companyName Nome da empresa
 */
const sendWelcomeEmail = async (toEmail, clientName, username, companyName) => {
  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_FROM || 'suporte@agroskan.com.br';

  const mailOptions = {
    from: `"AgroSkan" <${fromEmail}>`,
    to: toEmail,
    subject: `Bem-vindo ao AgroSkan - Sua conta foi ativada!`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; color: #334155;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #10b981; margin: 0; font-size: 28px;">AgroSkan</h2>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Gestão de Relatórios de Pulverização por Drones</p>
        </div>
        
        <p>Olá <strong>${clientName}</strong>,</p>
        
        <p>É com grande satisfação que informamos que a sua conta da empresa <strong>${companyName}</strong> no AgroSkan foi ativada com sucesso!</p>
        
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #f1f5f9;">
          <h4 style="margin: 0 0 10px 0; color: #1e293b; font-size: 15px;">Seus Dados de Acesso:</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: bold; width: 130px; font-size: 14px;">Plataforma:</td>
              <td style="padding: 6px 0; font-weight: bold; font-size: 14px;"><a href="https://agroskan.com.br" style="color: #10b981; text-decoration: none;">Acessar AgroSkan</a></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: bold; font-size: 14px;">Usuário (login):</td>
              <td style="padding: 6px 0; font-family: monospace; font-size: 14px; font-weight: bold; color: #0f172a;">${username}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: bold; font-size: 14px;">Senha:</td>
              <td style="padding: 6px 0; color: #64748b; font-style: italic; font-size: 13px;">A senha que você cadastrou na plataforma.</td>
            </tr>
          </table>
        </div>

        <p>Você já pode acessar a plataforma, cadastrar seus pilotos e começar a gerar relatórios profissionais de pulverização para seus clientes.</p>

        <p style="margin-top: 32px;">Atenciosamente,<br/><strong>Equipe AgroSkan</strong></p>
        
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
          Este é um e-mail automático. Não responda a esta mensagem direta.
        </p>
      </div>
    `
  };

  if (transporter) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`E-mail de boas-vindas enviado com sucesso para ${toEmail}`);
    } catch (err) {
      console.error(`Erro ao enviar e-mail de boas-vindas para ${toEmail}:`, err.message);
    }
  } else {
    console.log('--- SIMULAÇÃO DE ENVIO DE E-MAIL ---');
    console.log(`Para: ${toEmail}`);
    console.log(`Assunto: ${mailOptions.subject}`);
    console.log(`Conteúdo do Usuário: ${username} na empresa ${companyName}`);
    console.log('------------------------------------');
  }
};

module.exports = {
  sendWelcomeEmail
};
