import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import SuperAdmin from './pages/SuperAdmin';
import ClientAdmin from './pages/ClientAdmin';
import PilotDashboard from './pages/PilotDashboard';
import ReportWizard from './pages/ReportWizard';
import ReportView from './pages/ReportView';
import { triggerHaptic } from './utils/haptic';

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
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Estado e Efeitos de Tema (Modo Claro/Escuro)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('agroskan_theme') || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      if (themeColorMeta) themeColorMeta.setAttribute('content', '#0f172a'); // slate-900
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      if (themeColorMeta) themeColorMeta.setAttribute('content', '#f8fafc'); // slate-50
    }
    localStorage.setItem('agroskan_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    triggerHaptic(12);
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Sincroniza o histórico do navegador quando a página interna do React muda
  useEffect(() => {
    if (!user) return; // Não gerencia histórico se não estiver autenticado

    const currentState = window.history.state;
    if (!currentState || currentState.page !== page || currentState.reportId !== selectedReportId) {
      window.history.pushState({ page, reportId: selectedReportId }, '', '');
    }
  }, [page, selectedReportId, user]);

  // Escuta o botão físico de voltar do dispositivo
  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state && e.state.page) {
        setPage(e.state.page);
        setSelectedReportId(e.state.reportId || null);
      } else if (user) {
        setPage('dashboard');
        setSelectedReportId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    if (user) {
      window.history.replaceState({ page: 'dashboard', reportId: null }, '', '');
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [user]);

  // Estado calculado para instalação facilitada do PWA
  const isStandalone = typeof window !== 'undefined' && 
                       (window.matchMedia('(display-mode: standalone)').matches || 
                        window.navigator.standalone);
  const showInstallOption = !isStandalone && (deferredPrompt || isIOS);

  const triggerInstallPrompt = () => {
    triggerHaptic(15);
    setShowInstallModal(true);
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
    triggerHaptic(15);
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
    triggerHaptic(8);
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
        return (
          <SuperAdmin 
            onLogout={handleLogout} 
            theme={theme} 
            toggleTheme={toggleTheme} 
            showInstallOption={showInstallOption}
            onTriggerInstall={triggerInstallPrompt}
          />
        );

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
            showInstallOption={showInstallOption}
            onTriggerInstall={triggerInstallPrompt}
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
            showInstallOption={showInstallOption}
            onTriggerInstall={triggerInstallPrompt}
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

            {isIOS && (
              /* Instruções específicas para iOS/Safari/iPhone */
              <div class="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/40 p-4 rounded-2xl text-left text-xs space-y-3 shadow-inner">
                <p class="font-bold text-center text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-1.5 mb-1 text-[11px] uppercase tracking-wider">Passos no iPhone (Safari)</p>
                <div class="flex items-start space-x-2">
                  <span class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-[10px]">1</span>
                  <p class="text-slate-600 dark:text-slate-300 leading-tight">
                    Toque no botão **Compartilhar** do Safari (ícone <svg class="w-3.5 h-3.5 inline-block mb-1 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> na barra inferior).
                  </p>
                </div>
                <div class="flex items-start space-x-2">
                  <span class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-[10px]">2</span>
                  <p class="text-slate-600 dark:text-slate-300 leading-tight">
                    Role a lista para baixo e selecione **Adicionar à Tela de Início** (ícone <svg class="w-3.5 h-3.5 inline-block mb-1 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>).
                  </p>
                </div>
                <div class="flex items-start space-x-2">
                  <span class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-[10px]">3</span>
                  <p class="text-slate-600 dark:text-slate-300 leading-tight">
                    Toque em **Adicionar** no canto superior direito.
                  </p>
                </div>
              </div>
            )}

            <div class="flex flex-col space-y-2 pt-2">
              {!isIOS ? (
                <button
                  onClick={handleInstallClick}
                  class="w-full bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white font-extrabold text-sm py-3 rounded-xl shadow-lg transition-all"
                >
                  Instalar Agora
                </button>
              ) : (
                <button
                  onClick={handleCloseModal}
                  class="w-full bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white font-extrabold text-sm py-3 rounded-xl shadow-lg transition-all"
                >
                  Entendi
                </button>
              )}
              <button
                onClick={handleCloseModal}
                class="w-full text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-bold text-xs py-2 transition-all"
              >
                {!isIOS ? "Agora Não" : "Fechar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
