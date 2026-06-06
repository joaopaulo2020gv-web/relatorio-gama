import React, { useState, useEffect } from 'react';
import { LogOut, Plus, FileText, Eye, Map, Trash2, Sun, Moon, Download, Layers, TrendingUp, DollarSign, Search } from 'lucide-react';
import { getDrafts, deleteDraft } from '../utils/offlineDb';
import { triggerHaptic } from '../utils/haptic';

const PilotReportsSkeleton = () => (
  <div class="space-y-4 p-6 animate-pulse">
    {[1, 2, 3].map(i => (
      <div key={i} class="border border-slate-200 dark:border-slate-700/40 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-100/50 dark:bg-slate-800/50">
        <div class="space-y-2 flex-1 w-full">
          <div class="h-4 bg-slate-200 dark:bg-slate-700 w-1/3 rounded-md"></div>
          <div class="h-3 bg-slate-200 dark:bg-slate-700 w-1/4 rounded-md"></div>
        </div>
        <div class="flex items-center space-x-6 w-full sm:w-auto justify-between sm:justify-end">
          <div class="h-4 bg-slate-200 dark:bg-slate-700 w-16 rounded-md"></div>
          <div class="h-4 bg-slate-200 dark:bg-slate-700 w-20 rounded-md"></div>
          <div class="h-8 bg-slate-200 dark:bg-slate-700 w-12 rounded-xl"></div>
        </div>
      </div>
    ))}
  </div>
);

