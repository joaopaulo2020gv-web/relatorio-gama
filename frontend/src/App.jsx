import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import SuperAdmin from './pages/SuperAdmin';
import ClientAdmin from './pages/ClientAdmin';
import PilotDashboard from './pages/PilotDashboard';
import ReportWizard from './pages/ReportWizard';
import ReportView from './pages/ReportView';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Roteamento baseado em estado para máxima compatibilidade offline
  const [page, setPage] = useState('dashboard'); // dashboard, create-report, view-report
  const [selectedReportId, setSelectedReportId] = useState(null);

  // Estados para controle de instalação do PWA
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [shouldAutoPrompt, setShouldAutoPrompt] = useState(false);

  // Estado e Efeitos de Tema (Modo Claro/Escuro)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('agroskan_theme') || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('agroskan_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    // 1. Verificar se o parâmetro de instalação está na URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'install') {
      setShouldAutoPrompt(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      // Prevenir o prompt automático do navegador
      e.preventDefault();
      // Guardar o evento para disparo manual
      setDeferredPrompt(e);
      
      // Se houver o parâmetro na URL, ativa o modal assim que o prompt estiver pronto
      const urlParamsNow = new URLSearchParams(window.location.search);
      if (urlParamsNow.get('action') === 'install') {
        setShowInstallModal(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Se já estiver rodando instalado, limpa a URL
    if (window.matchMedia('(display-mode: standalone)').matches) {
      cleanInstallUrl();
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Abre o modal de instalação se o prompt e o sinalizador automático de URL estiverem ativos
  useEffect(() => {
    if (deferredPrompt && shouldAutoPrompt) {
      setShowInstallModal(true);
    }
  }, [deferredPrompt, shouldAutoPrompt]);

  const cleanInstallUrl = () => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('action')) {
      url.searchParams.delete('action');
      window.history.replaceState({}, document.title, url.pathname);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Disparar prompt de instalação nativa
    deferredPrompt.prompt();
    
    // Aguardar escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Escolha do usuário sobre instalação: ${outcome}`);
    
    // Limpar estados
    setDeferredPrompt(null);
    setShowInstallModal(false);
    setShouldAutoPrompt(false);
    cleanInstallUrl();
  };

  const handleCloseModal = () => {
    setShowInstallModal(false);
    setShouldAutoPrompt(false);
    cleanInstallUrl();
  };

  useEffect(() => {
    const checkAuthToken = async () => {
      const token = localStorage.getItem('gama_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (response.ok && data.user) {
          setUser(data.user);
          localStorage.setItem('gama_user', JSON.stringify(data.user));
        } else {
          // Token inválido ou expirado
          handleLogout();
        }
      } catch (err) {
        console.error('Erro de conexão ao verificar token:', err);
        // Em caso de erro de rede, podemos recuperar os dados do localStorage para modo offline
        const cachedUser = localStorage.getItem('gama_user');
        if (cachedUser) {
          setUser(JSON.parse(cachedUser));
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuthToken();
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setPage('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('gama_token');
    localStorage.removeItem('gama_user');
    setUser(null);
    setPage('dashboard');
  };

  // Renderizador principal das páginas
  const renderContent = () => {
    if (loading) {
      return (
        <div class="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-sm">
          Carregando aplicativo AgroSkan...
        </div>
      );
    }

    // 1. Mostrar tela de Login se não estiver autenticado
    if (!user) {
      return <Login onLoginSuccess={handleLoginSuccess} theme={theme} toggleTheme={toggleTheme} />;
    }

    // 2. Fluxo de Visualização de Relatório (Acessível por Pilotos e Admins de Cliente)
    if (page === 'view-report' && selectedReportId) {
      return (
        <ReportView
          reportId={selectedReportId}
          onBack={() => {
            setSelectedReportId(null);
            setPage('dashboard');
          }}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      );
    }

    // 3. Roteamento por Cargos (Roles)
    switch (user.role) {
      case 'superadmin':
        return <SuperAdmin onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />;

      case 'admin':
        if (page === 'create-report') {
          return (
            <ReportWizard
              onCancel={() => setPage('dashboard')}
              onSaveSuccess={() => {
                setPage('dashboard');
              }}
              theme={theme}
              toggleTheme={toggleTheme}
            />
          );
        }
        return (
          <ClientAdmin
            onLogout={handleLogout}
            onCreateReport={() => setPage('create-report')}
            onViewReport={(reportId) => {
              setSelectedReportId(reportId);
              setPage('view-report');
            }}
            theme={theme}
            toggleTheme={toggleTheme}
          />
        );

      case 'pilot':
        if (page === 'create-report') {
          return (
            <ReportWizard
              onCancel={() => setPage('dashboard')}
              onSaveSuccess={() => {
                setPage('dashboard');
              }}
              theme={theme}
              toggleTheme={toggleTheme}
            />
          );
        }
        return (
          <PilotDashboard
            onLogout={handleLogout}
            onCreateReport={() => setPage('create-report')}
            onViewReport={(reportId) => {
              setSelectedReportId(reportId);
              setPage('view-report');
            }}
            theme={theme}
            toggleTheme={toggleTheme}
          />
        );

      default:
        return (
          <div class="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6 text-center text-slate-800 dark:text-slate-300">
            <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 p-8 rounded-2xl shadow-md">
              <h2 class="text-xl font-bold text-red-500 dark:text-red-400">Cargo não reconhecido</h2>
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Por favor, entre em contato com o suporte técnico para regularizar seu acesso.</p>
              <button onClick={handleLogout} class="mt-6 px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl font-bold text-sm text-slate-800 dark:text-white transition-all">
                Sair da Conta
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      {renderContent()}

      {/* Modal de Instalação PWA */}
      {showInstallModal && (
        <div class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 max-w-sm w-full text-center space-y-6 shadow-2xl animate-fade-in text-slate-800 dark:text-slate-200">
            {/* Ícone do App */}
            <div class="mx-auto w-16 h-16 bg-gradient-to-tr from-primary-600 to-emerald-500 rounded-2xl flex items-center justify-center font-extrabold text-white text-3xl shadow-lg shadow-primary-500/20">
              D
            </div>
            
            <div class="space-y-2">
              <h3 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Instalar Aplicativo</h3>
              <p class="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                Instale o **AgroSkan** na sua tela inicial para acesso rápido, melhor desempenho e operação em campo offline.
              </p>
            </div>

            <div class="flex flex-col space-y-2 pt-2">
              <button
                onClick={handleInstallClick}
                class="w-full bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white font-extrabold text-sm py-3 rounded-xl shadow-lg transition-all"
              >
                Instalar Agora
              </button>
              <button
                onClick={handleCloseModal}
                class="w-full text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-bold text-xs py-2 transition-all"
              >
                Agora Não
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
