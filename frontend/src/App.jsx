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

  if (loading) {
    return (
      <div class="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 font-bold text-sm">
        Carregando aplicativo AgroSkan...
      </div>
    );
  }

  // 1. Mostrar tela de Login se não estiver autenticado
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
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
      />
    );
  }

  // 3. Roteamento por Cargos (Roles)
  switch (user.role) {
    case 'superadmin':
      return <SuperAdmin onLogout={handleLogout} />;

    case 'admin':
      if (page === 'create-report') {
        return (
          <ReportWizard
            onCancel={() => setPage('dashboard')}
            onSaveSuccess={() => {
              setPage('dashboard');
            }}
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
        />
      );

    default:
      return (
        <div class="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center text-slate-300">
          <div>
            <h2 class="text-xl font-bold text-red-400">Cargo não reconhecido</h2>
            <p class="mt-2 text-sm">Por favor, entre em contato com o suporte técnico para regularizar seu acesso.</p>
            <button onClick={handleLogout} class="mt-6 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-sm">
              Sair da Conta
            </button>
          </div>
        </div>
      );
  }
}