export default function PilotDashboard({ onLogout, onCreateReport, onViewReport, theme, toggleTheme, showInstallOption, onTriggerInstall }) {
  const [reports, setReports] = useState([]);
  const [offlineDrafts, setOfflineDrafts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const user = JSON.parse(localStorage.getItem('gama_user') || '{}');

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
      
      // Executa o refresh
      await fetchPilotReports();
      await fetchOfflineDrafts();
      
      setRefreshing(false);
      setPullDistance(0);
    } else {
      setPullDistance(0);
    }
  };

  const fetchPilotReports = async () => {
    try {
      const response = await fetch('/api/reports', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('gama_token')}` }
      });
      const data = await response.json();
      if (response.ok) {
        setReports(data.reports);
      }
    } catch (err) {
      console.error('Erro ao buscar relatórios do piloto:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOfflineDrafts = async () => {
    try {
      const drafts = await getDrafts();
      setOfflineDrafts(drafts);
    } catch (err) {
      console.error('Erro ao buscar rascunhos offline:', err);
    }
  };

  useEffect(() => {
    fetchPilotReports();
    fetchOfflineDrafts();
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
      fetchPilotReports();
    } catch (err) {
      console.error(err);
      alert(`Erro durante a sincronização: ${err.message}`);
    } finally {
      setSyncing(false);
      setSyncProgress('');
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Deseja excluir este relatório permanentemente?')) {
      return;
    }

    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('gama_token')}` }
      });

      if (response.ok) {
        fetchPilotReports();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Estatísticas baseadas no histórico de relatórios do piloto
  const totalHectares = reports.reduce((sum, r) => sum + (parseFloat(r.total_area) || 0), 0);
  const totalReportsCount = reports.length;
  const totalEarnings = reports.reduce((sum, r) => sum + (parseFloat(r.total_price) || 0), 0);

  // Agrupamento de Culturas para o Gráfico Donut
  const cultureDataMap = {};
  reports.forEach(r => {
    const cult = (r.culture || 'Não Informada').toUpperCase().trim();
    cultureDataMap[cult] = (cultureDataMap[cult] || 0) + (parseFloat(r.total_area) || 0);
  });
  const pilotCultureMix = Object.keys(cultureDataMap).map(name => ({
    name,
    area: cultureDataMap[name]
  })).sort((a, b) => b.area - a.area);

  // Filtragem dos relatórios pelo campo de pesquisa
  const filteredReports = reports.filter(r => 
    (r.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.farm_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.culture || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      class="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200 relative overflow-hidden"
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
      {/* Top Header */}
      <header class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/60 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-emerald-500 flex items-center justify-center font-extrabold text-white text-lg">
            D
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">AgroSkan</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{user.company_name || 'Empresa'}</p>
          </div>
        </div>
        <div class="flex items-center space-x-4">
          <div class="hidden md:block text-right">
            <div class="text-sm font-bold text-slate-900 dark:text-white">{user.name}</div>
            <div class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Piloto de Drones</div>
          </div>
          
          {/* Botão de Instalação (se elegível e não instalado) */}
          {showInstallOption && (
            <button
              onClick={onTriggerInstall}
              type="button"
              class="p-2 bg-gradient-to-tr from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white border border-primary-500/20 rounded-xl transition-all shadow-md animate-pulse"
              title="Instalar AgroSkan no Celular"
            >
              <Download size={15} />
            </button>
          )}

          {/* Botão de Tema */}
          <button
            onClick={toggleTheme}
            type="button"
            class="p-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-600/50 rounded-xl transition-all shadow-xs"
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button 
            onClick={() => { triggerHaptic(12); onLogout(); }}
            class="flex items-center space-x-2 bg-slate-100 hover:bg-red-500/10 hover:text-red-600 dark:bg-slate-700/50 dark:hover:bg-red-500/10 dark:hover:text-red-200 border border-slate-200 dark:border-slate-600/50 dark:hover:border-red-500/20 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            <LogOut size={15} />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main class="max-w-5xl mx-auto p-6 pb-24 md:pb-6 space-y-8">
        
        {/* Banner de Sincronização Offline */}
        {offlineDrafts.length > 0 && (
          <div class="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
            <div class="flex items-center space-x-3 text-amber-500 dark:text-amber-400">
              <FileText size={22} />
              <div class="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Você possui <span class="text-amber-600 dark:text-amber-400 font-extrabold">{offlineDrafts.length}</span> {offlineDrafts.length === 1 ? 'relatório salvo' : 'relatórios salvos'} offline no aparelho.
                <p class="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">Sincronize-os com o servidor assim que estiver com internet.</p>
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

        {/* Banner de Boas-vindas e Ação Principal */}
        <section class="bg-gradient-to-r from-white to-slate-100/40 dark:from-slate-800 dark:to-slate-800/60 border border-slate-200 dark:border-slate-700/40 p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm dark:shadow-none">
          <div class="space-y-2 text-center md:text-left">
            <h3 class="text-2xl font-black text-slate-900 dark:text-white">Olá, {user.name.split(' ')[0]}!</h3>
            <p class="text-slate-550 dark:text-slate-400 font-medium text-sm">Pronto para lançar um novo relatório de pulverização em campo?</p>
          </div>
          <button
            onClick={() => { triggerHaptic(12); onCreateReport(); }}
            class="flex items-center space-x-1.5 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white px-5 py-3 rounded-2xl text-xs font-bold shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-all w-full sm:w-auto justify-center hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus size={20} />
            <span>Novo Relatório</span>
          </button>
        </section>

        {/* Dashboard de Estatísticas e Gráficos Pessoais */}
        {reports.length > 0 && (
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            {/* Mini-Cards de KPI */}
            <div class="lg:col-span-1 flex flex-col gap-4 justify-between">
              {/* Card Hectares */}
              <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/40 p-5 rounded-2xl flex items-center space-x-4 shadow-xs dark:shadow-none transition-colors duration-200">
                <div class="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Área Pulverizada</span>
                  <div class="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                    {totalHectares.toFixed(1).replace('.', ',')} ha
                  </div>
                </div>
              </div>

              {/* Card Relatórios */}
              <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/40 p-5 rounded-2xl flex items-center space-x-4 shadow-xs dark:shadow-none transition-colors duration-200">
                <div class="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Relatórios Emitidos</span>
                  <div class="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                    {totalReportsCount} un
                  </div>
                </div>
              </div>

              {/* Card Faturamento */}
              <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/40 p-5 rounded-2xl flex items-center space-x-4 shadow-xs dark:shadow-none transition-colors duration-200">
                <div class="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <DollarSign size={20} />
                </div>
                <div>
                  <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Faturamento Gerado</span>
                  <div class="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                    {totalEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              </div>
            </div>

            {/* Donut Chart de Culturas (Mix) */}
            <div class="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/40 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xs dark:shadow-none transition-colors duration-200">
              <div class="flex-1 w-full flex flex-col justify-between h-full">
                <div>
                  <h4 class="text-sm font-bold text-slate-800 dark:text-white flex items-center space-x-2 border-b border-slate-100 dark:border-slate-700/40 pb-2">
                    <Layers size={15} class="text-primary-500" />
                    <span>Mix de Culturas Atendidas</span>
                  </h4>
                  <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-semibold">Proporção por área aplicada (hectares)</p>
                </div>

                {/* Legendas coloridas */}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-h-[120px] overflow-y-auto pr-1 no-scrollbar text-xs font-semibold text-slate-700 dark:text-slate-305">
                  {pilotCultureMix.map((item, idx) => {
                    const percent = totalHectares > 0 ? (item.area / totalHectares) * 100 : 0;
                    const color = `hsl(${(idx * 137.5) % 360}, 70%, 50%)`;
                    return (
                      <div 
                        key={idx} 
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        class={`flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer ${
                          hoveredIndex === idx ? 'bg-slate-100 dark:bg-slate-700/30' : ''
                        }`}
                      >
                        <div class="flex items-center space-x-2 truncate">
                          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></span>
                          <span class="truncate">{item.name}</span>
                        </div>
                        <span class="text-slate-500 dark:text-slate-400 text-[10px] ml-1">{percent.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Gráfico Donut SVG */}
              <div class="relative flex items-center justify-center w-36 h-36 flex-shrink-0">
                <svg width="140" height="140" viewBox="0 0 120 120" class="transform -rotate-90">
                  <circle cx="60" cy="60" r="50" fill="transparent" stroke="rgba(128,128,128,0.08)" stroke-width="12" />
                  {(() => {
                    let accumulatedPercent = 0;
                    const donutData = pilotCultureMix.map((item, idx) => {
                      const percent = totalHectares > 0 ? (item.area / totalHectares) * 100 : 0;
                      const strokeLength = (percent / 100) * 314.16;
                      const strokeOffset = 314.16 - ((accumulatedPercent / 100) * 314.16);
                      accumulatedPercent += percent;
                      const color = `hsl(${(idx * 137.5) % 360}, 70%, 50%)`;
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
                        class="transition-all duration-300 cursor-pointer origin-center hover:scale-[1.03]"
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    ));
                  })()}
                </svg>
                <div class="absolute text-center flex flex-col justify-center items-center pointer-events-none w-24 overflow-hidden">
                  {hoveredIndex !== null ? (
                    <>
                      <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate w-full">
                        {pilotCultureMix[hoveredIndex]?.name}
                      </span>
                      <span class="text-sm font-black text-slate-800 dark:text-white">
                        {pilotCultureMix[hoveredIndex]?.area.toFixed(1).replace('.', ',')} ha
                      </span>
                      <span class="text-[9px] text-slate-400 font-semibold">
                        {(((pilotCultureMix[hoveredIndex]?.area || 0) / (totalHectares || 1)) * 100).toFixed(0)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total</span>
                      <span class="text-sm font-black text-slate-800 dark:text-white">
                        {totalHectares.toFixed(1).replace('.', ',')} ha
                      </span>
                      <span class="text-[9px] text-slate-505 font-semibold">{pilotCultureMix.length} Culturas</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rascunhos Offline Detalhados */}
        {offlineDrafts.length > 0 && (
          <section class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/40 rounded-2xl overflow-hidden shadow-xs dark:shadow-none">
            <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h4 class="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
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
            
            <div class="hidden md:block overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50/70 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                    <th class="px-6 py-4">Cliente / Fazenda</th>
                    <th class="px-6 py-4">Cultura</th>
                    <th class="px-6 py-4">Data Local</th>
                    <th class="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 dark:divide-slate-700/40">
                  {offlineDrafts.map(draft => (
                    <tr key={draft.id} class="hover:bg-slate-50 dark:hover:bg-slate-700/10 transition-colors">
                      <td class="px-6 py-4">
                        <div class="font-bold text-slate-900 dark:text-white">{draft.client_name || 'Sem nome'}</div>
                        <div class="text-xs text-slate-500 dark:text-slate-400 font-semibold">{draft.farm_name || 'Sem fazenda'}</div>
                      </td>
                      <td class="px-6 py-4 text-sm font-semibold text-slate-750 dark:text-slate-300">
                        {draft.culture || 'Não informada'}
                      </td>
                      <td class="px-6 py-4 text-sm text-slate-750 dark:text-slate-350">
                        {draft.savedAt ? new Date(draft.savedAt).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => { triggerHaptic(12); onCreateReport(draft); }}
                            class="px-3 py-1.5 text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-slate-950 rounded-lg transition-all border border-amber-500/25"
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
                            class="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-all"
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

            {/* Cards para Mobile */}
            <div class="grid grid-cols-1 gap-4 p-4 md:hidden">
              {offlineDrafts.map(draft => (
                <div key={draft.id} class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/40 p-4 rounded-2xl space-y-3">
                  <div class="flex justify-between items-start">
                    <div>
                      <div class="font-extrabold text-sm text-slate-900 dark:text-white">{draft.client_name || 'Sem nome'}</div>
                      <div class="text-xs text-slate-500 dark:text-slate-400 font-bold">{draft.farm_name || 'Sem fazenda'}</div>
                    </div>
                    <span class="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-black uppercase">Rascunho</span>
                  </div>
                  <div class="grid grid-cols-2 gap-2 text-xs border-t border-b border-slate-200 dark:border-slate-700/30 py-2">
                    <div>
                      <span class="text-slate-400 block text-[9px] font-bold uppercase">Cultura</span>
                      <span class="font-bold text-slate-800 dark:text-slate-200">{draft.culture || 'Não informada'}</span>
                    </div>
                    <div>
                      <span class="text-slate-400 block text-[9px] font-bold uppercase">Salvo em</span>
                      <span class="font-medium text-slate-805 dark:text-slate-200">{draft.savedAt ? new Date(draft.savedAt).toLocaleDateString('pt-BR') : '-'}</span>
                    </div>
                  </div>
                  <div class="flex items-center justify-between pt-1">
                    <button
                      onClick={() => { triggerHaptic(12); onCreateReport(draft); }}
                      class="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 rounded-xl text-xs text-center transition-all mr-2"
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
                      class="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-500/10 border border-slate-200 dark:border-slate-700/40 transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Histórico do Piloto */}
        <section class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/40 rounded-2xl overflow-hidden shadow-xs dark:shadow-none">
          <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h4 class="text-lg font-bold text-slate-900 dark:text-white">Meus Relatórios Emitidos</h4>
            <div class="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Buscar cliente, fazenda..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                class="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-primary-500 transition-all"
              />
              <div class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                <Search size={14} />
              </div>
            </div>
          </div>

          {loading ? (
            <PilotReportsSkeleton />
          ) : filteredReports.length === 0 ? (
            <div class="p-16 text-center space-y-4">
              <div class="w-16 h-16 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
                <FileText size={28} />
              </div>
              <div class="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">
                {searchTerm ? 'Nenhum relatório corresponde à sua busca.' : 'Você ainda não possui relatórios gravados. Clique em "Novo Relatório" para iniciar seu primeiro relatório.'}
              </div>
            </div>
          ) : (
            <>
              {/* Tabela para Desktop */}
              <div class="hidden md:block overflow-x-auto">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-slate-50/70 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                      <th class="px-6 py-4">Cliente / Fazenda</th>
                      <th class="px-6 py-4">Data Aplicação</th>
                      <th class="px-6 py-4">Área Total</th>
                      <th class="px-6 py-4">Valor Total</th>
                      <th class="px-6 py-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200 dark:divide-slate-700/40">
                    {filteredReports.map(r => (
                      <tr key={r.id} class="hover:bg-slate-50 dark:hover:bg-slate-700/10 transition-colors">
                        <td class="px-6 py-4">
                          <div class="font-bold text-slate-900 dark:text-white">{r.client_name}</div>
                          <div class="text-xs text-slate-500 dark:text-slate-400 font-semibold">{r.farm_name}</div>
                        </td>
                        <td class="px-6 py-4 text-sm font-semibold text-slate-750 dark:text-slate-300">
                          {new Date(r.report_date).toLocaleDateString('pt-BR')}
                        </td>
                        <td class="px-6 py-4 text-sm font-bold text-slate-750 dark:text-slate-300">
                          {r.total_area} ha
                        </td>
                        <td class="px-6 py-4 text-sm font-black text-emerald-600 dark:text-emerald-400">
                          {r.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td class="px-6 py-4 text-center">
                          <div class="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => { triggerHaptic(10); onViewReport(r.id); }}
                              class="p-2 text-primary-600 dark:text-primary-400 hover:text-white bg-slate-50 hover:bg-primary-600 border border-slate-200 dark:border-slate-700/60 hover:border-primary-500 rounded-lg transition-all"
                              title="Ver Relatório / Exportar PDF"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => { triggerHaptic(15); handleDeleteReport(r.id); }}
                              class="p-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 bg-slate-50 hover:bg-red-500/10 dark:bg-slate-950/20 dark:hover:bg-red-500/10 border border-slate-200 dark:border-slate-700/60 dark:hover:border-red-500/20 rounded-lg transition-all"
                              title="Excluir"
                            >
                              <Trash2 size={15} />
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
                    <div class="grid grid-cols-3 gap-2 text-xs border-t border-b border-slate-200 dark:border-slate-700/30 py-2">
                      <div>
                        <span class="text-slate-400 block text-[9px] font-bold uppercase">Data</span>
                        <span class="font-bold text-slate-800 dark:text-slate-200">{new Date(r.report_date).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div>
                        <span class="text-slate-400 block text-[9px] font-bold uppercase">Área</span>
                        <span class="font-bold text-slate-800 dark:text-slate-200">{r.total_area} ha</span>
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
        </section>
      </main>

      {/* Barra de Navegação Inferior Fixa (Exclusiva Mobile) */}
      <div class="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/80 py-2 px-6 flex items-center justify-around z-30 md:hidden shadow-lg">
        <button
          onClick={() => {
            triggerHaptic(8);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          class="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-450 transition-all active:scale-95 space-y-1 focus:outline-none"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span class="text-[9px] font-bold">Painel</span>
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
          onClick={toggleTheme}
          class="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-450 transition-all active:scale-95 space-y-1 focus:outline-none"
        >
          {theme === 'dark' ? (
            <>
              <Sun size={19} />
              <span class="text-[9px] font-bold">Claro</span>
            </>
          ) : (
            <>
              <Moon size={19} />
              <span class="text-[9px] font-bold">Escuro</span>
            </>
          )}
        </button>

        <button
          onClick={() => { triggerHaptic(12); onLogout(); }}
          class="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all active:scale-95 space-y-1 focus:outline-none"
        >
          <LogOut size={19} />
          <span class="text-[9px] font-bold">Sair</span>
        </button>
      </div>
    </div>
  );
}
