import React, { useState, useEffect } from 'react';
import { LogOut, Save, UserPlus, Users, FileText, Trash2, Eye, Upload, Plus, BarChart3, TrendingUp, Award, Activity, DollarSign, Layers } from 'lucide-react';

export default function ClientAdmin({ onLogout, onViewReport, onCreateReport }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [company, setCompany] = useState({
    name: '', cnpj: '', logo_url: '',
    bank_name: '', bank_agency: '', bank_account: '', bank_owner: '', bank_cpf_pix: '',
    plan_name: 'Básico', plan_expires_at: ''
  });
  const [pilots, setPilots] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, settings, pilots, reports

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

  const headers = { 'Authorization': `Bearer ${localStorage.getItem('gama_token')}` };

  const fetchCompanyData = async () => {
    try {
      const compRes = await fetch('/api/admin/company', { headers });
      const compData = await compRes.json();
      if (compRes.ok && compData.company) {
        setCompany(compData.company);
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

    } catch (err) {
      console.error('Erro ao buscar dados do painel administrador:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyData();
  }, []);

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

  // --- Estatísticas do Dashboard ---
  const totalLaudos = reports.length;
  const totalArea = reports.reduce((sum, r) => sum + (parseFloat(r.total_area) || 0), 0);
  const faturamentoTotal = reports.reduce((sum, r) => sum + (parseFloat(r.total_price) || 0), 0);
  const ticketMedioHa = totalArea > 0 ? (faturamentoTotal / totalArea) : 0;

  // 1. Performance por Piloto
  const pilotStatsMap = {};
  reports.forEach(r => {
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
  reports.forEach(r => {
    const culture = r.culture || 'Outras';
    if (!cultureStatsMap[culture]) {
      cultureStatsMap[culture] = { name: culture, area: 0, count: 0 };
    }
    cultureStatsMap[culture].area += parseFloat(r.total_area) || 0;
    cultureStatsMap[culture].count += 1;
  });
  const cultureMix = Object.values(cultureStatsMap).sort((a, b) => b.area - a.area);

  // 3. Atividades Recentes
  const recentReports = [...reports].slice(0, 3);

  return (
    <div class="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col md:flex-row relative">
      
      {/* Header Mobile */}
      <header class="md:hidden bg-slate-800 border-b border-slate-700/60 px-5 py-4 flex items-center justify-between sticky top-0 z-40 w-full">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-emerald-500 flex items-center justify-center font-extrabold text-white text-base">
            D
          </div>
          <div>
            <h2 class="text-base font-bold leading-tight">AgroSkan</h2>
            <p class="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">Painel Administrativo</p>
          </div>
        </div>
        <button 
          onClick={() => setMenuOpen(!menuOpen)}
          class="p-2 text-slate-400 hover:text-white focus:outline-none transition-colors"
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
      </header>

      {/* Overlay escuro de fundo no mobile */}
      {menuOpen && (
        <div 
          onClick={() => setMenuOpen(false)}
          class="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Sidebar de Navegação */}
      <aside class={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-800 border-r border-slate-700/60 flex flex-col transform transition-transform duration-300 md:relative md:translate-x-0 ${
        menuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div class="p-6 border-b border-slate-700 flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-emerald-500 flex items-center justify-center font-extrabold text-white text-lg">
            D
          </div>
          <div>
            <h2 class="text-lg font-bold">AgroSkan</h2>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Painel Administrativo</p>
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
                : 'text-slate-400 hover:bg-slate-700/40 hover:text-white'
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
                : 'text-slate-400 hover:bg-slate-700/40 hover:text-white'
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
                : 'text-slate-400 hover:bg-slate-700/40 hover:text-white'
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
                : 'text-slate-400 hover:bg-slate-700/40 hover:text-white'
            }`}
          >
            <FileText size={18} />
            <span>Relatórios Emitidos</span>
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              onCreateReport();
            }}
            class="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-700/40 hover:text-white transition-all"
          >
            <Plus size={18} />
            <span>Elaborar Relatório</span>
          </button>
        </nav>

        <div class="p-4 border-t border-slate-700">
          <button
            onClick={onLogout}
            class="w-full flex items-center justify-center space-x-2 bg-slate-700/50 hover:bg-red-500/10 hover:text-red-200 border border-slate-600/50 hover:border-red-500/20 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main class="flex-1 p-6 md:overflow-y-auto md:max-h-screen no-scrollbar">
        
        {loading ? (
          <div class="text-center py-12 text-slate-400">Carregando informações...</div>
        ) : (
          <>
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

                {/* Grid de KPIs */}
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Card 1: Faturamento */}
                  <div class="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/40 p-5 rounded-2xl flex items-center justify-between relative overflow-hidden group shadow-lg">
                    <div class="absolute w-24 h-24 bg-emerald-500/5 rounded-full -right-4 -bottom-4 group-hover:scale-110 transition-transform duration-300"></div>
                    <div class="space-y-1">
                      <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Faturamento Total</span>
                      <div class="text-xl font-black text-emerald-400">
                        {faturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <p class="text-[10px] text-slate-500 font-semibold">Receitas consolidadas</p>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-md">
                      <DollarSign size={20} />
                    </div>
                  </div>

                  {/* Card 2: Área Aplicada */}
                  <div class="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/40 p-5 rounded-2xl flex items-center justify-between relative overflow-hidden group shadow-lg">
                    <div class="absolute w-24 h-24 bg-primary-500/5 rounded-full -right-4 -bottom-4 group-hover:scale-110 transition-transform duration-300"></div>
                    <div class="space-y-1">
                      <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Área Pulverizada</span>
                      <div class="text-xl font-black text-white">{totalArea.toFixed(1).replace('.', ',')} ha</div>
                      <p class="text-[10px] text-slate-500 font-semibold">Total trabalhado</p>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-400 flex items-center justify-center border border-primary-500/20 shadow-md">
                      <TrendingUp size={20} />
                    </div>
                  </div>

                  {/* Card 3: Total Laudos */}
                  <div class="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/40 p-5 rounded-2xl flex items-center justify-between relative overflow-hidden group shadow-lg">
                    <div class="absolute w-24 h-24 bg-blue-500/5 rounded-full -right-4 -bottom-4 group-hover:scale-110 transition-transform duration-300"></div>
                    <div class="space-y-1">
                      <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Relatórios Emitidos</span>
                      <div class="text-xl font-black text-white">{totalLaudos}</div>
                      <p class="text-[10px] text-slate-500 font-semibold">Documentos gerados</p>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-md">
                      <FileText size={20} />
                    </div>
                  </div>

                  {/* Card 4: Ticket Médio / ha */}
                  <div class="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/40 p-5 rounded-2xl flex items-center justify-between relative overflow-hidden group shadow-lg">
                    <div class="absolute w-24 h-24 bg-amber-500/5 rounded-full -right-4 -bottom-4 group-hover:scale-110 transition-transform duration-300"></div>
                    <div class="space-y-1">
                      <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Valor Médio / ha</span>
                      <div class="text-xl font-black text-amber-400">
                        {ticketMedioHa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <p class="text-[10px] text-slate-500 font-semibold">Valor médio por hectare</p>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-md">
                      <Activity size={20} />
                    </div>
                  </div>
                </div>

                {/* Conteúdo Secundário: Rankings de Performance */}
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Desempenho por Piloto */}
                  <div class="lg:col-span-2 bg-slate-800 border border-slate-700/40 p-6 rounded-2xl space-y-4">
                    <h4 class="text-sm font-bold text-primary-400 border-b border-slate-700/60 pb-1.5 uppercase tracking-wider flex items-center space-x-2">
                      <Award size={16} />
                      <span>Desempenho por Piloto</span>
                    </h4>
                    
                    {pilotPerformance.length === 0 ? (
                      <div class="p-8 text-center text-slate-500 text-xs">Sem dados de aplicação de pilotos ainda.</div>
                    ) : (
                      <div class="space-y-4 pt-1">
                        {pilotPerformance.map((item, idx) => {
                          const maxArea = Math.max(...pilotPerformance.map(p => p.area));
                          const percent = maxArea > 0 ? (item.area / maxArea) * 100 : 0;
                          return (
                            <div key={idx} class="space-y-1.5">
                              <div class="flex justify-between items-center text-xs font-bold">
                                <span class="text-white flex items-center space-x-1.5">
                                  <span class="w-5 h-5 rounded-md bg-slate-900 border border-slate-700 text-[10px] flex items-center justify-center text-slate-400">{idx + 1}</span>
                                  <span>{item.name}</span>
                                </span>
                                <span class="text-slate-300 font-black">{item.area.toFixed(1).replace('.', ',')} ha <span class="text-slate-500">|</span> <span class="text-emerald-400">{item.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
                              </div>
                              <div class="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                <div class="h-full bg-gradient-to-r from-primary-600 to-emerald-500 rounded-full" style={{ width: `${percent}%` }}></div>
                              </div>
                              <div class="text-[9px] text-slate-500 font-semibold">{item.count} relatório(s) gerado(s)</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Mix de Culturas */}
                  <div class="lg:col-span-1 bg-slate-800 border border-slate-700/40 p-6 rounded-2xl space-y-4">
                    <h4 class="text-sm font-bold text-primary-400 border-b border-slate-700/60 pb-1.5 uppercase tracking-wider flex items-center space-x-2">
                      <Layers size={16} />
                      <span>Mix de Culturas (ha)</span>
                    </h4>

                    {cultureMix.length === 0 ? (
                      <div class="p-8 text-center text-slate-500 text-xs">Sem dados de culturas ainda.</div>
                    ) : (
                      <div class="space-y-4 pt-1">
                        {cultureMix.map((item, idx) => {
                          const totalMixArea = cultureMix.reduce((sum, c) => sum + c.area, 0);
                          const percent = totalMixArea > 0 ? (item.area / totalMixArea) * 100 : 0;
                          return (
                            <div key={idx} class="space-y-1.5">
                              <div class="flex justify-between items-center text-xs">
                                <span class="text-white font-bold">{item.name}</span>
                                <span class="text-slate-300 font-bold">{item.area.toFixed(1).replace('.', ',')} ha ({percent.toFixed(0)}%)</span>
                              </div>
                              <div class="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                <div class="h-full bg-primary-500 rounded-full" style={{ width: `${percent}%` }}></div>
                              </div>
                            </div>
                          );
                        })}
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
                {companyError && <div class="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm">{companyError}</div>}

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
                            onChange={(e) => setCompany({ ...company, cnpj: e.target.value })}
                            placeholder="Ex: 00.000.000/0001-00"
                            class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                          />
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
                  {pilotError && <div class="bg-red-500/10 border border-red-500/20 text-red-200 px-3 py-2 rounded-xl text-xs">{pilotError}</div>}

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
                                <button
                                  onClick={() => handleDeletePilot(p.id)}
                                  class="p-2 text-slate-400 hover:text-red-400 bg-slate-950/20 hover:bg-red-500/10 border border-slate-700/60 hover:border-red-500/20 rounded-lg transition-all"
                                >
                                  <Trash2 size={16} />
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

            {/* ABA: LAUDOS EMITIDOS */}
            {activeTab === 'reports' && (
              <div class="bg-slate-800 border border-slate-700/40 rounded-2xl overflow-hidden">
                <div class="px-6 py-5 border-b border-slate-700 flex items-center justify-between flex-wrap gap-4">
                  <h3 class="text-lg font-bold">Histórico de Relatórios da Empresa</h3>
                  <button
                    onClick={onCreateReport}
                    class="flex items-center space-x-1.5 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all"
                  >
                    <span>Elaborar Relatório</span>
                  </button>
                </div>

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
                ) : (
                  <div class="overflow-x-auto">
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
                        {reports.map(r => (
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
                                  onClick={() => onViewReport(r.id)}
                                  class="p-2 text-primary-400 hover:text-white bg-slate-950/20 hover:bg-primary-600 border border-slate-700/60 hover:border-primary-500 rounded-lg transition-all"
                                  title="Ver Relatório / Exportar PDF"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteReport(r.id)}
                                  class="p-2 text-slate-400 hover:text-red-400 bg-slate-950/20 hover:bg-red-500/10 border border-slate-700/60 hover:border-red-500/20 rounded-lg transition-all"
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
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
