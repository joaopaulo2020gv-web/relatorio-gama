import React, { useState } from 'react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Elementos visuais de fundo em degradê */}
      <div class="absolute w-[500px] h-[500px] bg-primary-600/10 rounded-full blur-3xl -top-40 -left-40"></div>
      <div class="absolute w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-3xl -bottom-40 -right-40"></div>

      <div class="w-full max-w-md bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 p-8 rounded-3xl shadow-2xl relative z-10">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-600 to-emerald-500 text-white font-extrabold text-2xl mb-4 shadow-lg shadow-primary-500/20">
            D
          </div>
          <h1 class="text-3xl font-extrabold text-white tracking-tight">AgroSkan</h1>
          <p class="text-slate-400 mt-2 font-medium">Gestão de Relatórios de Pulverização por Drones</p>
        </div>

        {error && (
          <div class="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm mb-6 flex items-start space-x-2">
            <span class="font-semibold">Erro:</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} class="space-y-6">
          <div>
            <label class="block text-slate-300 text-sm font-semibold mb-2" htmlFor="username">
              Usuário
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu usuário"
              class="w-full px-4 py-3 bg-slate-950/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium"
            />
          </div>

          <div>
            <label class="block text-slate-300 text-sm font-semibold mb-2" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              class="w-full px-4 py-3 bg-slate-950/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            class="w-full py-3.5 bg-gradient-to-r from-primary-600 to-emerald-500 text-white font-bold rounded-xl shadow-lg hover:from-primary-500 hover:to-emerald-400 focus:ring-2 focus:ring-primary-500/30 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? 'Acessando plataforma...' : 'Entrar na Conta'}
          </button>
        </form>

        <div class="mt-8 text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} AgroSkan. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}
