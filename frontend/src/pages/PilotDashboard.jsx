import React, { useState, useEffect } from 'react';
import { LogOut, Plus, FileText, Eye, Map, Trash2 } from 'lucide-react';
import { getDrafts, deleteDraft } from '../utils/offlineDb';

export default function PilotDashboard({ onLogout, onCreateReport, onViewReport }) {
  const [reports, setReports] = useState([]);
  const [offlineDrafts, setOfflineDrafts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('gama_user') || '{}');

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

  return (
    <div class="min-h-screen bg-slate-900 text-slate-100 font-sans">
      {/* Top Header */}
      <header class="bg-slate-800 border-b border-slate-700/60 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-emerald-500 flex items-center justify-center font-extrabold text-white text-lg">
            D
          </div>
          <div>
            <h2 class="text-lg font-bold">AgroSkan</h2>
            <p class="text-xs text-slate-400 font-bold uppercase tracking-wider">{user.company_name || 'Empresa'}</p>
          </div>
        </div>
        <div class="flex items-center space-x-4">
          <div class="hidden md:block text-right">
            <div class="text-sm font-bold text-white">{user.name}</div>
            <div class="text-xs text-slate-400 font-semibold">Piloto de Drones</div>
          </div>
          <button 
            onClick={onLogout}
            class="flex items-center space-x-2 bg-slate-700/50 hover:bg-red-500/10 hover:text-red-200 border border-slate-600/50 hover:border-red-500/20 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            <LogOut size={15} />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main class="max-w-5xl mx-auto p-6 space-y-8">
        
        {/* Banner de Sincronização Offline */}
        {offlineDrafts.length > 0 && (
          <div class="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
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

        {/* Banner de Boas-vindas e Ação Principal */}
        <section class="bg-gradient-to-r from-slate-800 to-slate-800/60 border border-slate-700/40 p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div class="space-y-2 text-center md:text-left">
            <h3 class="text-2xl font-black text-white">Olá, {user.name.split(' ')[0]}!</h3>
            <p class="text-slate-400 font-medium text-sm">Pronto para lançar um novo relatório de pulverização em campo?</p>
          </div>
          <button
            onClick={onCreateReport}
            class="flex items-center space-x-2 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white px-6 py-3.5 rounded-2xl text-base font-extrabold shadow-lg shadow-primary-500/10 hover:shadow-primary-500/20 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus size={20} />
            <span>Novo Relatório</span>
          </button>
        </section>

        {/* Histórico do Piloto */}
        <section class="bg-slate-800 border border-slate-700/40 rounded-2xl overflow-hidden">
          <div class="px-6 py-5 border-b border-slate-700">
            <h4 class="text-lg font-bold">Meus Relatórios Emitidos</h4>
          </div>

          {loading ? (
            <div class="p-12 text-center text-slate-400">Carregando seus relatórios...</div>
          ) : reports.length === 0 ? (
            <div class="p-16 text-center space-y-4">
              <div class="w-16 h-16 bg-slate-900 border border-slate-700 rounded-full flex items-center justify-center mx-auto text-slate-500">
                <FileText size={28} />
              </div>
              <div class="text-slate-400 font-medium max-w-sm mx-auto">
                Você ainda não possui relatórios gravados. Clique em "Novo Relatório" para iniciar seu primeiro relatório.
              </div>
            </div>
          ) : (
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-900/40 text-slate-400 text-xs font-bold uppercase border-b border-slate-700">
                    <th class="px-6 py-4">Cliente / Fazenda</th>
                    <th class="px-6 py-4">Data Aplicação</th>
                    <th class="px-6 py-4">Área Total</th>
                    <th class="px-6 py-4">Valor Total</th>
                    <th class="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-700/40">
                  {reports.map(r => (
                    <tr key={r.id} class="hover:bg-slate-700/10 transition-colors">
                      <td class="px-6 py-4">
                        <div class="font-bold text-white">{r.client_name}</div>
                        <div class="text-xs text-slate-400 font-semibold">{r.farm_name}</div>
                      </td>
                      <td class="px-6 py-4 text-sm font-semibold text-slate-300">
                        {new Date(r.report_date).toLocaleDateString('pt-BR')}
                      </td>
                      <td class="px-6 py-4 text-sm font-bold text-slate-300">
                        {r.total_area} ha
                      </td>
                      <td class="px-6 py-4 text-sm font-black text-emerald-400">
                        {r.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => onViewReport(r.id)}
                            class="p-2 text-primary-400 hover:text-white bg-slate-950/20 hover:bg-primary-600 border border-slate-700/60 hover:border-primary-500 rounded-lg transition-all"
                            title="Ver Relatório / Exportar PDF"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteReport(r.id)}
                            class="p-2 text-slate-400 hover:text-red-400 bg-slate-950/20 hover:bg-red-500/10 border border-slate-700/60 hover:border-red-500/20 rounded-lg transition-all"
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
          )}
        </section>
      </main>
    </div>
  );
}
