import React, { useState, useEffect } from 'react';
import { LogOut, Plus, ShieldCheck, Landmark, Users, FileText, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

export default function SuperAdmin({ onLogout }) {
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({ total_companies: 0, active_companies: 0, total_pilots: 0, total_reports: 0 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  
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

  const fetchStatsAndCompanies = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('gama_token')}` };
      
      const statsRes = await fetch('/api/super/stats', { headers });
      const statsData = await statsRes.json();
      if (statsRes.ok) setStats(statsData.stats);

      const compRes = await fetch('/api/super/companies', { headers });
      const compData = await compRes.json();
      if (compRes.ok) setCompanies(compData.companies);

    } catch (err) {
      console.error('Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndCompanies();
  }, []);

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!name || !adminName || !adminUsername || !adminPassword) {
      setFormError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      const response = await fetch('/api/super/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gama_token')}`
        },
        body: JSON.stringify({
          name,
          cnpj,
          plan_name: planName,
          plan_expires_at: planExpiresAt,
          admin_name: adminName,
          admin_username: adminUsername,
          admin_password: adminPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao cadastrar empresa.');
      }

      setFormSuccess('Empresa cadastrada com sucesso!');
      // Limpar formulário
      setName('');
      setCnpj('');
      setPlanName('Básico');
      setPlanExpiresAt('');
      setAdminName('');
      setAdminUsername('');
      setAdminPassword('');

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

  return (
    <div class="min-h-screen bg-slate-900 text-slate-100 font-sans">
      {/* Header */}
      <header class="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-emerald-500 flex items-center justify-center font-extrabold text-white text-lg">
            Γ
          </div>
          <div>
            <h2 class="text-xl font-bold">Relatório Gama</h2>
            <p class="text-xs text-slate-400 font-semibold">Painel Geral do Super Administrador</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          class="flex items-center space-x-2 bg-slate-700/50 hover:bg-red-500/10 hover:text-red-200 border border-slate-600/50 hover:border-red-500/20 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
        >
          <LogOut size={16} />
          <span>Sair</span>
        </button>
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
              <p class="text-sm font-medium text-slate-400">Laudos Emitidos</p>
              <h3 class="text-2xl font-black">{stats.total_reports}</h3>
            </div>
          </div>
        </section>

        {/* Company List */}
        <section class="bg-slate-800 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div class="px-6 py-5 border-b border-slate-700 flex items-center justify-between">
            <h3 class="text-lg font-bold">Empresas Contratantes</h3>
            <button 
              onClick={() => setModalOpen(true)}
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
                    <th class="px-6 py-4">Laudos</th>
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
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {company.plan_status === 'active' ? 'Ativo' : 'Suspenso'}
                        </span>
                      </td>
                      <td class="px-6 py-4">
                        <div class="flex items-center justify-center space-x-3">
                          <button
                            onClick={() => handleToggleStatus(company)}
                            title={company.plan_status === 'active' ? 'Suspender assinatura' : 'Ativar assinatura'}
                            class={`p-2 rounded-xl border transition-all duration-200 ${
                              company.plan_status === 'active' 
                                ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                            }`}
                          >
                            {company.plan_status === 'active' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>
                          <button
                            onClick={() => handleDeleteCompany(company.id)}
                            title="Remover Empresa"
                            class="p-2 bg-slate-700/50 hover:bg-red-500/10 hover:text-red-400 border border-slate-600/50 hover:border-red-500/20 text-slate-300 rounded-xl transition-all duration-200"
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
      </main>

      {/* Modal - Cadastro de Empresa */}
      {modalOpen && (
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="w-full max-w-2xl bg-slate-800 border border-slate-700 p-8 rounded-3xl shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <div class="flex items-center justify-between mb-6">
              <h4 class="text-xl font-bold">Cadastrar Novo Cliente (Empresa)</h4>
              <button 
                onClick={() => setModalOpen(false)}
                class="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div class="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm mb-6">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 px-4 py-3 rounded-xl text-sm mb-6">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleCreateCompany} class="space-y-6">
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
                      placeholder="Ex: SkyAgro Drones"
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
                        <option value="Básico">Básico (Até 3 pilotos)</option>
                        <option value="Pro">Pro (Ilimitados)</option>
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

                {/* Administrador Inicial */}
                <div class="space-y-4">
                  <h5 class="text-sm font-bold text-primary-400 border-b border-slate-700 pb-1 uppercase tracking-wider">Conta do Admin da Empresa</h5>
                  <div>
                    <label class="block text-slate-300 text-xs font-bold mb-1.5">Nome Completo do Admin *</label>
                    <input
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="Ex: Marcelo Sgarbi Dias"
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
                      placeholder="Ex: marcelo.admin"
                      class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                    />
                  </div>
                  <div>
                    <label class="block text-slate-300 text-xs font-bold mb-1.5">Senha Provisória *</label>
                    <input
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
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
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
