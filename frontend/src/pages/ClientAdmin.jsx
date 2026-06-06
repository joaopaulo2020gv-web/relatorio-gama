import React, { useState, useEffect } from 'react';
import { LogOut, Save, UserPlus, Users, FileText, Trash2, Eye, Upload, Plus, BarChart3, TrendingUp, Award, Activity, DollarSign, Layers, Sun, Moon, Download, Search, Fingerprint, Key } from 'lucide-react';
import { getDrafts, deleteDraft } from '../utils/offlineDb';
import { triggerHaptic } from '../utils/haptic';

export default function ClientAdmin({ onLogout, onViewReport, onCreateReport, theme, toggleTheme, showInstallOption, onTriggerInstall }) {
  const user = JSON.parse(localStorage.getItem('gama_user') || '{}');
  const [menuOpen, setMenuOpen] = useState(false);
  const [company, setCompany] = useState({
    name: '', cnpj: '', logo_url: '',
    bank_name: '', bank_agency: '', bank_account: '', bank_owner: '', bank_cpf_pix: '',
    plan_name: 'Básico', plan_expires_at: ''
  });
  const [pilots, setPilots] = useState([]);
  const [reports, setReports] = useState([]);
  const [offlineDrafts, setOfflineDrafts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, settings, pilots, reports
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hasInitialCnpj, setHasInitialCnpj] = useState(false);
  
  // Estados para redefinição de senha de pilotos
  const [selectedPilotForPassword, setSelectedPilotForPassword] = useState(null);
  const [newPilotPassword, setNewPilotPassword] = useState('');
  const [pilotPasswordModalSuccess, setPilotPasswordModalSuccess] = useState('');
  const [pilotPasswordModalError, setPilotPasswordModalError] = useState('');

  // Estados para edição do perfil do administrador
  const [adminName, setAdminName] = useState(user.name || '');
  const [adminUsername, setAdminUsername] = useState(user.username || '');
  const [adminCurrentPassword, setAdminCurrentPassword] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Filtro por Cliente no Dashboard
  const [selectedClientFilter, setSelectedClientFilter] = useState('Todos');

  // Clientes únicos extraídos dinamicamente
  const uniqueClients = React.useMemo(() => {
    const clients = reports.map(r => r.client_name ? r.client_name.trim() : '').filter(Boolean);
    return ['Todos', ...new Set(clients)];
  }, [reports]);

  // Relatórios filtrados para o Dashboard
  const dashboardReports = React.useMemo(() => {
    if (selectedClientFilter === 'Todos') return reports;
    return reports.filter(r => r.client_name && r.client_name.trim() === selectedClientFilter);
  }, [reports, selectedClientFilter]);

  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCulture, setActiveCulture] = useState('Todos');
  const [activePilot, setActivePilot] = useState('Todos');
  const [biometricsActive, setBiometricsActive] = useState(() => localStorage.getItem('gama_biometrics_active') === 'true');

  // Culturas únicas extraídas dinamicamente
  const uniqueCultures = React.useMemo(() => {
    const cultures = reports.map(r => r.culture ? r.culture.trim() : '').filter(Boolean);
    const formatted = cultures.map(c => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase());
    return ['Todos', ...new Set(formatted)];
  }, [reports]);

  // Pilotos únicos extraídos dinamicamente
  const uniquePilots = React.useMemo(() => {
    const pilotNames = reports.map(r => r.pilot_name ? r.pilot_name.trim() : '').filter(Boolean);
    return ['Todos', ...new Set(pilotNames)];
  }, [reports]);

  // Filtragem dos relatórios pelo campo de pesquisa, cultura e piloto
  const filteredReports = reports.filter(r => {
    const matchesSearch = 
      (r.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.farm_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.culture || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.pilot_name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCulture = 
      activeCulture === 'Todos' || 
      (r.culture || '').toLowerCase() === activeCulture.toLowerCase();

    const matchesPilot = 
      activePilot === 'Todos' || 
      (r.pilot_name || '').toLowerCase() === activePilot.toLowerCase();

    return matchesSearch && matchesCulture && matchesPilot;
  });

  // Estados dos formulários
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [companySuccess, setCompanySuccess] = useState('');
  const [companyError, setCompanyError] = useState('');

  const [pilotName, setPilotName] = useState('');
  const [pilotUsername, setPilotUsername] = useState('');
  const [pilotPassword, setPilotPassword] = useState('');
  const [pilotSuccess, setPilotSuccess] = useState('');
  const [pilotError, setPilotError] = useState('');

  const companySlug = (company.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]/g, '');      // remove espaços e caracteres especiais

  // Estados para o Pull-to-Refresh
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = React.useRef(0);

  const handleTouchStart = (e) => {
    if (window.scrollY === 0 && !refreshing) {
      startY.current = e.touches[0].pageY;
      setPulling(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!pulling || refreshing) return;
    const currentY = e.touches[0].pageY;
    const distance = currentY - startY.current;
    if (distance > 0) {
      // Resistência elástica
      const elasticDistance = Math.min(80, distance * 0.4);
      setPullDistance(elasticDistance);
      // Evitar scroll nativo do Chrome
      if (distance > 10 && e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (!pulling) return;
    setPulling(false);
    if (pullDistance > 50) {
      setRefreshing(true);
      setPullDistance(50);
      triggerHaptic(10);
      
      // Executa o refresh do admin
      await fetchCompanyData();
      
      setRefreshing(false);
      setPullDistance(0);
    } else {
      setPullDistance(0);
    }
  };

  const headers = { 'Authorization': `Bearer ${localStorage.getItem('gama_token')}` };

  const fetchOfflineDrafts = async () => {
    try {
      const drafts = await getDrafts();
      setOfflineDrafts(drafts);
    } catch (err) {
      console.error('Erro ao buscar rascunhos offline:', err);
    }
  };

  const handleToggleBiometrics = async () => {
    triggerHaptic(10);
    
    if (biometricsActive) {
      if (window.confirm('Deseja desativar o login por biometria neste dispositivo?')) {
        localStorage.removeItem('gama_biometrics_active');
        localStorage.removeItem('gama_biometrics_token');
        localStorage.removeItem('gama_biometrics_user_data');
        setBiometricsActive(false);
        alert('Biometria desativada com sucesso.');
      }
      return;
    }

    if (!window.PublicKeyCredential) {
      alert('Autenticação biométrica não é suportada neste navegador.');
      return;
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const publicKeyCredentialCreationOptions = {
        challenge: challenge,
        rp: { name: "AgroSkan" },
        user: {
          id: userId,
          name: user.username || 'user',
          displayName: user.name || 'Usuário'
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Forçar Face ID / Touch ID do celular
          userVerification: "required"
        },
        timeout: 60000
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      });

      if (credential) {
        localStorage.setItem('gama_biometrics_active', 'true');
        localStorage.setItem('gama_biometrics_token', localStorage.getItem('gama_token'));
        localStorage.setItem('gama_biometrics_user_data', localStorage.getItem('gama_user'));
        setBiometricsActive(true);
        alert('Face ID / Touch ID configurado com sucesso! Agora você poderá logar com apenas um toque no celular.');
      }
    } catch (err) {
      console.error('Erro ao configurar biometria:', err);
      alert('Seu dispositivo não aceitou ou não suporta a biometria. Certifique-se de que o Face ID/Touch ID está configurado no celular.');
    }
  };

  const fetchCompanyData = async () => {
    try {
      const compRes = await fetch('/api/admin/company', { headers });
      const compData = await compRes.json();
      if (compRes.ok && compData.company) {
        setCompany(compData.company);
        if (compData.company.cnpj && compData.company.cnpj.trim() !== '') {
          setHasInitialCnpj(true);
        } else {
          setHasInitialCnpj(false);
        }
        if (compData.company.logo_url) {
          setLogoPreview(compData.company.logo_url);
        }
      }

      const pilotsRes = await fetch('/api/admin/pilots', { headers });
      const pilotsData = await pilotsRes.json();
      if (pilotsRes.ok) setPilots(pilotsData.pilots);

      const reportsRes = await fetch('/api/reports', { headers });
      const reportsData = await reportsRes.json();
      if (reportsRes.ok) setReports(reportsData.reports);

      await fetchOfflineDrafts();
    } catch (err) {
      console.error('Erro ao buscar dados do painel administrador:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const base64ToBlob = (base64) => {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const isBase64 = (str) => typeof str === 'string' && str.startsWith('data:image/');

  const handleSyncOfflineReports = async () => {
    if (!navigator.onLine) {
      alert('Você ainda está sem internet. Não é possível sincronizar no momento.');
      return;
    }

    if (offlineDrafts.length === 0) return;

    setSyncing(true);
    setSyncProgress('Iniciando sincronização...');

    try {
      for (let i = 0; i < offlineDrafts.length; i++) {
        const draft = offlineDrafts[i];
        setSyncProgress(`Sincronizando relatório ${i + 1} de ${offlineDrafts.length}...`);

        let updatedPhPhotoUrl = draft.ph_photo_url;
        let updatedMaps = [...(draft.maps_data || [])];

        // 1. Upload da foto do pH se for base64
        if (isBase64(updatedPhPhotoUrl)) {
          setSyncProgress(`Enviando foto de pH do relatório ${i + 1}...`);
          const blob = base64ToBlob(updatedPhPhotoUrl);
          const file = new File([blob], 'ph_photo.jpg', { type: blob.type });
          const formData = new FormData();
          formData.append('photo', file);

          const uploadRes = await fetch('/api/reports/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('gama_token')}` },
            body: formData
          });

          if (uploadRes.ok) {
            const data = await uploadRes.json();
            updatedPhPhotoUrl = data.url;
          } else {
            throw new Error('Falha no upload da foto de pH.');
          }
        }

        // 2. Upload das fotos dos mapas se forem base64
        for (let j = 0; j < updatedMaps.length; j++) {
          const map = updatedMaps[j];
          if (isBase64(map.photo_url)) {
            setSyncProgress(`Enviando mapa ${j + 1} do relatório ${i + 1}...`);
            const blob = base64ToBlob(map.photo_url);
            const file = new File([blob], `map_photo_${j}.jpg`, { type: blob.type });
            const formData = new FormData();
            formData.append('photo', file);

            const uploadRes = await fetch('/api/reports/upload', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${localStorage.getItem('gama_token')}` },
              body: formData
            });

            if (uploadRes.ok) {
              const data = await uploadRes.json();
              updatedMaps[j] = {
                ...map,
                photo_url: data.url
              };
            } else {
              throw new Error(`Falha no upload do mapa ${j + 1}.`);
            }
          }
        }

        // 3. Salvar relatório atualizado na API
        setSyncProgress(`Salvando dados do relatório ${i + 1} no servidor...`);
        const reportPayload = {
          ...draft,
          ph_photo_url: updatedPhPhotoUrl,
          maps_data: updatedMaps
        };

        delete reportPayload.id;
        delete reportPayload.savedAt;

        const response = await fetch('/api/reports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('gama_token')}`
          },
          body: JSON.stringify(reportPayload)
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Erro ao salvar relatório no servidor.');
        }

        // 4. Deletar rascunho com sucesso do IndexedDB
        await deleteDraft(draft.id);
      }

      alert('Todos os relatórios foram sincronizados com sucesso!');
      fetchOfflineDrafts();
      fetchCompanyData();
    } catch (err) {
      console.error(err);
      alert(`Erro durante a sincronização: ${err.message}`);
    } finally {
      setSyncing(false);
      setSyncProgress('');
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleUpdateCompany = async (e) => {
    e.preventDefault();
    setCompanySuccess('');
    setCompanyError('');

    const formData = new FormData();
    formData.append('name', company.name);
    formData.append('cnpj', company.cnpj);
    formData.append('bank_name', company.bank_name);
    formData.append('bank_agency', company.bank_agency);
    formData.append('bank_account', company.bank_account);
    formData.append('bank_owner', company.bank_owner);
    formData.append('bank_cpf_pix', company.bank_cpf_pix);
    
    if (logoFile) {
      formData.append('logo', logoFile);
    } else {
      formData.append('logo_url', company.logo_url);
    }

    try {
      const response = await fetch('/api/admin/company', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('gama_token')}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar dados.');
      }

      setCompanySuccess('Dados da empresa atualizados com sucesso!');
      if (data.logo_url) {
        setCompany(prev => ({ ...prev, logo_url: data.logo_url }));
        setLogoPreview(data.logo_url);
      }
      fetchCompanyData();
    } catch (err) {
      setCompanyError(err.message);
    }
  };

  const handleCreatePilot = async (e) => {
    e.preventDefault();
    setPilotSuccess('');
    setPilotError('');

    if (!pilotName || !pilotUsername || !pilotPassword) {
      setPilotError('Por favor, preencha todos os campos.');
      return;
    }

    try {
      const response = await fetch('/api/admin/pilots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gama_token')}`
        },
        body: JSON.stringify({
          name: pilotName,
          username: `${pilotUsername}@${companySlug}`,
          password: pilotPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao cadastrar piloto.');
      }

      setPilotSuccess('Piloto cadastrado com sucesso!');
      setPilotName('');
      setPilotUsername('');
      setPilotPassword('');
      fetchCompanyData();
    } catch (err) {
      setPilotError(err.message);
    }
  };

  const handleDeletePilot = async (pilotId) => {
    if (!window.confirm('Deseja realmente excluir este piloto? Ele perderá o acesso imediatamente.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/pilots/${pilotId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('gama_token')}` }
      });

      const data = await response.json();
      if (response.ok) {
        fetchCompanyData();
      } else {
        alert(data.error || 'Erro ao excluir piloto.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao se conectar ao servidor para excluir o piloto.');
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Tem certeza que deseja excluir este relatório permanentemente?')) {
      return;
    }

    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('gama_token')}` }
      });

      if (response.ok) {
        fetchCompanyData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateAdminProfile = async (e) => {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');

    if (!adminName.trim() || !adminUsername.trim()) {
      setProfileError('Nome e usuário são obrigatórios.');
      return;
    }

    if (adminNewPassword.trim() !== '' && !adminCurrentPassword.trim()) {
      setProfileError('Você deve informar sua senha atual para definir uma nova.');
      return;
    }

    try {
      const response = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gama_token')}`
        },
        body: JSON.stringify({
          name: adminName,
          username: adminUsername,
          currentPassword: adminCurrentPassword,
          newPassword: adminNewPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar dados de acesso.');
      }

      setProfileSuccess('Dados de perfil atualizados com sucesso!');
      
      // Atualizar cache de usuário logado
      const updatedUser = { ...user, name: data.user.name, username: data.user.username };
      localStorage.setItem('gama_user', JSON.stringify(updatedUser));
      
      setAdminCurrentPassword('');
      setAdminNewPassword('');

      // Recarrega informações
      fetchCompanyData();
    } catch (err) {
      setProfileError(err.message);
    }
  };


  // --- Estatísticas do Dashboard ---
  const totalLaudos = dashboardReports.length;
  const totalArea = dashboardReports.reduce((sum, r) => sum + (parseFloat(r.total_area) || 0), 0);
  const faturamentoTotal = dashboardReports.reduce((sum, r) => sum + (parseFloat(r.total_price) || 0), 0);
  const ticketMedioHa = totalArea > 0 ? (faturamentoTotal / totalArea) : 0;

  // 1. Performance por Piloto
  const pilotStatsMap = {};
  dashboardReports.forEach(r => {
    const pilotName = r.pilot_name || 'Desconhecido';
    if (!pilotStatsMap[pilotName]) {
      pilotStatsMap[pilotName] = { name: pilotName, area: 0, revenue: 0, count: 0 };
    }
    pilotStatsMap[pilotName].area += parseFloat(r.total_area) || 0;
    pilotStatsMap[pilotName].revenue += parseFloat(r.total_price) || 0;
    pilotStatsMap[pilotName].count += 1;
  });
  const pilotPerformance = Object.values(pilotStatsMap).sort((a, b) => b.area - a.area);

  // 2. Mix de Culturas
  const cultureStatsMap = {};
  dashboardReports.forEach(r => {
    const culture = r.culture || 'Outras';
    if (!cultureStatsMap[culture]) {
      cultureStatsMap[culture] = { name: culture, area: 0, count: 0 };
    }
    cultureStatsMap[culture].area += parseFloat(r.total_area) || 0;
    cultureStatsMap[culture].count += 1;
  });
  const cultureMix = Object.values(cultureStatsMap).sort((a, b) => b.area - a.area);

  // 3. Atividades Recentes
  const recentReports = [...dashboardReports].slice(0, 3);

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      class="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans flex flex-col md:flex-row relative transition-colors duration-200 overflow-hidden"
    >
      {/* Pull to Refresh Spinner Indicator */}
      <div 
        class="fixed left-1/2 -translate-x-1/2 z-40 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 w-10 h-10 rounded-full shadow-lg pointer-events-none transition-all"
        style={{ 
          top: `${pullDistance + 10}px`,
          opacity: pullDistance > 10 ? 1 : 0,
          transition: pulling ? 'none' : 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <svg 
          class={`w-5 h-5 text-primary-500 ${refreshing ? 'animate-spin' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          style={{ 
            transform: refreshing ? 'none' : `rotate(${pullDistance * 6}deg)`,
            transition: refreshing ? 'none' : 'transform 0.1s linear'
          }}
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3" />
        </svg>
      </div>
      
      {/* Header Mobile */}
      <header class="md:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/60 px-5 py-4 flex items-center justify-between sticky top-0 z-40 w-full transition-colors duration-200">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-emerald-500 flex items-center justify-center font-extrabold text-white text-base">
            D
          </div>
          <div>
            <h2 class="text-base font-bold leading-tight text-slate-900 dark:text-white">AgroSkan</h2>
            <p class="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider leading-none">Painel Administrativo</p>
          </div>
        </div>
        <div class="flex items-center space-x-1">
          {window.PublicKeyCredential && (
            <button
              onClick={handleToggleBiometrics}
              type="button"
              class={`p-2 transition-colors focus:outline-none ${
                biometricsActive ? 'text-primary-500' : 'text-slate-550 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
              }`}
              title={biometricsActive ? 'Biometria Ativa (Clique para desativar)' : 'Ativar Login por Biometria'}
            >
              <Fingerprint size={18} />
            </button>
          )}
          <button
            onClick={toggleTheme}
            type="button"
            class="p-2 text-slate-550 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            class="p-2 text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-white focus:outline-none transition-colors"
            aria-label="Abrir menu"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Overlay escuro de fundo no mobile */}
      {menuOpen && (
        <div 
          onClick={() => setMenuOpen(false)}
          class="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Sidebar de Navegação */}
      <aside class={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700/60 flex flex-col transform transition-transform duration-300 md:relative md:translate-x-0 transition-colors duration-200 ${
        menuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-emerald-500 flex items-center justify-center font-extrabold text-white text-lg">
            D
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">AgroSkan</h2>
            <p class="text-[10px] text-slate-550 dark:text-slate-400 font-bold uppercase tracking-wider">Painel Administrativo</p>
          </div>
        </div>

        <nav class="flex-1 p-4 space-y-2">
          <button
            onClick={() => {
              setActiveTab('dashboard');
              setMenuOpen(false);
            }}
            class={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'dashboard' 
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/10' 
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/40 dark:hover:text-white'
            }`}
          >
            <BarChart3 size={18} />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('settings');
              setMenuOpen(false);
            }}
            class={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'settings' 
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/10' 
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/40 dark:hover:text-white'
            }`}
          >
            <Save size={18} />
            <span>Dados da Empresa</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('pilots');
              setMenuOpen(false);
            }}
            class={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'pilots' 
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/10' 
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/40 dark:hover:text-white'
            }`}
          >
            <Users size={18} />
            <span>Gerenciar Pilotos</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('reports');
              setMenuOpen(false);
            }}
            class={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'reports' 
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/10' 
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/40 dark:hover:text-white'
            }`}
          >
            <FileText size={18} />
            <span>Relatórios Emitidos</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic(12);
              setMenuOpen(false);
              onCreateReport();
            }}
            class="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-700/40 dark:hover:text-white transition-all"
          >
            <Plus size={18} />
            <span>Elaborar Relatório</span>
          </button>
        </nav>

        <div class="p-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
          {/* Botão de Instalação (se elegível e não instalado) */}
          {showInstallOption && (
            <button
              onClick={onTriggerInstall}
              type="button"
              class="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white border border-primary-500/20 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all animate-pulse mb-2"
            >
              <Download size={15} />
              <span>Instalar Aplicativo</span>
            </button>
          )}

          {/* Botão de Biometria (se disponível) */}
          {window.PublicKeyCredential && (
            <button
              onClick={handleToggleBiometrics}
              type="button"
              class={`w-full flex items-center justify-center space-x-2 border py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 focus:outline-none mb-2 ${
                biometricsActive
                  ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-200 dark:border-primary-500/35'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600/50'
              }`}
            >
              <Fingerprint size={15} />
              <span>{biometricsActive ? 'Biometria Ativa' : 'Ativar Biometria'}</span>
            </button>
          )}

          {/* Alternador de Tema */}
          <button
            onClick={toggleTheme}
            type="button"
            class="w-full flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600/50 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
          </button>

          <button
            onClick={() => { triggerHaptic(12); onLogout(); }}
            class="w-full flex items-center justify-center space-x-2 bg-slate-100 hover:bg-red-500/10 hover:text-red-600 dark:bg-slate-700/50 dark:hover:bg-red-500/10 dark:hover:text-red-200 border border-slate-200 dark:border-slate-600/50 dark:hover:border-red-500/20 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main class="flex-1 p-6 pb-24 md:pb-6 md:overflow-y-auto md:max-h-screen no-scrollbar">
        
        {loading ? (
          <div class="text-center py-12 text-slate-400">Carregando informações...</div>
        ) : (
          <>
            {/* Banner de Sincronização Offline */}
            {offlineDrafts.length > 0 && (
              <div class="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 animate-pulse">
                <div class="flex items-center space-x-3 text-amber-400">
                  <FileText size={22} />
                  <div class="text-sm font-semibold text-slate-200">
                    Você possui <span class="text-amber-400 font-extrabold">{offlineDrafts.length}</span> {offlineDrafts.length === 1 ? 'relatório salvo' : 'relatórios salvos'} offline no aparelho.
                    <p class="text-xs text-slate-400 font-normal mt-0.5">Sincronize-os com o servidor assim que estiver com internet.</p>
                  </div>
                </div>
                <button
                  onClick={handleSyncOfflineReports}
                  disabled={syncing}
                  class="bg-amber-500 hover:bg-amber-400 disabled:bg-amber-600/50 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-md active:scale-95 disabled:pointer-events-none"
                >
                  {syncing ? (
                    <span>{syncProgress || 'Sincronizando...'}</span>
                  ) : (
                    <span>Sincronizar Agora</span>
                  )}
                </button>
              </div>
            )}

            {/* ABA: DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div class="space-y-6">
                {/* Cabeçalho */}
                <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-700/60 pb-4 space-y-3 sm:space-y-0">
                  <div>
                    <h3 class="text-xl font-bold">Dashboard de Indicadores</h3>
                    <p class="text-xs text-slate-400 font-semibold">Visão geral do desempenho e atividades de pulverização da empresa.</p>
                  </div>
                  <div>
                    <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-primary-600/20 text-primary-400 border border-primary-500/25">
                      Atualizado em Tempo Real
                    </span>
                  </div>
                </div>

                {/* Filtro por Cliente */}
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/40 p-4 rounded-2xl gap-3 shadow-md">
                  <div class="flex items-center space-x-2.5">
                    <div class="w-8 h-8 rounded-lg bg-primary-600/10 text-primary-600 dark:text-primary-400 flex items-center justify-center border border-primary-500/20">
                      <Search size={16} />
                    </div>
                    <div>
                      <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Filtro de Análise</span>
                      <span class="text-xs font-semibold text-slate-800 dark:text-slate-200">Selecione um cliente para detalhar os indicadores</span>
                    </div>
                  </div>
                  <div class="w-full sm:w-64">
                    <select
                      value={selectedClientFilter}
                      onChange={(e) => { triggerHaptic(8); setSelectedClientFilter(e.target.value); }}
                      class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary-500 transition-all cursor-pointer"
                    >
                      {uniqueClients.map(client => (
                        <option key={client} value={client}>{client}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Grid de KPIs */}
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Card 1: Faturamento */}
                  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/40 p-5 rounded-2xl flex items-center justify-between relative overflow-hidden group shadow-lg">
                    <div class="absolute w-24 h-24 bg-emerald-500/5 rounded-full -right-4 -bottom-4 group-hover:scale-110 transition-transform duration-300"></div>
                    <div class="space-y-1">
                      <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Faturamento Total</span>
                      <div class="text-xl font-black text-emerald-600 dark:text-emerald-400">
                        {faturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <p class="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">Receitas consolidadas</p>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-md">
                      <DollarSign size={20} />
                    </div>
                  </div>

                  {/* Card 2: Área Aplicada */}
                  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/40 p-5 rounded-2xl flex items-center justify-between relative overflow-hidden group shadow-lg">
                    <div class="absolute w-24 h-24 bg-primary-500/5 rounded-full -right-4 -bottom-4 group-hover:scale-110 transition-transform duration-300"></div>
                    <div class="space-y-1">
                      <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Área Pulverizada</span>
                      <div class="text-xl font-black text-slate-800 dark:text-white">{totalArea.toFixed(1).replace('.', ',')} ha</div>
                      <p class="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">Total trabalhado</p>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center border border-primary-500/20 shadow-md">
                      <TrendingUp size={20} />
                    </div>
                  </div>

                  {/* Card 3: Total Laudos */}
                  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/40 p-5 rounded-2xl flex items-center justify-between relative overflow-hidden group shadow-lg">
                    <div class="absolute w-24 h-24 bg-blue-500/5 rounded-full -right-4 -bottom-4 group-hover:scale-110 transition-transform duration-300"></div>
                    <div class="space-y-1">
                      <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Relatórios Emitidos</span>
                      <div class="text-xl font-black text-slate-800 dark:text-white">{totalLaudos}</div>
                      <p class="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">Documentos gerados</p>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-md">
                      <FileText size={20} />
                    </div>
                  </div>

                  {/* Card 4: Ticket Médio / ha */}
                  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/40 p-5 rounded-2xl flex items-center justify-between relative overflow-hidden group shadow-lg">
                    <div class="absolute w-24 h-24 bg-amber-500/5 rounded-full -right-4 -bottom-4 group-hover:scale-110 transition-transform duration-300"></div>
                    <div class="space-y-1">
                      <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Valor Médio / ha</span>
                      <div class="text-xl font-black text-amber-700 dark:text-amber-400">
                        {ticketMedioHa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <p class="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">Valor médio por hectare</p>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-md">
                      <Activity size={20} />
                    </div>
                  </div>
                </div>

                 {/* Conteúdo Secundário: Rankings de Performance */}
                 <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   
                  {/* Desempenho por Piloto */}
                  <div class="lg:col-span-2 bg-slate-800 border border-slate-700/40 p-6 rounded-2xl space-y-4 flex flex-col justify-between">
                    <h4 class="text-sm font-bold text-primary-400 border-b border-slate-700/60 pb-1.5 uppercase tracking-wider flex items-center space-x-2">
                      <Award size={16} />
                      <span>Produtividade por Piloto</span>
                    </h4>
                    
                    {pilotPerformance.length === 0 ? (
                      <div class="p-8 text-center text-slate-500 text-xs my-auto">Sem dados de aplicação de pilotos ainda.</div>
                    ) : (
                      <div class="space-y-6 flex-1 flex flex-col justify-end">
                        {/* Eixo de Gráfico de Barras Verticais */}
                        <div class="h-44 w-full flex items-end justify-around border-b border-slate-700/60 pb-2 relative mt-4">
                          {pilotPerformance.map((item, idx) => {
                            const maxPilotArea = Math.max(...pilotPerformance.map(p => p.area), 0);
                            const heightPercent = maxPilotArea > 0 ? (item.area / maxPilotArea) * 80 : 0;
                            return (
                              <div key={idx} class="flex flex-col items-center group relative flex-1 max-w-[80px] px-1">
                                {/* Tooltip no hover */}
                                <div class={`absolute -top-12 bg-slate-900 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-[10px] font-black text-center z-10 pointer-events-none transition-all duration-200 ${
                                  hoveredBarIndex === idx ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-1 scale-95'
                                }`}>
                                  <div>{item.area.toFixed(1)} ha</div>
                                  <div class="text-emerald-400 font-extrabold">{item.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</div>
                                </div>

                                {/* Barra */}
                                <div 
                                  onMouseEnter={() => setHoveredBarIndex(idx)}
                                  onMouseLeave={() => setHoveredBarIndex(null)}
                                  style={{ height: `${Math.max(heightPercent, 5)}%` }}
                                  class="w-full bg-gradient-to-t from-primary-600 to-emerald-500 rounded-t-lg transition-all duration-300 cursor-pointer shadow-md shadow-primary-500/10 hover:shadow-primary-500/30 group-hover:scale-105 origin-bottom"
                                />

                                {/* Nome do Piloto */}
                                <span class="text-[10px] text-slate-400 font-bold truncate w-full text-center mt-2.5">
                                  {item.name.split(' ')[0]}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div class="flex justify-between items-center text-[10px] text-slate-500 font-semibold px-2">
                          <span>* Passe o mouse/toque nas barras para ver detalhes</span>
                          <span>Área total do melhor piloto: <strong class="text-slate-400">{Math.max(...pilotPerformance.map(p => p.area), 0).toFixed(1)} ha</strong></span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mix de Culturas */}
                  <div class="lg:col-span-1 bg-slate-800 border border-slate-700/40 p-6 rounded-2xl space-y-4 flex flex-col justify-between">
                    <h4 class="text-sm font-bold text-primary-400 border-b border-slate-700/60 pb-1.5 uppercase tracking-wider flex items-center space-x-2">
                      <Layers size={16} />
                      <span>Mix de Culturas</span>
                    </h4>

                    {cultureMix.length === 0 ? (
                      <div class="p-8 text-center text-slate-500 text-xs my-auto">Sem dados de culturas ainda.</div>
                    ) : (
                      <div class="space-y-6 flex-1 flex flex-col justify-center">
                        <div class="relative flex items-center justify-center h-44">
                          <svg width="160" height="160" viewBox="0 0 120 120" class="transform -rotate-90">
                            <circle cx="60" cy="60" r="50" fill="transparent" stroke="rgba(255,255,255,0.05)" stroke-width="12" />
                            {(() => {
                              const totalMixArea = cultureMix.reduce((sum, c) => sum + c.area, 0);
                              let accumulatedPercent = 0;
                              const donutData = cultureMix.map((item, idx) => {
                                const percent = totalMixArea > 0 ? (item.area / totalMixArea) * 100 : 0;
                                const strokeLength = (percent / 100) * 314.16;
                                const strokeOffset = 314.16 - ((accumulatedPercent / 100) * 314.16);
                                accumulatedPercent += percent;
                                const color = `hsl(${(idx * 137.5) % 360}, 75%, 55%)`;
                                return { ...item, percent, strokeLength, strokeOffset, color };
                              });

                              return donutData.map((item, idx) => (
                                <circle
                                  key={idx}
                                  cx="60"
                                  cy="60"
                                  r="50"
                                  fill="transparent"
                                  stroke={item.color}
                                  stroke-width={hoveredIndex === idx ? 16 : 12}
                                  stroke-dasharray={`${item.strokeLength} 314.16`}
                                  stroke-dashoffset={item.strokeOffset}
                                  stroke-linecap="round"
                                  class="transition-all duration-300 cursor-pointer origin-center hover:scale-105"
                                  onMouseEnter={() => setHoveredIndex(idx)}
                                  onMouseLeave={() => setHoveredIndex(null)}
                                />
                              ));
                            })()}
                          </svg>
                          <div class="absolute text-center flex flex-col justify-center items-center pointer-events-none w-28 overflow-hidden">
                            {hoveredIndex !== null ? (
                              <>
                                <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate w-full">
                                  {cultureMix[hoveredIndex]?.name}
                                </span>
                                <span class="text-sm font-black text-white">
                                  {cultureMix[hoveredIndex]?.area.toFixed(1).replace('.', ',')} ha
                                </span>
                                <span class="text-[9px] text-slate-400 font-semibold">
                                  {(((cultureMix[hoveredIndex]?.area || 0) / (cultureMix.reduce((sum, c) => sum + c.area, 0) || 1)) * 100).toFixed(0)}%
                                </span>
                              </>
                            ) : (
                              <>
                                <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total</span>
                                <span class="text-sm font-black text-white">
                                  {cultureMix.reduce((sum, c) => sum + c.area, 0).toFixed(1).replace('.', ',')} ha
                                </span>
                                <span class="text-[9px] text-slate-500 font-semibold">{cultureMix.length} Culturas</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Legendas coloridas */}
                        <div class="grid grid-cols-2 gap-2 text-[10px] max-h-24 overflow-y-auto pr-1 no-scrollbar">
                          {cultureMix.map((item, idx) => {
                            const totalMixArea = cultureMix.reduce((sum, c) => sum + c.area, 0);
                            const percent = totalMixArea > 0 ? (item.area / totalMixArea) * 100 : 0;
                            const color = `hsl(${(idx * 137.5) % 360}, 75%, 55%)`;
                            return (
                              <div 
                                key={idx} 
                                onMouseEnter={() => setHoveredIndex(idx)}
                                onMouseLeave={() => setHoveredIndex(null)}
                                class={`flex items-center space-x-1.5 cursor-pointer p-1 rounded-lg transition-colors ${
                                  hoveredIndex === idx ? 'bg-slate-700/30' : ''
                                }`}
                              >
                                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></span>
                                <span class="text-slate-350 font-bold truncate flex-1">{item.name}</span>
                                <span class="text-white font-extrabold">{percent.toFixed(0)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                 </div>

                {/* Laudos Recentes */}
                <div class="bg-slate-800 border border-slate-700/40 rounded-2xl overflow-hidden">
                  <div class="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                    <h4 class="text-sm font-bold text-primary-400 uppercase tracking-wider flex items-center space-x-2">
                      <FileText size={16} />
                      <span>Relatórios Recentes</span>
                    </h4>
                    <button
                      onClick={() => setActiveTab('reports')}
                      class="text-[10px] text-primary-400 hover:text-primary-300 font-extrabold uppercase tracking-wider"
                    >
                      Ver Todos →
                    </button>
                  </div>
                  
                  {recentReports.length === 0 ? (
                    <div class="p-12 text-center text-slate-500 text-xs font-semibold">Nenhum relatório emitido até o momento.</div>
                  ) : (
                    <div class="overflow-x-auto">
                      <table class="w-full text-left border-collapse">
                        <thead>
                          <tr class="bg-slate-900/40 text-slate-400 text-[10px] font-bold uppercase border-b border-slate-700">
                            <th class="px-6 py-3">Cliente / Fazenda</th>
                            <th class="px-6 py-3">Data</th>
                            <th class="px-6 py-3">Área</th>
                            <th class="px-6 py-3">Valor</th>
                            <th class="px-6 py-3 text-center">Ação</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-700/40 text-xs font-semibold text-slate-300">
                          {recentReports.map(r => (
                            <tr key={r.id} class="hover:bg-slate-700/10">
                              <td class="px-6 py-3">
                                <div class="font-bold text-white">{r.client_name}</div>
                                <div class="text-[10px] text-slate-500 font-semibold">{r.farm_name}</div>
                              </td>
                              <td class="px-6 py-3">{new Date(r.report_date).toLocaleDateString('pt-BR')}</td>
                              <td class="px-6 py-3 font-bold">{r.total_area} ha</td>
                              <td class="px-6 py-3 text-emerald-400 font-black">
                                {r.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                              <td class="px-6 py-3 text-center">
                                <button
                                  onClick={() => onViewReport(r.id)}
                                  class="px-2.5 py-1 text-[10px] font-bold bg-slate-950/20 hover:bg-primary-600 border border-slate-700 hover:border-primary-500 rounded-lg text-primary-400 hover:text-white transition-all"
                                >
                                  Ver Relatório
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA: DADOS DA EMPRESA */}
            {activeTab === 'settings' && (
              <div class="max-w-3xl space-y-6">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-700/60 pb-4 space-y-3 sm:space-y-0">
                  <div>
                    <h3 class="text-xl font-bold">Configuração da Empresa</h3>
                    <p class="text-xs text-slate-400 font-semibold">Esses dados serão automaticamente inclusos em todos os relatórios finais.</p>
                  </div>
                  <div class="sm:text-right">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-primary-600/20 text-primary-400 border border-primary-500/25 whitespace-nowrap">
                      Plano {company.plan_name}
                    </span>
                  </div>
                </div>

                {companySuccess && <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 px-4 py-3 rounded-xl text-sm">{companySuccess}</div>}
                {companyError && <div class="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-200 px-4 py-3 rounded-xl text-sm">{companyError}</div>}

                <form onSubmit={handleUpdateCompany} class="space-y-6">
                  {/* Grid de Inputs Básicos */}
                  <div class="bg-slate-800 border border-slate-700/40 p-6 rounded-2xl space-y-4">
                    <h4 class="text-sm font-bold text-primary-400 border-b border-slate-700/60 pb-1 uppercase tracking-wider">Identificação</h4>
                    
                    <div class="flex flex-col md:flex-row md:space-x-6 space-y-4 md:space-y-0 items-center">
                      {/* Upload de Logo */}
                      <div class="flex flex-col items-center space-y-3">
                        <div class="w-28 h-28 border-2 border-dashed border-slate-700 rounded-2xl flex items-center justify-center overflow-hidden bg-slate-900 relative">
                          {logoPreview ? (
                            <img src={logoPreview} alt="Logo da empresa" class="w-full h-full object-contain" />
                          ) : (
                            <span class="text-[10px] text-slate-500 font-semibold">Sem Logotipo</span>
                          )}
                        </div>
                        <label class="cursor-pointer flex items-center space-x-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-xl text-xs font-bold transition-all">
                          <Upload size={14} />
                          <span>Enviar Logo</span>
                          <input type="file" accept="image/*" onChange={handleLogoChange} class="hidden" />
                        </label>
                      </div>

                      {/* Nome e CNPJ */}
                      <div class="flex-1 w-full space-y-4">
                        <div>
                          <label class="block text-slate-300 text-xs font-bold mb-1.5">Razão Social / Nome Fantasia *</label>
                          <input
                            type="text"
                            required
                            value={company.name}
                            onChange={(e) => setCompany({ ...company, name: e.target.value })}
                            placeholder="Ex: Nome da Empresa"
                            class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                          />
                        </div>
                        <div>
                          <label class="block text-slate-300 text-xs font-bold mb-1.5">CNPJ da Empresa</label>
                          <input
                            type="text"
                            value={company.cnpj || ''}
                            disabled={hasInitialCnpj}
                            onChange={(e) => setCompany({ ...company, cnpj: e.target.value })}
                            placeholder="Ex: 00.000.000/0001-00"
                            class={`w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm ${
                              hasInitialCnpj ? 'opacity-50 cursor-not-allowed bg-slate-955 bg-slate-950/35' : ''
                            }`}
                          />
                          {hasInitialCnpj && (
                            <span class="text-[10px] text-amber-500 font-semibold mt-1 block">
                              🔒 Bloqueado para edição. Solicite suporte para alterar o CNPJ.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dados Bancários Padrão */}
                  <div class="bg-slate-800 border border-slate-700/40 p-6 rounded-2xl space-y-4">
                    <h4 class="text-sm font-bold text-primary-400 border-b border-slate-700/60 pb-1 uppercase tracking-wider">Dados Bancários Padrão para Recebimento</h4>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class="block text-slate-300 text-xs font-bold mb-1.5">Banco</label>
                        <input
                          type="text"
                          value={company.bank_name || ''}
                          onChange={(e) => setCompany({ ...company, bank_name: e.target.value })}
                          placeholder="Ex: Nome do Banco"
                          class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                        />
                      </div>
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label class="block text-slate-300 text-xs font-bold mb-1.5">Agência</label>
                          <input
                            type="text"
                            value={company.bank_agency || ''}
                            onChange={(e) => setCompany({ ...company, bank_agency: e.target.value })}
                            placeholder="Ex: 0000-0"
                            class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                          />
                        </div>
                        <div>
                          <label class="block text-slate-300 text-xs font-bold mb-1.5">Conta com Dígito</label>
                          <input
                            type="text"
                            value={company.bank_account || ''}
                            onChange={(e) => setCompany({ ...company, bank_account: e.target.value })}
                            placeholder="Ex: 0000000-0"
                            class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class="block text-slate-300 text-xs font-bold mb-1.5">Titular da Conta</label>
                        <input
                          type="text"
                          value={company.bank_owner || ''}
                          onChange={(e) => setCompany({ ...company, bank_owner: e.target.value })}
                          placeholder="Ex: Nome do Titular"
                          class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                        />
                      </div>
                      <div>
                        <label class="block text-slate-300 text-xs font-bold mb-1.5">Chave PIX / CPF do Titular</label>
                        <input
                          type="text"
                          value={company.bank_cpf_pix || ''}
                          onChange={(e) => setCompany({ ...company, bank_cpf_pix: e.target.value })}
                          placeholder="Ex: Chave Pix ou CPF"
                          class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    class="w-full py-3.5 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white font-bold rounded-xl shadow-lg transition-all transform active:scale-[0.99]"
                  >
                    Salvar Alterações
                  </button>
                </form>

                <div class="border-t border-slate-200 dark:border-slate-700/60 my-8"></div>

                {/* Meus Dados de Acesso (Perfil) */}
                <form onSubmit={handleUpdateAdminProfile} class="space-y-6">
                  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/40 p-6 rounded-2xl space-y-4 shadow-lg">
                    <h4 class="text-sm font-bold text-primary-400 border-b border-slate-700/60 pb-1 uppercase tracking-wider flex items-center space-x-2">
                      <Fingerprint size={16} />
                      <span>Meus Dados de Acesso (Perfil)</span>
                    </h4>

                    {profileSuccess && <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 px-4 py-3 rounded-xl text-sm">{profileSuccess}</div>}
                    {profileError && <div class="bg-red-500/10 border border-red-500/20 text-red-650 dark:text-red-200 px-4 py-3 rounded-xl text-sm">{profileError}</div>}

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class="block text-slate-350 dark:text-slate-300 text-xs font-bold mb-1.5">Nome Completo *</label>
                        <input
                          type="text"
                          required
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          placeholder="Ex: Seu Nome"
                          class="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-primary-500 focus:outline-none transition-all font-medium text-sm"
                        />
                      </div>
                      <div>
                        <label class="block text-slate-350 dark:text-slate-300 text-xs font-bold mb-1.5">Nome de Usuário (login) *</label>
                        <input
                          type="text"
                          required
                          value={adminUsername}
                          onChange={(e) => setAdminUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                          placeholder="Ex: admin.empresa"
                          class="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-primary-500 focus:outline-none transition-all font-medium text-sm"
                        />
                      </div>
                    </div>

                    <div class="border-t border-slate-200 dark:border-slate-700/60 pt-4">
                      <span class="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-3 uppercase tracking-wider">Alterar Senha (Opcional)</span>
                      
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label class="block text-slate-350 dark:text-slate-300 text-xs font-bold mb-1.5">Nova Senha</label>
                          <input
                            type="password"
                            value={adminNewPassword}
                            onChange={(e) => setAdminNewPassword(e.target.value)}
                            placeholder="Deixe em branco para não alterar"
                            class="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-primary-500 focus:outline-none transition-all font-medium text-sm"
                          />
                        </div>
                        <div>
                          <label class="block text-slate-350 dark:text-slate-300 text-xs font-bold mb-1.5">
                            Senha Atual {adminNewPassword.trim() !== '' ? '*' : ''}
                          </label>
                          <input
                            type="password"
                            required={adminNewPassword.trim() !== ''}
                            value={adminCurrentPassword}
                            onChange={(e) => setAdminCurrentPassword(e.target.value)}
                            placeholder={adminNewPassword.trim() !== '' ? "Digite sua senha atual" : "Necessária apenas para nova senha"}
                            class="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-primary-500 focus:outline-none transition-all font-medium text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    class="w-full py-3.5 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white font-bold rounded-xl shadow-lg transition-all transform active:scale-[0.99]"
                  >
                    Atualizar Perfil
                  </button>
                </form>
              </div>
            )}

            {/* ABA: GERENCIAR PILOTOS */}
            {activeTab === 'pilots' && (
              <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Cadastrar Piloto */}
                <div class="lg:col-span-1 bg-slate-800 border border-slate-700/40 p-6 rounded-2xl space-y-4 h-fit">
                  <h3 class="text-lg font-bold flex items-center space-x-2">
                    <UserPlus size={20} class="text-primary-500" />
                    <span>Adicionar Piloto</span>
                  </h3>
                  
                  {pilotSuccess && <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 px-3 py-2 rounded-xl text-xs">{pilotSuccess}</div>}
                  {pilotError && <div class="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-200 px-3 py-2 rounded-xl text-xs">{pilotError}</div>}

                  <form onSubmit={handleCreatePilot} class="space-y-4">
                    <div>
                      <label class="block text-slate-300 text-xs font-bold mb-1">Nome Completo *</label>
                      <input
                        type="text"
                        required
                        value={pilotName}
                        onChange={(e) => setPilotName(e.target.value)}
                        placeholder="Ex: Nome do Piloto"
                        class="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                      />
                    </div>
                    <div>
                      <label class="block text-slate-300 text-xs font-bold mb-1">Usuário de Acesso *</label>
                      <div class="flex rounded-xl border border-slate-700 bg-slate-900 overflow-hidden focus-within:border-primary-500 transition-all">
                        <input
                          type="text"
                          required
                          value={pilotUsername}
                          onChange={(e) => setPilotUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                          placeholder="Ex: joao"
                          class="flex-1 px-4 py-2 bg-transparent text-white focus:outline-none font-medium text-sm border-none"
                        />
                        <span class="px-3 py-2 bg-slate-800 text-slate-400 font-bold text-xs flex items-center border-l border-slate-700/60 select-none">
                          @{companySlug || 'empresa'}
                        </span>
                      </div>
                      <p class="text-[10px] text-slate-500 mt-1 font-semibold">
                        O login do piloto será: <strong class="text-slate-400">{pilotUsername || 'usuario'}@{companySlug || 'empresa'}</strong>
                      </p>
                    </div>
                    <div>
                      <label class="block text-slate-300 text-xs font-bold mb-1">Senha Inicial *</label>
                      <input
                        type="password"
                        required
                        value={pilotPassword}
                        onChange={(e) => setPilotPassword(e.target.value)}
                        placeholder="Mínimo 6 dígitos"
                        class="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      class="w-full py-2.5 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl text-sm transition-all"
                    >
                      Cadastrar
                    </button>
                  </form>
                </div>

                {/* Lista de Pilotos */}
                <div class="lg:col-span-2 bg-slate-800 border border-slate-700/40 rounded-2xl overflow-hidden">
                  <div class="px-6 py-5 border-b border-slate-700">
                    <h3 class="text-lg font-bold">Pilotos Registrados</h3>
                  </div>

                  {pilots.length === 0 ? (
                    <div class="p-12 text-center text-slate-400">Nenhum funcionário ou piloto cadastrado ainda.</div>
                  ) : (
                    <div class="overflow-x-auto">
                      <table class="w-full text-left border-collapse">
                        <thead>
                          <tr class="bg-slate-900/50 text-slate-400 text-xs font-bold uppercase border-b border-slate-700">
                            <th class="px-6 py-3">Nome</th>
                            <th class="px-6 py-3">Usuário</th>
                            <th class="px-6 py-3">Data de Cadastro</th>
                            <th class="px-6 py-3 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-700/40">
                          {pilots.map(p => (
                            <tr key={p.id} class="hover:bg-slate-700/10">
                              <td class="px-6 py-4 font-semibold text-white">{p.name}</td>
                              <td class="px-6 py-4 text-slate-300 text-sm font-semibold">{p.username}</td>
                              <td class="px-6 py-4 text-slate-400 text-sm">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                              <td class="px-6 py-4 text-center">
                                <div class="flex items-center justify-center space-x-2">
                                  <button
                                    onClick={() => { triggerHaptic(10); setSelectedPilotForPassword(p); }}
                                    class="p-2 text-slate-400 hover:text-primary-600 dark:hover:text-primary-450 bg-slate-950/20 hover:bg-primary-500/10 border border-slate-700/60 hover:border-primary-500/20 rounded-lg transition-all"
                                    title="Alterar Senha do Piloto"
                                  >
                                    <Key size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePilot(p.id)}
                                    class="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 bg-slate-950/20 hover:bg-red-500/10 border border-slate-700/60 hover:border-red-500/20 rounded-lg transition-all"
                                    title="Excluir Piloto"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA: LAUDOS EMITIDOS */}
            {activeTab === 'reports' && (
              <>
                {offlineDrafts.length > 0 && (
                  <div class="bg-slate-800 border border-slate-700/40 rounded-2xl overflow-hidden mb-6">
                    <div class="px-6 py-5 border-b border-slate-700 flex items-center justify-between">
                      <h4 class="text-sm font-bold text-white flex items-center space-x-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                        <span>Rascunhos Salvos Localmente (Offline)</span>
                      </h4>
                      <button
                        onClick={handleSyncOfflineReports}
                        disabled={syncing}
                        class="bg-amber-550 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-all"
                      >
                        {syncing ? 'Sincronizando...' : 'Sincronizar Todos'}
                      </button>
                    </div>
                    
                    <div class="overflow-x-auto">
                      <table class="w-full text-left border-collapse">
                        <thead>
                          <tr class="bg-slate-900/50 text-slate-400 text-[10px] font-bold uppercase border-b border-slate-700">
                            <th class="px-6 py-3">Cliente / Fazenda</th>
                            <th class="px-6 py-3">Cultura</th>
                            <th class="px-6 py-3">Data Local</th>
                            <th class="px-6 py-3 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-700/40 text-xs font-semibold text-slate-350">
                          {offlineDrafts.map(draft => (
                            <tr key={draft.id} class="hover:bg-slate-700/10">
                              <td class="px-6 py-3">
                                <div class="font-bold text-white">{draft.client_name || 'Sem nome'}</div>
                                <div class="text-[10px] text-slate-500 font-semibold">{draft.farm_name || 'Sem fazenda'}</div>
                              </td>
                              <td class="px-6 py-3">{draft.culture || 'Não informada'}</td>
                              <td class="px-6 py-3">
                                {draft.savedAt ? new Date(draft.savedAt).toLocaleString('pt-BR') : '-'}
                              </td>
                              <td class="px-6 py-3 text-center">
                                <div class="flex items-center justify-center space-x-2">
                                  <button
                                    onClick={() => { triggerHaptic(12); onCreateReport(draft); }}
                                    class="px-3 py-1.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 rounded-lg transition-all border border-amber-500/25 animate-pulse"
                                    title="Editar rascunho local"
                                  >
                                    Editar Rascunho
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (window.confirm('Excluir este rascunho localmente?')) {
                                        triggerHaptic(15);
                                        await deleteDraft(draft.id);
                                        fetchOfflineDrafts();
                                      }
                                    }}
                                    class="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
                                    title="Excluir rascunho local"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div class="bg-slate-800 border border-slate-700/40 rounded-2xl overflow-hidden">
                  <div class="px-6 py-5 border-b border-slate-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <h3 class="text-lg font-bold">Histórico de Relatórios da Empresa</h3>
                    <div class="flex items-center gap-3 flex-wrap w-full md:w-auto">
                      <div class="relative w-full md:w-60">
                        <input
                          type="text"
                          placeholder="Buscar cliente, fazenda, piloto..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          class="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-primary-500 transition-all"
                        />
                        <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                          <Search size={14} />
                        </div>
                      </div>
                      <button
                        onClick={onCreateReport}
                        class="flex items-center space-x-1.5 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all w-full md:w-auto justify-center"
                      >
                        <span>Elaborar Relatório</span>
                      </button>
                    </div>
                  </div>

                  {/* Chips de filtro rápido */}
                  {reports.length > 0 && (
                    <div class="px-6 py-3 bg-slate-50/50 dark:bg-slate-900/10 border-b border-slate-150 dark:border-slate-700/30 space-y-3">
                      {/* Filtro por Cultura */}
                      <div class="flex items-center space-x-2">
                        <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none shrink-0 w-14">Cultura:</span>
                        <div class="flex items-center space-x-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1 flex-1">
                          {uniqueCultures.map(cult => (
                            <button
                              key={cult}
                              onClick={() => { triggerHaptic(6); setActiveCulture(cult); }}
                              class={`px-3 py-1 rounded-full text-xs font-bold transition-all border whitespace-nowrap focus:outline-none ${
                                activeCulture === cult
                                  ? 'bg-primary-600 border-primary-500 text-white shadow-xs'
                                  : 'bg-white dark:bg-slate-800 border-slate-250 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750'
                              }`}
                            >
                              {cult}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Filtro por Piloto */}
                      <div class="flex items-center space-x-2">
                        <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none shrink-0 w-14">Piloto:</span>
                        <div class="flex items-center space-x-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1 flex-1">
                          {uniquePilots.map(pilot => (
                            <button
                              key={pilot}
                              onClick={() => { triggerHaptic(6); setActivePilot(pilot); }}
                              class={`px-3 py-1 rounded-full text-xs font-bold transition-all border whitespace-nowrap focus:outline-none ${
                                activePilot === pilot
                                  ? 'bg-primary-600 border-primary-500 text-white shadow-xs'
                                  : 'bg-white dark:bg-slate-800 border-slate-250 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750'
                              }`}
                            >
                              {pilot}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {reports.length === 0 ? (
                    <div class="p-12 text-center text-slate-400 space-y-4">
                      <p>Nenhum relatório foi gerado por seus pilotos ainda.</p>
                      <button
                        onClick={onCreateReport}
                        class="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl text-xs transition-all"
                      >
                        Elaborar Primeiro Relatório
                      </button>
                    </div>
                  ) : filteredReports.length === 0 ? (
                    <div class="p-16 text-center space-y-4">
                      <div class="w-16 h-16 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
                        <FileText size={28} />
                      </div>
                      <div class="text-slate-550 dark:text-slate-400 font-medium max-w-sm mx-auto">
                        Nenhum relatório corresponde à sua busca ou filtros.
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Tabela para Desktop */}
                      <div class="hidden md:block overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                          <thead>
                            <tr class="bg-slate-900/50 text-slate-400 text-xs font-bold uppercase border-b border-slate-700">
                              <th class="px-6 py-3">Cliente / Fazenda</th>
                              <th class="px-6 py-3">Data Aplicação</th>
                              <th class="px-6 py-3">Área Total (ha)</th>
                              <th class="px-6 py-3">Valor Total</th>
                              <th class="px-6 py-3">Piloto Responsável</th>
                              <th class="px-6 py-3 text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-slate-700/40">
                            {filteredReports.map(r => (
                              <tr key={r.id} class="hover:bg-slate-700/10">
                                <td class="px-6 py-4">
                                  <div class="font-semibold text-white">{r.client_name}</div>
                                  <div class="text-xs text-slate-400 font-semibold">{r.farm_name}</div>
                                </td>
                                <td class="px-6 py-4 text-sm font-semibold text-slate-300">{new Date(r.report_date).toLocaleDateString('pt-BR')}</td>
                                <td class="px-6 py-4 text-sm font-bold text-slate-300">{r.total_area} ha</td>
                                <td class="px-6 py-4 text-sm font-black text-emerald-400">
                                  {r.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </td>
                                <td class="px-6 py-4 text-sm font-semibold text-slate-300">{r.pilot_name}</td>
                                <td class="px-6 py-4 text-center">
                                  <div class="flex items-center justify-center space-x-2">
                                    <button
                                      onClick={() => { triggerHaptic(10); onViewReport(r.id); }}
                                      class="p-2 text-primary-400 hover:text-white bg-slate-950/20 hover:bg-primary-600 border border-slate-700/60 hover:border-primary-500 rounded-lg transition-all"
                                      title="Ver Relatório / Exportar PDF"
                                    >
                                      <Eye size={16} />
                                    </button>
                                    <button
                                      onClick={() => { triggerHaptic(15); handleDeleteReport(r.id); }}
                                      class="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 bg-slate-950/20 hover:bg-red-500/10 border border-slate-700/60 hover:border-red-500/20 rounded-lg transition-all"
                                      title="Excluir Relatório"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Cards para Mobile */}
                      <div class="grid grid-cols-1 gap-4 p-4 md:hidden">
                        {filteredReports.map(r => (
                          <div key={r.id} class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/40 p-4 rounded-2xl space-y-3">
                            <div class="flex justify-between items-start">
                              <div>
                                <div class="font-extrabold text-sm text-slate-900 dark:text-white">{r.client_name}</div>
                                <div class="text-xs text-slate-500 dark:text-slate-400 font-bold">{r.farm_name}</div>
                              </div>
                              <span class="px-2.5 py-1 bg-primary-600/10 text-primary-500 dark:text-primary-400 rounded-lg text-[10px] font-black uppercase">Emitido</span>
                            </div>
                            <div class="grid grid-cols-2 gap-2 text-xs border-t border-b border-slate-200 dark:border-slate-700/30 py-2">
                              <div>
                                <span class="text-slate-400 block text-[9px] font-bold uppercase">Data</span>
                                <span class="font-bold text-slate-800 dark:text-slate-200">{new Date(r.report_date).toLocaleDateString('pt-BR')}</span>
                              </div>
                              <div>
                                <span class="text-slate-400 block text-[9px] font-bold uppercase">Área / Cultura</span>
                                <span class="font-bold text-slate-800 dark:text-slate-200">{r.total_area} ha - {r.culture || 'N/A'}</span>
                              </div>
                              <div>
                                <span class="text-slate-400 block text-[9px] font-bold uppercase">Piloto</span>
                                <span class="font-medium text-slate-800 dark:text-slate-200">{r.pilot_name}</span>
                              </div>
                              <div>
                                <span class="text-slate-400 block text-[9px] font-bold uppercase">Faturamento</span>
                                <span class="font-black text-emerald-600 dark:text-emerald-400">
                                  {r.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </div>
                            </div>
                            <div class="flex items-center justify-between pt-1">
                              <button
                                onClick={() => { triggerHaptic(10); onViewReport(r.id); }}
                                class="flex-1 bg-primary-600 hover:bg-primary-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all mr-2"
                              >
                                <Eye size={14} />
                                <span>Visualizar / PDF</span>
                              </button>
                              <button
                                onClick={() => { triggerHaptic(15); handleDeleteReport(r.id); }}
                                class="p-2.5 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-500/10 border border-slate-200 dark:border-slate-700/40 transition-all"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Barra de Navegação Inferior Fixa (Exclusiva Mobile) */}
      <div class="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/80 py-2 px-6 flex items-center justify-around z-30 md:hidden shadow-lg">
        <button
          onClick={() => { triggerHaptic(8); setActiveTab('dashboard'); }}
          class={`flex flex-col items-center justify-center transition-all active:scale-95 space-y-1 focus:outline-none ${
            activeTab === 'dashboard' ? 'text-primary-600 dark:text-primary-450' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <BarChart3 size={18} />
          <span class="text-[9px] font-bold">Painel</span>
        </button>

        <button
          onClick={() => { triggerHaptic(8); setActiveTab('pilots'); }}
          class={`flex flex-col items-center justify-center transition-all active:scale-95 space-y-1 focus:outline-none ${
            activeTab === 'pilots' ? 'text-primary-600 dark:text-primary-450' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Users size={18} />
          <span class="text-[9px] font-bold">Pilotos</span>
        </button>

        <button
          onClick={() => { triggerHaptic(12); onCreateReport(); }}
          class="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-450 transition-all active:scale-95 space-y-1 focus:outline-none"
        >
          <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-primary-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-primary-500/20">
            <Plus size={16} />
          </div>
          <span class="text-[9px] font-bold">Criar</span>
        </button>

        <button
          onClick={() => { triggerHaptic(8); setActiveTab('reports'); }}
          class={`flex flex-col items-center justify-center transition-all active:scale-95 space-y-1 focus:outline-none ${
            activeTab === 'reports' ? 'text-primary-600 dark:text-primary-450' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <FileText size={18} />
          <span class="text-[9px] font-bold">Laudos</span>
        </button>

        <button
          onClick={() => { triggerHaptic(8); setActiveTab('settings'); }}
          class={`flex flex-col items-center justify-center transition-all active:scale-95 space-y-1 focus:outline-none ${
            activeTab === 'settings' ? 'text-primary-600 dark:text-primary-450' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Save size={18} />
          <span class="text-[9px] font-bold">Ajustes</span>
        </button>
      </div>

      {/* Modal de Reset de Senha do Piloto */}
      {selectedPilotForPassword && (
        <div class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div class="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/60 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 text-slate-800 dark:text-slate-100">
            <div class="flex justify-between items-center border-b border-slate-200 dark:border-slate-700/60 pb-3">
              <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Key size={18} class="text-primary-500" />
                <span>Alterar Senha do Piloto</span>
              </h3>
              <button 
                onClick={() => { setSelectedPilotForPassword(null); setNewPilotPassword(''); setPilotPasswordModalError(''); setPilotPasswordModalSuccess(''); }}
                class="text-slate-400 hover:text-slate-650 dark:hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <p class="text-xs text-slate-550 dark:text-slate-400">
              Defina uma nova senha de acesso para o piloto <strong class="text-slate-900 dark:text-white">{selectedPilotForPassword.name}</strong> ({selectedPilotForPassword.username}).
            </p>
            
            {pilotPasswordModalSuccess && <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-200 px-3 py-2 rounded-xl text-xs">{pilotPasswordModalSuccess}</div>}
            {pilotPasswordModalError && <div class="bg-red-500/10 border border-red-500/20 text-red-650 dark:text-red-200 px-3 py-2 rounded-xl text-xs">{pilotPasswordModalError}</div>}

            <form onSubmit={async (e) => {
              e.preventDefault();
              setPilotPasswordModalSuccess('');
              setPilotPasswordModalError('');
              
              if (!newPilotPassword || newPilotPassword.trim() === '') {
                setPilotPasswordModalError('A senha não pode estar em branco.');
                return;
              }

              try {
                const response = await fetch(`/api/admin/pilots/${selectedPilotForPassword.id}/password`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('gama_token')}`
                  },
                  body: JSON.stringify({ password: newPilotPassword })
                });

                const data = await response.json();
                if (!response.ok) {
                  throw new Error(data.error || 'Erro ao redefinir senha.');
                }

                setPilotPasswordModalSuccess('Senha redefinida com sucesso!');
                setNewPilotPassword('');
                setTimeout(() => {
                  setSelectedPilotForPassword(null);
                  setPilotPasswordModalSuccess('');
                }, 1500);
              } catch (err) {
                setPilotPasswordModalError(err.message);
              }
            }} class="space-y-4">
              <div>
                <label class="block text-slate-500 dark:text-slate-350 text-xs font-bold mb-1.5">Nova Senha</label>
                <input
                  type="password"
                  required
                  value={newPilotPassword}
                  onChange={(e) => setNewPilotPassword(e.target.value)}
                  placeholder="Mínimo 6 dígitos"
                  class="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-primary-500 focus:outline-none transition-all font-medium text-sm"
                />
              </div>
              
              <div class="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setSelectedPilotForPassword(null); setNewPilotPassword(''); setPilotPasswordModalError(''); setPilotPasswordModalSuccess(''); }}
                  class="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-650 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  class="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Salvar Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
