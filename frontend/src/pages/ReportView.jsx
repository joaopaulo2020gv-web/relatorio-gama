import React, { useState, useEffect } from 'react';
import { Printer, ArrowLeft } from 'lucide-react';

export default function ReportView({ reportId, onBack }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReportDetails = async () => {
      try {
        const response = await fetch(`/api/reports/${reportId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('gama_token')}` }
        });
        const data = await response.json();
        if (response.ok) {
          setReport(data.report);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchReportDetails();
  }, [reportId]);

  if (loading) {
    return <div class="text-center py-12 text-slate-400 no-print">Carregando visualização do laudo...</div>;
  }

  if (!report) {
    return <div class="text-center py-12 text-red-400 no-print">Relatório não encontrado.</div>;
  }

  const printYear = new Date(report.report_date).getFullYear();
  const pilotResponsible = report.pilot_name;

  return (
    <div class="min-h-screen bg-slate-900 md:p-6 text-slate-900 font-sans">
      
      {/* Botões do Topo (Escondidos na Impressão) */}
      <div class="max-w-4xl mx-auto mb-6 px-4 flex items-center justify-between no-print">
        <button
          onClick={onBack}
          class="flex items-center space-x-2 text-slate-300 hover:text-white font-bold text-sm bg-slate-800 border border-slate-700/60 px-4 py-2.5 rounded-xl transition-all"
        >
          <ArrowLeft size={16} />
          <span>Voltar ao Painel</span>
        </button>
        <button
          onClick={() => window.print()}
          class="flex items-center space-x-2 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white px-5 py-2.5 rounded-xl text-sm font-extrabold shadow-lg shadow-primary-500/10 transition-all"
        >
          <Printer size={16} />
          <span>Exportar PDF / Imprimir</span>
        </button>
      </div>

      {/* ==========================================
         CONTAINER DO RELATÓRIO (FORMATO A4)
         ========================================== */}
      <div class="print-container max-w-[21cm] mx-auto bg-white p-[2cm] shadow-2xl rounded-none md:border border-slate-200 text-black min-h-[29.7cm] flex flex-col justify-between relative overflow-hidden">
        
        {/* ==========================================
           PÁGINA 1: CAPA
           ========================================== */}
        <div class="h-[25cm] flex flex-col justify-between relative">
          {/* Logo Topo Direita */}
          <div class="flex justify-end">
            {report.company_logo_url ? (
              <img src={report.company_logo_url} alt="Logo" class="h-12 max-w-[150px] object-contain" />
            ) : (
              <span class="text-sm font-black tracking-tight text-slate-700 uppercase">{report.company_name}</span>
            )}
          </div>

          {/* Logo Principal Centro */}
          <div class="flex flex-col items-center justify-center flex-1 my-16 space-y-6">
            {report.company_logo_url ? (
              <img src={report.company_logo_url} alt="Logo Central" class="h-28 max-w-[300px] object-contain" />
            ) : (
              <span class="text-4xl font-black text-slate-700 uppercase tracking-wider">{report.company_name}</span>
            )}
            <div class="text-[10px] font-bold text-slate-500 tracking-[0.3em] uppercase">DRONES AGRÍCOLAS</div>
          </div>

          {/* Título Principal */}
          <div class="text-left space-y-2 border-l-4 border-emerald-600 pl-4 py-2">
            <h1 class="text-2xl font-black tracking-tight text-slate-800 uppercase">RELATÓRIO DE PRESTAÇÃO DE SERVIÇOS</h1>
          </div>

          {/* Dados do Cliente e Assinatura */}
          <div class="border-t border-slate-200 pt-6 mt-16 text-xs text-slate-700 font-semibold space-y-1.5">
            <div>CLIENTE: <span class="text-slate-900 font-bold uppercase">{report.client_name} - FAZENDA {report.farm_name}</span></div>
            <div>DATA: <span class="text-slate-900 font-bold">{new Date(report.report_date).toLocaleDateString('pt-BR')}</span></div>
          </div>
        </div>

        {/* ==========================================
           PÁGINA 2: RELATÓRIO E HISTÓRICO
           ========================================== */}
        <div class="page-break-before pt-6 space-y-6">
          {/* Cabeçalho da página */}
          <div class="flex items-center justify-between border-b-2 border-slate-100 pb-3">
            <h2 class="text-sm font-black text-slate-800 uppercase tracking-wider">
              RELATÓRIO PULVERIZAÇÃO - RTP {report.id}/{printYear}
            </h2>
            {report.company_logo_url && (
              <img src={report.company_logo_url} alt="Logo" class="h-8 max-w-[100px] object-contain" />
            )}
          </div>

          {/* 1. DADOS */}
          <div class="space-y-2">
            <h3 class="text-xs font-black uppercase text-emerald-600 tracking-wider">1. DADOS</h3>
            <table class="w-full text-xs border border-slate-300 border-collapse">
              <thead>
                <tr class="bg-slate-100 font-bold text-slate-700">
                  <th class="border border-slate-300 px-3 py-2">RESPONSÁVEL</th>
                  <th class="border border-slate-300 px-3 py-2">FAZENDA</th>
                  <th class="border border-slate-300 px-3 py-2">CULTURA</th>
                </tr>
              </thead>
              <tbody>
                <tr class="text-slate-800">
                  <td class="border border-slate-300 px-3 py-2 uppercase">{report.client_name}</td>
                  <td class="border border-slate-300 px-3 py-2 uppercase">Fazenda {report.farm_name}</td>
                  <td class="border border-slate-300 px-3 py-2 uppercase">{report.culture}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 2. APLICAÇÃO */}
          <div class="space-y-4">
            <h3 class="text-xs font-black uppercase text-emerald-600 tracking-wider">2. APLICAÇÃO</h3>
            
            {/* 2.1 HISTÓRICO */}
            <div class="space-y-2">
              <h4 class="text-xs font-bold text-slate-700 uppercase">2.1. HISTÓRICO</h4>
              <table class="w-full text-xs border border-slate-300 border-collapse">
                <thead>
                  <tr class="bg-slate-100 font-bold text-slate-700">
                    <th class="border border-slate-300 px-3 py-2">Data</th>
                    <th class="border border-slate-300 px-3 py-2">Drone</th>
                    <th class="border border-slate-300 px-3 py-2">Área (ha)</th>
                    <th class="border border-slate-300 px-3 py-2">Altura (m)</th>
                    <th class="border border-slate-300 px-3 py-2">Faixa (m)</th>
                    <th class="border border-slate-300 px-3 py-2">Veloc. (km/h)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.flights_data && report.flights_data.map((flight, idx) => (
                    <tr key={idx} class="text-slate-800">
                      <td class="border border-slate-300 px-3 py-2">{new Date(flight.date).toLocaleDateString('pt-BR')}</td>
                      <td class="border border-slate-300 px-3 py-2">{flight.drone}</td>
                      <td class="border border-slate-300 px-3 py-2 font-bold">{flight.area}</td>
                      <td class="border border-slate-300 px-3 py-2">{flight.height}</td>
                      <td class="border border-slate-300 px-3 py-2">{flight.width}</td>
                      <td class="border border-slate-300 px-3 py-2">{flight.speed}</td>
                    </tr>
                  ))}
                  <tr class="bg-slate-100 font-bold text-slate-800">
                    <td colspan="2" class="border border-slate-300 px-3 py-2 text-right">TOTAL</td>
                    <td class="border border-slate-300 px-3 py-2">{report.total_area} ha</td>
                    <td colspan="3" class="border border-slate-300 px-3 py-2"></td>
                  </tr>
                </tbody>
              </table>
              {pilotResponsible && (
                <div class="border border-slate-300 px-3 py-2 text-xs text-slate-700">
                  <strong>Piloto responsável:</strong> {pilotResponsible}
                </div>
              )}
            </div>

            {/* 2.2 CONDIÇÕES CLIMÁTICAS */}
            <div class="space-y-3">
              <h4 class="text-xs font-bold text-slate-700 uppercase">2.2. CONDIÇÕES CLIMÁTICAS</h4>
              <div class="border border-slate-300 p-3 rounded space-y-2 text-xs text-slate-700">
                <div><strong>Descrição do evento:</strong></div>
                <div class="text-slate-800">{report.weather_desc}</div>
                <div class="mt-2 text-slate-500 font-semibold">
                  Temperatura Média: {report.weather_temp}°C | Umidade Média: {report.weather_humidity}% | Delta T: {report.delta_t}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ==========================================
           PÁGINA 3: GRÁFICO E EXPLICATIVO DELTA T
           ========================================== */}
        <div class="page-break-before pt-6 space-y-4">
          <div class="flex items-center justify-between border-b-2 border-slate-100 pb-3">
            <h2 class="text-sm font-black text-slate-800 uppercase tracking-wider">Condições de Aplicação (Delta T)</h2>
            {report.company_logo_url && (
              <img src={report.company_logo_url} alt="Logo" class="h-8 max-w-[100px] object-contain" />
            )}
          </div>
          
          <div class="space-y-4 text-xs text-slate-700 leading-relaxed">
            <h3 class="text-sm font-black text-slate-800">Gráfico Informativo Delta T</h3>
            <p>
              O gráfico Delta T é uma ferramenta prática que nos ajuda a identificar o momento ideal para fazer as pulverizações.
              A faixa ideal recomendada de Delta T está entre **2 e 8**.
            </p>

            {/* Quadro de cruzamento de dados */}
            <div class="border border-slate-300 rounded-xl p-6 bg-slate-50/50 space-y-4 max-w-xl mx-auto">
              <h4 class="font-bold text-slate-800 text-center">Cruzamento de Dados Registrado</h4>
              <div class="grid grid-cols-3 text-center gap-4">
                <div class="border-r border-slate-200">
                  <div class="text-[10px] text-slate-500 uppercase font-bold">Temperatura</div>
                  <div class="text-lg font-black text-slate-800">{report.weather_temp} °C</div>
                </div>
                <div class="border-r border-slate-200">
                  <div class="text-[10px] text-slate-500 uppercase font-bold">Umidade Relativa</div>
                  <div class="text-lg font-black text-slate-800">{report.weather_humidity} %</div>
                </div>
                <div>
                  <div class="text-[10px] text-slate-500 uppercase font-bold">Valor Delta T</div>
                  <div class="text-lg font-black text-emerald-600">{report.delta_t}</div>
                </div>
              </div>
              
              <div class="text-center pt-2">
                <span class={`inline-block px-4 py-1.5 rounded-lg text-xs font-bold ${
                  report.delta_t >= 2 && report.delta_t <= 8
                    ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-300'
                    : 'bg-amber-500/10 text-amber-700 border border-amber-300'
                }`}>
                  {report.delta_t >= 2 && report.delta_t <= 8 
                    ? '✓ Aplicação recomendada dentro dos padrões' 
                    : '⚠ Aplicação com condições marginais ou restritas'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ==========================================
           PÁGINA 4: MISTURAS DE CALDAS
           ========================================== */}
        <div class="page-break-before pt-6 space-y-6">
          <div class="flex items-center justify-between border-b-2 border-slate-100 pb-3">
            <h2 class="text-sm font-black text-slate-800 uppercase tracking-wider">2.3. CALDAS</h2>
            {report.company_logo_url && (
              <img src={report.company_logo_url} alt="Logo" class="h-8 max-w-[100px] object-contain" />
            )}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {report.caldas_data && report.caldas_data.map((calda, cIdx) => (
              <div key={cIdx} class="border border-slate-300 rounded overflow-hidden page-break-inside-avoid">
                <div class="bg-slate-100 px-3 py-2 border-b border-slate-300 text-xs font-black text-slate-800 uppercase flex justify-between">
                  <span>{calda.day}</span>
                  <span class="text-slate-500">{calda.location}</span>
                </div>
                <table class="w-full text-[11px] border-collapse">
                  <thead>
                    <tr class="bg-slate-50 text-slate-500 font-bold border-b border-slate-300">
                      <th class="px-3 py-1.5 text-left">PRODUTO</th>
                      <th class="px-3 py-1.5 text-right">DOSAGEM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calda.ingredients.map((ing, iIdx) => (
                      <tr key={iIdx} class="border-b border-slate-200">
                        <td class="px-3 py-1.5 text-slate-700 font-semibold">{ing.product}</td>
                        <td class="px-3 py-1.5 text-right text-slate-900 font-bold">{ing.dosage}</td>
                      </tr>
                    ))}
                    <tr class="font-bold bg-slate-50 text-slate-800">
                      <td class="px-3 py-1.5">TOTAL</td>
                      <td class="px-3 py-1.5 text-right">{calda.total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>

        {/* ==========================================
           PÁGINA 5: TESTE DE PH
           ========================================== */}
        <div class="page-break-before pt-6 space-y-6">
          <div class="flex items-center justify-between border-b-2 border-slate-100 pb-3">
            <h2 class="text-sm font-black text-slate-800 uppercase tracking-wider">Verificação da Calda e pH</h2>
            {report.company_logo_url && (
              <img src={report.company_logo_url} alt="Logo" class="h-8 max-w-[100px] object-contain" />
            )}
          </div>

          <div class="space-y-4">
            <h3 class="text-xs font-bold text-slate-500 uppercase">FOTO DE COMPROVAÇÃO DE pH DA CALDA</h3>
            
            <div class="flex flex-col items-center space-y-4">
              <div class="max-w-md w-full border border-slate-300 p-2 bg-slate-50 rounded-2xl">
                {report.ph_photo_url ? (
                  <img src={report.ph_photo_url} alt="Comprovante pH" class="w-full max-h-[350px] object-contain rounded-xl" />
                ) : (
                  <div class="py-16 text-center text-xs text-slate-400 font-bold border border-dashed border-slate-300 rounded-xl">
                    Nenhuma foto anexada do teste de pH.
                  </div>
                )}
              </div>
              <div class="w-full text-center border-l-4 border-primary-500 pl-4 py-1.5 max-w-xl text-xs text-slate-700 bg-slate-50/50 rounded-r-lg">
                <strong>Descrição do evento:</strong> {report.ph_desc}
              </div>
            </div>
          </div>
        </div>

        {/* ==========================================
           PÁGINAS 6+: MAPAS DE APLICAÇÃO
           ========================================== */}
        {report.maps_data && report.maps_data.map((map, idx) => (
          <div key={idx} class="page-break-before pt-6 space-y-6">
            <div class="flex items-center justify-between border-b-2 border-slate-100 pb-3">
              <h2 class="text-sm font-black text-slate-800 uppercase tracking-wider">2.4. MAPAS DE APLICAÇÃO</h2>
              {report.company_logo_url && (
                <img src={report.company_logo_url} alt="Logo" class="h-8 max-w-[100px] object-contain" />
              )}
            </div>

            <div class="space-y-4">
              <div class="border border-slate-300 p-3 rounded bg-slate-50 text-xs text-slate-700">
                <strong>Descrição do voo / Área:</strong>
                <div class="mt-1 text-slate-800 font-semibold">{map.description || 'Mapa de aplicação sem descrição.'}</div>
              </div>

              <div class="flex justify-center border border-slate-300 p-2 bg-slate-50 rounded-2xl">
                {map.photo_url ? (
                  <img src={map.photo_url} alt={`Mapa da área ${idx + 1}`} class="w-full max-h-[450px] object-contain rounded-xl" />
                ) : (
                  <div class="py-24 text-center text-xs text-slate-400 font-bold border border-dashed border-slate-300 rounded-xl w-full">
                    Mapa de voo não anexado.
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* ==========================================
           ÚLTIMA PÁGINA: OBSERVAÇÕES, DADOS BANCÁRIOS E VALORES
           ========================================== */}
        <div class="page-break-before pt-6 space-y-6 flex-1 flex flex-col justify-between">
          <div class="space-y-6">
            <div class="flex items-center justify-between border-b-2 border-slate-100 pb-3">
              <h2 class="text-sm font-black text-slate-800 uppercase tracking-wider">Fechamento de Laudo</h2>
              {report.company_logo_url && (
                <img src={report.company_logo_url} alt="Logo" class="h-8 max-w-[100px] object-contain" />
              )}
            </div>

            {/* 3. OBSERVAÇÕES PERTINENTES */}
            {report.observations && (
              <div class="space-y-2">
                <h3 class="text-xs font-black uppercase text-emerald-600 tracking-wider">3. OBSERVAÇÕES PERTINENTES</h3>
                <div class="border border-slate-300 p-3 rounded text-xs text-slate-800 leading-relaxed bg-slate-50/50">
                  {report.observations}
                </div>
              </div>
            )}

            {/* 4. DADOS BANCÁRIOS E RESUMO */}
            <div class="space-y-2">
              <h3 class="text-xs font-black uppercase text-emerald-600 tracking-wider">4. DADOS BANCÁRIOS E VALORES</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="border border-slate-300 p-4 rounded text-xs text-slate-700 space-y-1.5 bg-slate-50/50">
                  <div class="font-bold text-slate-800 uppercase border-b border-slate-200 pb-1 mb-2">Dados para Depósito</div>
                  <div>Banco: <span class="text-slate-900 font-bold">{report.bank_name || '-'}</span></div>
                  <div>Agência: <span class="text-slate-900 font-bold">{report.bank_agency || '-'}</span></div>
                  <div>Conta: <span class="text-slate-900 font-bold">{report.bank_account || '-'}</span></div>
                  <div>Nome: <span class="text-slate-900 font-bold">{report.bank_owner || '-'}</span></div>
                  <div>PIX (CPF/CNPJ): <span class="text-slate-900 font-bold">{report.bank_cpf_pix || '-'}</span></div>
                </div>

                <div class="border border-slate-300 p-4 rounded text-xs text-slate-700 flex flex-col justify-between bg-slate-50/50">
                  <div class="font-bold text-slate-800 uppercase border-b border-slate-200 pb-1 mb-2">Resumo Financeiro</div>
                  <div class="flex justify-between items-center py-1">
                    <span>Área Total:</span>
                    <span class="font-bold text-slate-900">{report.total_area} ha</span>
                  </div>
                  <div class="flex justify-between items-center py-1 border-t border-slate-200">
                    <span>Valor por Hectare:</span>
                    <span class="font-bold text-slate-900">
                      {report.price_per_ha.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div class="flex justify-between items-center py-1.5 border-t border-slate-300 mt-2">
                    <span class="font-black text-slate-800 uppercase text-xs">Valor Total:</span>
                    <span class="font-black text-lg text-emerald-600">
                      {report.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé impresso (Marca d'água) */}
          <div class="print-footer text-center pt-4 text-[10px] text-slate-400 font-medium border-t border-slate-100 mt-16">
            Gerado por <strong>Relatório Gama</strong> - www.relatoriogama.com.br
          </div>
        </div>

      </div>
    </div>
  );
}
