import React, { useState, useEffect } from 'react';
import { LogOut, Plus, ShieldCheck, Landmark, Users, FileText, ToggleLeft, ToggleRight, Trash2, Pencil, CreditCard, Sun, Moon, Download } from 'lucide-react';
import { triggerHaptic } from '../utils/haptic';

export default function SuperAdmin({ onLogout, theme, toggleTheme, showInstallOption, onTriggerInstall }) {
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({ total_companies: 0, active_companies: 0, total_pilots: 0, total_reports: 0 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  
  // Abas
  const [activeTab, setActiveTab] = useState('companies');
  const [plans, setPlans] = useState([]);

  // Campos do formulário de nova empresa
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [planName, setPlanName] = useState('Básico');
  const [planExpiresAt, setPlanExpiresAt] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Campos do formulário de plano
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planNameInput, setPlanNameInput] = useState('');
  const [planDescriptionInput, setPlanDescriptionInput] = useState('');
  const [planMaxDevicesInput, setPlanMaxDevicesInput] = useState(1);
  const [planFormError, setPlanFormError] = useState('');
  const [planFormSuccess, setPlanFormSuccess] = useState('');

  // Campos do perfil do SuperAdmin
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const fetchStatsAndCompanies = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('gama_token')}` };
      
      const statsRes = await fetch('/api/super/stats', { headers });
      const statsData = await statsRes.json();
      if (statsRes.ok) setStats(statsData.stats);

      const compRes = await fetch('/api/super/companies', { headers });
      const compData = await compRes.json();
      if (compRes.ok) setCompanies(compData.companies);

      const plansRes = await fetch('/api/super/plans', { headers });
      const plansData = await plansRes.json();
      if (plansRes.ok) setPlans(plansData.plans || []);

      const userRes = await fetch('/api/auth/me', { headers });
      const userData = await userRes.json();
      if (userRes.ok && userData.user) {
        setProfileName(userData.user.name || '');
        setProfileUsername(userData.user.username || '');
      }

    } catch (err) {
      console.error('Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndCompanies();
  }, []);

  const openCreateModal = () => {
    setEditingCompany(null);
    setName('');
    setCnpj('');
    setPlanName(plans[0]?.name || 'Básico');
    setPlanExpiresAt('');
    setAdminName('');
    setAdminUsername('');
    setAdminPassword('');
    setFormError('');
    setFormSuccess('');
    setModalOpen(true);
  };

  const openEditModal = (company) => {
    setEditingCompany(company);
    setName(company.name);
    setCnpj(company.cnpj || '');
    setPlanName(company.plan_name || 'Básico');
    setAdminName(company.admin_name || '');
    setAdminUsername(company.admin_username || '');
    setAdminPassword('');
    
    let dateStr = '';
    if (company.plan_expires_at) {
      try {
        dateStr = new Date(company.plan_expires_at).toISOString().split('T')[0];
      } catch (e) {
        dateStr = company.plan_expires_at;
      }
    }
    setPlanExpiresAt(dateStr);
    setFormError('');
    setFormSuccess('');
    setModalOpen(true);
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!name) {
      setFormError('Por favor, preencha o nome da empresa.');
      return;
    }

    if (editingCompany && (!adminName || !adminUsername)) {
      setFormError('Por favor, preencha o nome e o usuário do administrador.');
      return;
    }

    if (!editingCompany && (!adminName || !adminUsername || !adminPassword)) {
      setFormError('Por favor, preencha todos os campos obrigatórios da conta do administrador.');
      return;
    }

    try {
      const url = editingCompany 
        ? `/api/super/companies/${editingCompany.id}`
        : '/api/super/companies';
      const method = editingCompany ? 'PUT' : 'POST';
      
      const bodyObj = editingCompany
        ? {
            name,
            cnpj,
            plan_name: planName,
            plan_expires_at: planExpiresAt,
            plan_status: editingCompany.plan_status,
            admin_name: adminName,
            admin_username: adminUsername,
            admin_password: adminPassword
          }
        : {
            name,
            cnpj,
            plan_name: planName,
            plan_expires_at: planExpiresAt,
            admin_name: adminName,
            admin_username: adminUsername,
            admin_password: adminPassword
          };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gama_token')}`
        },
        body: JSON.stringify(bodyObj)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar empresa.');
      }

      setFormSuccess(editingCompany ? 'Empresa atualizada com sucesso!' : 'Empresa cadastrada com sucesso!');
      
      if (!editingCompany) {
        setName('');
        setCnpj('');
        setPlanName('Básico');
        setPlanExpiresAt('');
        setAdminName('');
        setAdminUsername('');
        setAdminPassword('');
      }

      fetchStatsAndCompanies();
      setTimeout(() => setModalOpen(false), 1500);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleToggleStatus = async (company) => {
    const newStatus = company.plan_status === 'active' ? 'suspended' : 'active';
    try {
      const response = await fetch(`/api/super/companies/${company.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gama_token')}`
        },
        body: JSON.stringify({
          name: company.name,
          cnpj: company.cnpj,
          plan_name: company.plan_name,
          plan_status: newStatus,
          plan_expires_at: company.plan_expires_at
        })
      });

      if (response.ok) {
        fetchStatsAndCompanies();
      }
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  };

  const handleDeleteCompany = async (companyId) => {
    if (!window.confirm('Tem certeza absoluta que deseja excluir este cliente? Isso removerá todos os pilotos e relatórios associados permanentemente.')) {
      return;
    }

    try {
      const response = await fetch(`/api/super/companies/${companyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('gama_token')}` }
      });

      if (response.ok) {
        fetchStatsAndCompanies();
      }
    } catch (err) {
      console.error('Erro ao excluir empresa:', err);
    }
  };

  const openCreatePlanModal = () => {
    setEditingPlan(null);
    setPlanNameInput('');
    setPlanDescriptionInput('');
    setPlanMaxDevicesInput(1);
    setPlanFormError('');
    setPlanFormSuccess('');
    setPlanModalOpen(true);
  };

  const openEditPlanModal = (plan) => {
    setEditingPlan(plan);
    setPlanNameInput(plan.name);
    setPlanDescriptionInput(plan.description || '');
    setPlanMaxDevicesInput(plan.max_devices || 1);
    setPlanFormError('');
    setPlanFormSuccess('');
    setPlanModalOpen(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    setPlanFormError('');
    setPlanFormSuccess('');

    if (!planNameInput.trim()) {
      setPlanFormError('Por favor, preencha o nome do plano.');
      return;
    }

    try {
      const url = editingPlan 
        ? `/api/super/plans/${editingPlan.id}`
        : '/api/super/plans';
      const method = editingPlan ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gama_token')}`
        },
        body: JSON.stringify({
          name: planNameInput,
          description: planDescriptionInput,
          max_devices: planMaxDevicesInput
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar plano.');
      }

      setPlanFormSuccess(editingPlan ? 'Plano atualizado com sucesso!' : 'Plano cadastrado com sucesso!');
      
      if (!editingPlan) {
        setPlanNameInput('');
        setPlanDescriptionInput('');
        setPlanMaxDevicesInput(1);
      }

      fetchStatsAndCompanies();
      setTimeout(() => setPlanModalOpen(false), 1500);
    } catch (err) {
      setPlanFormError(err.message);
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('Tem certeza absoluta que deseja excluir este plano?')) {
      return;
    }

    try {
      const response = await fetch(`/api/super/plans/${planId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('gama_token')}` }
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Erro ao excluir plano.');
        return;
      }

      fetchStatsAndCompanies();
    } catch (err) {
      console.error('Erro ao excluir plano:', err);
      alert('Erro ao excluir plano.');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (!profileName.trim() || !profileUsername.trim()) {
      setProfileError('Nome e Usuário são obrigatórios.');
      return;
    }

    if (profilePassword && profilePassword !== profileConfirmPassword) {
      setProfileError('As senhas não coincidem.');
      return;
    }

    try {
      const response = await fetch('/api/super/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gama_token')}`
        },
        body: JSON.stringify({
          name: profileName,
          username: profileUsername,
          password: profilePassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar perfil.');
      }

      setProfileSuccess('Perfil atualizado com sucesso!');
      setProfilePassword('');
      setProfileConfirmPassword('');
      
      fetchStatsAndCompanies();
    } catch (err) {
      setProfileError(err.message);
    }
  };

  return (
    <div class="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Header */}
      <header class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between transition-colors duration-200">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-emerald-500 flex items-center justify-center font-extrabold text-white text-lg">
            D
          </div>
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">AgroSkan</h2>
            <p class="text-xs text-slate-550 dark:text-slate-400 font-semibold">Painel Geral do Super Administrador</p>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          {/* Botão de Instalação (se elegível e não instalado) */}
          {showInstallOption && (
            <button
              onClick={onTriggerInstall}
              type="button"
              class="p-2.5 bg-gradient-to-tr from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white border border-primary-500/20 rounded-xl transition-all shadow-md animate-pulse"
              title="Instalar AgroSkan no Celular"
            >
              <Download size={16} />
            </button>
          )}

          {/* Botão de Tema */}
          <button
            onClick={toggleTheme}
            type="button"
            class="p-2.5 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-600/50 rounded-xl transition-all shadow-xs"
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button 
            onClick={() => { triggerHaptic(12); onLogout(); }}
            class="flex items-center space-x-2 bg-slate-100 hover:bg-red-500/10 hover:text-red-600 dark:bg-slate-700/50 dark:hover:bg-red-500/10 dark:hover:text-red-200 border border-slate-200 dark:border-slate-600/50 dark:hover:border-red-500/20 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main class="max-w-7xl mx-auto p-6 space-y-8">
        
        {/* Stats Grid */}
        <section class="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div class="bg-slate-800 border border-slate-700/50 p-6 rounded-2xl flex items-center space-x-4">
            <div class="w-12 h-12 rounded-xl bg-primary-600/10 text-primary-500 flex items-center justify-center">
              <Landmark size={24} />
            </div>
            <div>
              <p class="text-sm font-medium text-slate-400">Total de Empresas</p>
              <h3 class="text-2xl font-black">{stats.total_companies}</h3>
            </div>
          </div>
          <div class="bg-slate-800 border border-slate-700/50 p-6 rounded-2xl flex items-center space-x-4">
            <div class="w-12 h-12 rounded-xl bg-emerald-600/10 text-emerald-400 flex items-center justify-center">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p class="text-sm font-medium text-slate-400">Assinaturas Ativas</p>
              <h3 class="text-2xl font-black text-emerald-400">{stats.active_companies}</h3>
            </div>
          </div>
          <div class="bg-slate-800 border border-slate-700/50 p-6 rounded-2xl flex items-center space-x-4">
            <div class="w-12 h-12 rounded-xl bg-blue-600/10 text-blue-400 flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <p class="text-sm font-medium text-slate-400">Pilotos Cadastrados</p>
              <h3 class="text-2xl font-black">{stats.total_pilots}</h3>
            </div>
          </div>
          <div class="bg-slate-800 border border-slate-700/50 p-6 rounded-2xl flex items-center space-x-4">
            <div class="w-12 h-12 rounded-xl bg-violet-600/10 text-violet-400 flex items-center justify-center">
              <FileText size={24} />
            </div>
            <div>
              <p class="text-sm font-medium text-slate-400">Relatórios Emitidos</p>
              <h3 class="text-2xl font-black">{stats.total_reports}</h3>
            </div>
          </div>
        </section>

        {/* Tabs Navigation */}
        <div class="flex border-b border-slate-700 space-x-6">
          <button
            onClick={() => setActiveTab('companies')}
            class={`pb-4 text-sm font-bold border-b-2 transition-all duration-200 ${
              activeTab === 'companies' 
                ? 'border-primary-500 text-primary-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Clientes (Empresas)
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            class={`pb-4 text-sm font-bold border-b-2 transition-all duration-200 ${
              activeTab === 'plans' 
                ? 'border-primary-500 text-primary-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Planos de Assinatura
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            class={`pb-4 text-sm font-bold border-b-2 transition-all duration-200 ${
              activeTab === 'profile' 
                ? 'border-primary-500 text-primary-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Minha Conta
          </button>
        </div>

        {activeTab === 'companies' ? (
          /* Company List */
          <section class="bg-slate-800 border border-slate-700/50 rounded-2xl overflow-hidden animate-fadeIn">
            <div class="px-6 py-5 border-b border-slate-700 flex items-center justify-between">
              <h3 class="text-lg font-bold">Empresas Contratantes</h3>
              <button 
                onClick={openCreateModal}
                class="flex items-center space-x-2 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary-600/10 transition-all duration-300"
              >
                <Plus size={16} />
                <span>Adicionar Cliente</span>
              </button>
            </div>

            {loading ? (
              <div class="p-12 text-center text-slate-400">Carregando dados da plataforma...</div>
            ) : companies.length === 0 ? (
              <div class="p-12 text-center text-slate-400">Nenhum cliente cadastrado no momento.</div>
            ) : (
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-slate-900/50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-700">
                      <th class="px-6 py-4">Empresa / CNPJ</th>
                      <th class="px-6 py-4">Plano</th>
                      <th class="px-6 py-4">Vencimento</th>
                      <th class="px-6 py-4">Pilotos</th>
                      <th class="px-6 py-4">Relatórios</th>
                      <th class="px-6 py-4 text-center">Status</th>
                      <th class="px-6 py-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-700/50">
                    {companies.map((company) => (
                      <tr key={company.id} class="hover:bg-slate-700/20 transition-colors">
                        <td class="px-6 py-4">
                          <div class="font-bold text-white">{company.name}</div>
                          <div class="text-xs text-slate-400 font-semibold">{company.cnpj || 'CNPJ não informado'}</div>
                        </td>
                        <td class="px-6 py-4 font-semibold text-slate-300">
                          {company.plan_name}
                        </td>
                        <td class="px-6 py-4 text-sm font-semibold text-slate-300">
                          {company.plan_expires_at ? new Date(company.plan_expires_at).toLocaleDateString('pt-BR') : 'Sem data'}
                        </td>
                        <td class="px-6 py-4 text-sm font-bold text-slate-300">
                          {company.pilot_count}
                        </td>
                        <td class="px-6 py-4 text-sm font-bold text-slate-300">
                          {company.report_count}
                        </td>
                        <td class="px-6 py-4 text-center">
                          <span class={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                            company.plan_status === 'active' 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                              : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                          }`}>
                            {company.plan_status === 'active' ? 'Ativo' : 'Suspenso'}
                          </span>
                        </td>
                        <td class="px-6 py-4">
                          <div class="flex items-center justify-center space-x-3">
                            <button
                              onClick={() => openEditModal(company)}
                              title="Editar Empresa"
                              class="p-2 bg-slate-700/50 hover:bg-primary-500/10 hover:text-primary-400 border border-slate-600/50 hover:border-primary-500/20 text-slate-300 rounded-xl transition-all duration-200"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(company)}
                              title={company.plan_status === 'active' ? 'Suspender assinatura' : 'Ativar assinatura'}
                              class={`p-2 rounded-xl border transition-all duration-200 ${
                                company.plan_status === 'active' 
                                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/20' 
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              }`}
                            >
                              {company.plan_status === 'active' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                            </button>
                            <button
                              onClick={() => handleDeleteCompany(company.id)}
                              title="Remover Empresa"
                              class="p-2 bg-slate-700/50 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 border border-slate-600/50 hover:border-red-500/20 text-slate-300 rounded-xl transition-all duration-200"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : activeTab === 'plans' ? (
          /* Plans List */
          <section class="bg-slate-800 border border-slate-700/50 rounded-2xl overflow-hidden animate-fadeIn">
            <div class="px-6 py-5 border-b border-slate-700 flex items-center justify-between">
              <h3 class="text-lg font-bold">Planos de Assinatura</h3>
              <button 
                onClick={openCreatePlanModal}
                class="flex items-center space-x-2 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary-600/10 transition-all duration-300"
              >
                <Plus size={16} />
                <span>Adicionar Plano</span>
              </button>
            </div>

            {loading ? (
              <div class="p-12 text-center text-slate-400">Carregando planos...</div>
            ) : plans.length === 0 ? (
              <div class="p-12 text-center text-slate-400">Nenhum plano cadastrado no momento.</div>
            ) : (
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-slate-900/50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-700">
                      <th class="px-6 py-4">Nome do Plano</th>
                      <th class="px-6 py-4">Descrição</th>
                      <th class="px-6 py-4">Data de Criação</th>
                      <th class="px-6 py-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-700/50">
                    {plans.map((plan) => (
                      <tr key={plan.id} class="hover:bg-slate-700/20 transition-colors">
                        <td class="px-6 py-4 font-bold text-white">
                          {plan.name}
                        </td>
                        <td class="px-6 py-4 text-slate-300 font-semibold">
                          {plan.description || 'Sem descrição'}
                        </td>
                        <td class="px-6 py-4 text-sm font-semibold text-slate-300">
                          {plan.created_at ? new Date(plan.created_at).toLocaleDateString('pt-BR') : 'Sem data'}
                        </td>
                        <td class="px-6 py-4">
                          <div class="flex items-center justify-center space-x-3">
                            <button
                              onClick={() => openEditPlanModal(plan)}
                              title="Editar Plano"
                              class="p-2 bg-slate-700/50 hover:bg-primary-500/10 hover:text-primary-400 border border-slate-600/50 hover:border-primary-500/20 text-slate-300 rounded-xl transition-all duration-200"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              onClick={() => handleDeletePlan(plan.id)}
                              title="Remover Plano"
                              class="p-2 bg-slate-700/50 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 border border-slate-600/50 hover:border-red-500/20 text-slate-300 rounded-xl transition-all duration-200"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          /* Profile Section */
          <section class="max-w-xl mx-auto bg-slate-800 border border-slate-700/50 rounded-2xl overflow-hidden animate-fadeIn">
            <div class="px-6 py-5 border-b border-slate-700">
              <h3 class="text-lg font-bold">Configurações da Conta</h3>
              <p class="text-xs text-slate-400 font-semibold mt-0.5">Altere suas credenciais de acesso SuperAdmin</p>
            </div>
            
            <form onSubmit={handleUpdateProfile} class="p-6 space-y-6">
              {profileError && (
                <div class="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-200 px-4 py-3 rounded-xl text-sm">
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 px-4 py-3 rounded-xl text-sm">
                  {profileSuccess}
                </div>
              )}

              <div class="space-y-4">
                <div>
                  <label class="block text-slate-300 text-xs font-bold mb-1.5">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Ex: Nome do Administrador"
                    class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                  />
                </div>

                <div>
                  <label class="block text-slate-300 text-xs font-bold mb-1.5">Nome de Usuário (Login) *</label>
                  <input
                    type="text"
                    required
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    placeholder="Ex: admin"
                    class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                  />
                </div>

                <hr class="border-slate-700 my-6" />

                <div>
                  <label class="block text-slate-300 text-xs font-bold mb-1.5">Nova Senha (deixe em branco para manter a atual)</label>
                  <input
                    type="password"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                  />
                </div>

                <div>
                  <label class="block text-slate-300 text-xs font-bold mb-1.5">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    value={profileConfirmPassword}
                    onChange={(e) => setProfileConfirmPassword(e.target.value)}
                    placeholder="Confirme a nova senha"
                    class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                  />
                </div>
              </div>

              <div class="flex justify-end pt-4">
                <button
                  type="submit"
                  class="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white font-bold rounded-xl text-sm shadow-lg shadow-primary-600/10 transition-all duration-300"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </section>
        )}
      </main>

      {/* Modal - Cadastro ou Edição de Empresa */}
      {modalOpen && (
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="w-full max-w-2xl bg-slate-800 border border-slate-700 p-8 rounded-3xl shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <div class="flex items-center justify-between mb-6">
              <h4 class="text-xl font-bold">{editingCompany ? 'Editar Cliente (Empresa)' : 'Cadastrar Novo Cliente (Empresa)'}</h4>
              <button 
                onClick={() => setModalOpen(false)}
                class="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div class="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-200 px-4 py-3 rounded-xl text-sm mb-6">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 px-4 py-3 rounded-xl text-sm mb-6">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleSaveCompany} class="space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Dados da Empresa */}
                <div class="space-y-4">
                  <h5 class="text-sm font-bold text-primary-400 border-b border-slate-700 pb-1 uppercase tracking-wider">Dados do Assinante</h5>
                  <div>
                    <label class="block text-slate-300 text-xs font-bold mb-1.5">Nome Fantasia / Empresa *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Drone Servicos Ltda"
                      class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                    />
                  </div>
                  <div>
                    <label class="block text-slate-300 text-xs font-bold mb-1.5">CNPJ</label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      placeholder="Ex: 00.000.000/0001-00"
                      class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                    />
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-slate-300 text-xs font-bold mb-1.5">Plano</label>
                      <select
                        value={planName}
                        onChange={(e) => setPlanName(e.target.value)}
                        class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name} {p.description ? `(${p.description})` : ''}
                          </option>
                        ))}
                        {plans.length === 0 && (
                          <option value="Básico">Básico</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label class="block text-slate-300 text-xs font-bold mb-1.5">Data Vencimento</label>
                      <input
                        type="date"
                        value={planExpiresAt}
                        onChange={(e) => setPlanExpiresAt(e.target.value)}
                        class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Administrador Inicial ou Edição */}
                <div class="space-y-4">
                  <h5 class="text-sm font-bold text-primary-400 border-b border-slate-700 pb-1 uppercase tracking-wider">Conta do Admin da Empresa</h5>
                  <div>
                    <label class="block text-slate-300 text-xs font-bold mb-1.5">Nome Completo do Admin *</label>
                    <input
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="Ex: João da Silva"
                      class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                    />
                  </div>
                  <div>
                    <label class="block text-slate-300 text-xs font-bold mb-1.5">Nome de Usuário *</label>
                    <input
                      type="text"
                      required
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="Ex: joao.admin"
                      class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                    />
                  </div>
                  <div>
                    <label class="block text-slate-300 text-xs font-bold mb-1.5">
                      {editingCompany ? 'Nova Senha (Opcional)' : 'Senha Provisória *'}
                    </label>
                    <input
                      type="password"
                      required={!editingCompany}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder={editingCompany ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
                      class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                    />
                  </div>
                </div>
              </div>

              <div class="flex justify-end space-x-3 pt-6 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  class="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  class="px-5 py-2.5 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white font-bold rounded-xl text-sm shadow-lg transition-all"
                >
                  {editingCompany ? 'Salvar Alterações' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Cadastro ou Edição de Plano */}
      {planModalOpen && (
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="w-full max-w-lg bg-slate-800 border border-slate-700 p-8 rounded-3xl shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <div class="flex items-center justify-between mb-6">
              <h4 class="text-xl font-bold">{editingPlan ? 'Editar Plano' : 'Cadastrar Novo Plano'}</h4>
              <button 
                onClick={() => setPlanModalOpen(false)}
                class="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            {planFormError && (
              <div class="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-200 px-4 py-3 rounded-xl text-sm mb-6">
                {planFormError}
              </div>
            )}
            {planFormSuccess && (
              <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 px-4 py-3 rounded-xl text-sm mb-6">
                {planFormSuccess}
              </div>
            )}

            <form onSubmit={handleSavePlan} class="space-y-6">
              <div class="space-y-4">
                <div>
                  <label class="block text-slate-300 text-xs font-bold mb-1.5">Nome do Plano *</label>
                  <input
                    type="text"
                    required
                    value={planNameInput}
                    onChange={(e) => setPlanNameInput(e.target.value)}
                    placeholder="Ex: Premium"
                    class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                  />
                </div>
                <div>
                  <label class="block text-slate-300 text-xs font-bold mb-1.5">Descrição (opcional)</label>
                  <input
                    type="text"
                    value={planDescriptionInput}
                    onChange={(e) => setPlanDescriptionInput(e.target.value)}
                    placeholder="Ex: Pilotos ilimitados e suporte 24h"
                    class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                  />
                </div>
                <div>
                  <label class="block text-slate-300 text-xs font-bold mb-1.5">Limite de Dispositivos/Acessos Simultâneos *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={planMaxDevicesInput}
                    onChange={(e) => setPlanMaxDevicesInput(parseInt(e.target.value, 10) || 1)}
                    placeholder="Ex: 3"
                    class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                  />
                </div>
              </div>

              <div class="flex justify-end space-x-3 pt-6 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  class="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  class="px-5 py-2.5 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white font-bold rounded-xl text-sm shadow-lg transition-all"
                >
                  {editingPlan ? 'Salvar Alterações' : 'Salvar Plano'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
