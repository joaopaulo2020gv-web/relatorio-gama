import React, { useState, useEffect } from 'react';
import { Sun, Moon, Fingerprint, KeyRound, Mail, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { triggerHaptic } from '../utils/haptic';

export default function Login({ onLoginSuccess, theme, toggleTheme }) {
  const [mode, setMode] = useState('login'); // 'login', 'register', 'forgot', 'reset'
  
  // Estados de Login
  const [username, setUsername] = useState(() => localStorage.getItem('gama_remember_username') || '');
  const [password, setPassword] = useState(() => localStorage.getItem('gama_remember_password') || '');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('gama_remember_me') === 'true');
  
  // Estados de Registro
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regCnpj, setRegCnpj] = useState('');
  const [regAdminName, setRegAdminName] = useState('');
  const [regAdminEmail, setRegAdminEmail] = useState('');
  const [regAdminUsername, setRegAdminUsername] = useState('');
  const [regAdminPassword, setRegAdminPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Estados de Recuperação / Redefinição via Brevo
  const [forgotInput, setForgotInput] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Detectar link de recuperação de senha com token na URL (?reset_token=xyz ou ?token=xyz)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('reset_token') || params.get('token');
    if (tokenParam) {
      setResetToken(tokenParam);
      setMode('reset');
      setError('');
      setSuccessMessage('Token de recuperação validado na URL. Digite sua nova senha abaixo.');
    }
  }, []);

  const handleBiometricLogin = async () => {
    if (!window.PublicKeyCredential) {
      setError('Autenticação biométrica não é suportada neste navegador.');
      return;
    }

    triggerHaptic(10);
    setError('');
    setLoading(true);

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
      const publicKeyCredentialRequestOptions = {
        challenge: challenge,
        userVerification: "required",
        timeout: 60000
      };

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      });

      if (assertion) {
        const token = localStorage.getItem('gama_biometrics_token');
        const userData = localStorage.getItem('gama_biometrics_user_data');
        if (token && userData) {
          localStorage.setItem('gama_token', token);
          localStorage.setItem('gama_user', userData);
          triggerHaptic(15);
          onLoginSuccess(JSON.parse(userData));
        } else {
          throw new Error('Sessão biométrica expirada. Faça login com usuário e senha para reativar.');
        }
      }
    } catch (err) {
      console.error('Falha na autenticação biométrica:', err);
      setError('A validação biométrica falhou ou foi cancelada.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao realizar login.');
      }

      // Salvar token e dados do usuário
      localStorage.setItem('gama_token', data.token);
      localStorage.setItem('gama_user', JSON.stringify(data.user));

      if (rememberMe) {
        localStorage.setItem('gama_remember_username', cleanUsername);
        localStorage.setItem('gama_remember_password', password);
        localStorage.setItem('gama_remember_me', 'true');
      } else {
        localStorage.removeItem('gama_remember_username');
        localStorage.removeItem('gama_remember_password');
        localStorage.setItem('gama_remember_me', 'false');
      }

      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regCompanyName || !regAdminName || !regAdminEmail || !regAdminUsername || !regAdminPassword || !regConfirmPassword) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (regAdminPassword.length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (regAdminPassword !== regConfirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: regCompanyName.trim(),
          cnpj: regCnpj.trim(),
          adminName: regAdminName.trim(),
          adminEmail: regAdminEmail.trim().toLowerCase(),
          adminUsername: regAdminUsername.trim().toLowerCase(),
          adminPassword: regAdminPassword
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar conta.');
      }

      setSuccessMessage('Conta criada com sucesso! Faça login abaixo para acessar a plataforma.');
      
      // Limpar campos de registro
      setRegCompanyName('');
      setRegCnpj('');
      setRegAdminName('');
      setRegAdminEmail('');
      setRegAdminUsername('');
      setRegAdminPassword('');
      setRegConfirmPassword('');
      
      // Mudar para o modo de login e preencher com o usuário criado
      setUsername(regAdminUsername);
      setPassword('');
      setMode('login');
      triggerHaptic(15);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Solicitar envio de e-mail de recuperação via Brevo
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotInput.trim()) {
      setError('Por favor, digite seu e-mail ou usuário.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername: forgotInput.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao solicitar recuperação de senha.');
      }

      setSuccessMessage(data.message || 'Instruções enviadas para o seu e-mail!');
      triggerHaptic(15);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Redefinir senha utilizando o token recebido
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetToken.trim() || !newPassword || !confirmNewPassword) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken.trim(),
          newPassword: newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao redefinir senha.');
      }

      setSuccessMessage('Senha alterada com sucesso! Faça login com a sua nova senha.');
      setResetToken('');
      setNewPassword('');
      setConfirmNewPassword('');
      setMode('login');
      triggerHaptic(20);

      // Limpar parâmetros da URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Título e subtítulo dinâmicos
  const getHeaderInfo = () => {
    switch (mode) {
      case 'register':
        return {
          title: 'Criar Conta',
          desc: 'Cadastre sua empresa e comece a gerenciar seus relatórios de voos'
        };
      case 'forgot':
        return {
          title: 'Recuperar Senha',
          desc: 'Enviaremos um link de redefinição para seu e-mail cadastrado via Brevo'
        };
      case 'reset':
        return {
          title: 'Nova Senha',
          desc: 'Defina uma nova senha para acessar sua conta AgroSkan'
        };
      default:
        return {
          title: 'AgroSkan',
          desc: 'Gestão de Relatórios de Pulverização por Drones'
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-200">
      {/* Botão de Tema */}
      <button
        onClick={toggleTheme}
        type="button"
        className="absolute top-4 right-4 p-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-750 transition-all shadow-md z-20"
        title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Elementos visuais de fundo em degradê */}
      <div className="absolute w-[500px] h-[500px] bg-primary-600/5 dark:bg-primary-600/10 rounded-full blur-3xl -top-40 -left-40"></div>
      <div className="absolute w-[500px] h-[500px] bg-emerald-600/5 dark:bg-emerald-600/10 rounded-full blur-3xl -bottom-40 -right-40"></div>

      <div className="w-full max-w-md bg-white dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 p-8 rounded-3xl shadow-xl dark:shadow-2xl relative z-10 my-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-600 to-emerald-500 text-white font-extrabold text-2xl mb-4 shadow-lg shadow-primary-500/20">
            {mode === 'forgot' || mode === 'reset' ? <KeyRound size={28} /> : 'D'}
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {headerInfo.title}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium text-sm">
            {headerInfo.desc}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-200 px-4 py-3 rounded-xl text-sm mb-6 flex items-start space-x-2 animate-pulse">
            <span className="font-semibold">Erro:</span>
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-200 px-4 py-3 rounded-xl text-sm mb-6 flex items-start space-x-2">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-500 mt-0.5" />
            <span className="leading-snug">{successMessage}</span>
          </div>
        )}

        {/* 1. MODO LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-slate-600 dark:text-slate-300 text-sm font-semibold mb-2" htmlFor="username">
                Usuário
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-300 text-sm font-semibold mb-2" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-primary-600 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded focus:ring-primary-500/50 focus:ring-offset-0 focus:ring-1"
                />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Lembrar de mim</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccessMessage('');
                  setMode('forgot');
                }}
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline transition-all"
              >
                Esqueceu a senha?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-primary-600 to-emerald-500 text-white font-bold rounded-xl shadow-lg hover:from-primary-500 hover:to-emerald-400 focus:ring-2 focus:ring-primary-500/30 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? 'Acessando plataforma...' : 'Entrar na Conta'}
            </button>

            {localStorage.getItem('gama_biometrics_active') === 'true' && (
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={loading}
                className="w-full mt-3 py-3.5 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-600/50 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus:outline-none"
              >
                <Fingerprint size={18} className="text-primary-500" />
                <span>Entrar com Biometria</span>
              </button>
            )}

            <div className="pt-2 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                Não tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccessMessage('');
                    setMode('register');
                  }}
                  className="text-primary-600 dark:text-primary-450 font-bold hover:underline transition-all"
                >
                  Criar Conta
                </button>
              </p>
            </div>
          </form>
        )}

        {/* 2. MODO RECUPERAR SENHA (FORGOT) */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-600 dark:text-slate-300 text-xs font-semibold mb-1" htmlFor="forgotInput">
                E-mail ou Usuário *
              </label>
              <div className="relative">
                <input
                  id="forgotInput"
                  type="text"
                  value={forgotInput}
                  onChange={(e) => setForgotInput(e.target.value)}
                  placeholder="Seu e-mail ou nome de usuário"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium text-sm"
                  required
                />
                <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-primary-600 to-emerald-500 text-white font-bold rounded-xl shadow-lg hover:from-primary-500 hover:to-emerald-400 focus:ring-2 focus:ring-primary-500/30 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-sm flex items-center justify-center space-x-2"
              >
                <Mail size={16} />
                <span>{loading ? 'Enviando e-mail...' : 'Enviar Link de Recuperação'}</span>
              </button>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccessMessage('');
                    setMode('login');
                  }}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold flex items-center space-x-1"
                >
                  <ArrowLeft size={14} />
                  <span>Voltar ao Login</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccessMessage('');
                    setMode('reset');
                  }}
                  className="text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline"
                >
                  Já tenho um código/token
                </button>
              </div>
            </div>
          </form>
        )}

        {/* 3. MODO REDEFINIR SENHA (RESET COM TOKEN) */}
        {mode === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-600 dark:text-slate-300 text-xs font-semibold mb-1" htmlFor="resetToken">
                Código ou Token de Recuperação *
              </label>
              <div className="relative">
                <input
                  id="resetToken"
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Cole aqui o token recebido no e-mail"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-mono text-xs"
                  required
                />
                <KeyRound size={16} className="absolute left-3.5 top-3 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-300 text-xs font-semibold mb-1" htmlFor="newPassword">
                Nova Senha *
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium text-sm"
                  required
                />
                <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-300 text-xs font-semibold mb-1" htmlFor="confirmNewPassword">
                Confirmar Nova Senha *
              </label>
              <div className="relative">
                <input
                  id="confirmNewPassword"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Digite a nova senha novamente"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium text-sm"
                  required
                />
                <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-primary-600 to-emerald-500 text-white font-bold rounded-xl shadow-lg hover:from-primary-500 hover:to-emerald-400 focus:ring-2 focus:ring-primary-500/30 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-sm flex items-center justify-center space-x-2"
              >
                <Lock size={16} />
                <span>{loading ? 'Redefinindo senha...' : 'Salvar Nova Senha'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccessMessage('');
                  setMode('login');
                }}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-slate-200 dark:border-slate-600/50 transition-all active:scale-[0.98] text-sm focus:outline-none"
              >
                Voltar ao Login
              </button>
            </div>
          </form>
        )}

        {/* 4. MODO REGISTRO DE EMPRESA */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-600 dark:text-slate-300 text-xs font-semibold mb-1" htmlFor="regCompanyName">
                Nome da Empresa *
              </label>
              <input
                id="regCompanyName"
                type="text"
                value={regCompanyName}
                onChange={(e) => setRegCompanyName(e.target.value)}
                placeholder="Ex: Fazenda Progresso"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-300 text-xs font-semibold mb-1" htmlFor="regCnpj">
                CNPJ (Opcional)
              </label>
              <input
                id="regCnpj"
                type="text"
                value={regCnpj}
                onChange={(e) => setRegCnpj(e.target.value)}
                placeholder="Ex: 00.000.000/0000-00"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium text-sm"
              />
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-700/60 my-3"></div>

            <div>
              <label className="block text-slate-600 dark:text-slate-300 text-xs font-semibold mb-1" htmlFor="regAdminName">
                Nome do Administrador *
              </label>
              <input
                id="regAdminName"
                type="text"
                value={regAdminName}
                onChange={(e) => setRegAdminName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-300 text-xs font-semibold mb-1" htmlFor="regAdminEmail">
                E-mail para Contato e Recuperação *
              </label>
              <input
                id="regAdminEmail"
                type="email"
                value={regAdminEmail}
                onChange={(e) => setRegAdminEmail(e.target.value)}
                placeholder="Ex: contato@fazendaprogresso.com.br"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-300 text-xs font-semibold mb-1" htmlFor="regAdminUsername">
                Usuário para Login *
              </label>
              <input
                id="regAdminUsername"
                type="text"
                value={regAdminUsername}
                onChange={(e) => setRegAdminUsername(e.target.value)}
                placeholder="Ex: joaosilva"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 text-xs font-semibold mb-1" htmlFor="regAdminPassword">
                  Senha *
                </label>
                <input
                  id="regAdminPassword"
                  type="password"
                  value={regAdminPassword}
                  onChange={(e) => setRegAdminPassword(e.target.value)}
                  placeholder="Min. 6 dígitos"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 text-xs font-semibold mb-1" htmlFor="regConfirmPassword">
                  Confirmar Senha *
                </label>
                <input
                  id="regConfirmPassword"
                  type="password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium text-sm"
                  required
                />
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-primary-600 to-emerald-500 text-white font-bold rounded-xl shadow-lg hover:from-primary-500 hover:to-emerald-400 focus:ring-2 focus:ring-primary-500/30 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-sm"
              >
                {loading ? 'Criando conta...' : 'Registrar Empresa'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccessMessage('');
                  setMode('login');
                }}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-slate-200 dark:border-slate-600/50 transition-all active:scale-[0.98] text-sm focus:outline-none"
              >
                Voltar ao Login
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          &copy; {new Date().getFullYear()} AgroSkan. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}
