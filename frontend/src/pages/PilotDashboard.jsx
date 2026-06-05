import React, { useState, useEffect } from 'react';
import { LogOut, Plus, FileText, Eye, Map, Trash2 } from 'lucide-react';

export default function PilotDashboard({ onLogout, onCreateReport, onViewReport }) {
  const [reports, setReports] = useState([]);
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

  useEffect(() => {
    fetchPilotReports();
  }, []);

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
