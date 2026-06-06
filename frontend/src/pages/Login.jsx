import React, { useState } from 'react';
import { Sun, Moon, Fingerprint } from 'lucide-react';
import { triggerHaptic } from '../utils/haptic';

export default function Login({ onLoginSuccess, theme, toggleTheme }) {
  const [username, setUsername] = useState(() => localStorage.getItem('gama_remember_username') || '');
  const [password, setPassword] = useState(() => localStorage.getItem('gama_remember_password') || '');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('gama_remember_me') === 'true');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    if (!username || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao realizar login.');
      }

      // Salvar token e dados do usuário
      localStorage.setItem('gama_token', data.token);
      localStorage.setItem('gama_user', JSON.stringify(data.user));

      if (rememberMe) {
        localStorage.setItem('gama_remember_username', username);
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

  return (
    <div class="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-200">
      {/* Botão de Tema */}
      <button
        onClick={toggleTheme}
        type="button"
        class="absolute top-4 right-4 p-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-750 transition-all shadow-md z-20"
        title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Elementos visuais de fundo em degradê */}
      <div class="absolute w-[500px] h-[500px] bg-primary-600/5 dark:bg-primary-600/10 rounded-full blur-3xl -top-40 -left-40"></div>
      <div class="absolute w-[500px] h-[500px] bg-emerald-600/5 dark:bg-emerald-600/10 rounded-full blur-3xl -bottom-40 -right-40"></div>

      <div class="w-full max-w-md bg-white dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 p-8 rounded-3xl shadow-xl dark:shadow-2xl relative z-10">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-600 to-emerald-500 text-white font-extrabold text-2xl mb-4 shadow-lg shadow-primary-500/20">
            D
          </div>
          <h1 class="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">AgroSkan</h1>
          <p class="text-slate-500 dark:text-slate-400 mt-2 font-medium">Gestão de Relatórios de Pulverização por Drones</p>
        </div>

        {error && (
          <div class="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-200 px-4 py-3 rounded-xl text-sm mb-6 flex items-start space-x-2">
            <span class="font-semibold">Erro:</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} class="space-y-6">
          <div>
            <label class="block text-slate-600 dark:text-slate-300 text-sm font-semibold mb-2" htmlFor="username">
              Usuário
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu usuário"
              class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium"
            />
          </div>

          <div>
            <label class="block text-slate-600 dark:text-slate-300 text-sm font-semibold mb-2" htmlFor="password">
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
              class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium"
            />
          </div>

          <div class="flex items-center justify-between">
            <label class="flex items-center space-x-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                class="w-4 h-4 text-primary-600 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded focus:ring-primary-500/50 focus:ring-offset-0 focus:ring-1"
              />
              <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">Lembrar de mim</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            class="w-full py-3.5 bg-gradient-to-r from-primary-600 to-emerald-500 text-white font-bold rounded-xl shadow-lg hover:from-primary-500 hover:to-emerald-400 focus:ring-2 focus:ring-primary-500/30 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? 'Acessando plataforma...' : 'Entrar na Conta'}
          </button>

          {localStorage.getItem('gama_biometrics_active') === 'true' && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={loading}
              class="w-full mt-3 py-3.5 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-600/50 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus:outline-none"
            >
              <Fingerprint size={18} class="text-primary-500" />
              <span>Entrar com Biometria</span>
            </button>
          )}
        </form>

        <div class="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          &copy; {new Date().getFullYear()} AgroSkan. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}
