import React, { useState, useEffect } from 'react';
import { Printer, ArrowLeft, Sun, Moon, Share2 } from 'lucide-react';

const ReportViewSkeleton = () => (
  <div class="max-w-4xl mx-auto p-6 space-y-8 animate-pulse no-print">
    <div class="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700/60">
      <div class="h-10 bg-slate-200 dark:bg-slate-800 w-32 rounded-xl"></div>
      <div class="h-10 bg-slate-200 dark:bg-slate-800 w-48 rounded-xl"></div>
    </div>
    <div class="bg-white dark:bg-slate-800 p-8 rounded-3xl space-y-6 border border-slate-200 dark:border-slate-700/40">
      <div class="h-8 bg-slate-100 dark:bg-slate-700 w-3/4 rounded-lg"></div>
      <div class="space-y-4">
        <div class="h-4 bg-slate-100 dark:bg-slate-700 w-full rounded"></div>
        <div class="h-4 bg-slate-100 dark:bg-slate-700 w-5/6 rounded"></div>
        <div class="h-4 bg-slate-100 dark:bg-slate-700 w-4/5 rounded"></div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        <div class="h-28 bg-slate-100 dark:bg-slate-700 rounded-2xl"></div>
        <div class="h-28 bg-slate-100 dark:bg-slate-700 rounded-2xl"></div>
      </div>
    </div>
  </div>
);

export default function ReportView({ reportId, onBack, theme, toggleTheme }) {
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
    return <ReportViewSkeleton />;
  }

  if (!report) {
    return <div class="text-center py-12 text-red-600 dark:text-red-400 no-print">Relatório não encontrado.</div>;
  }

  const printYear = new Date(report.report_date).getFullYear();
  const pilotResponsible = report.pilot_name;

  const handleShareReport = async () => {
    const shareText = `Olá! Segue o Relatório de Pulverização Agrícola RTP ${report.id}/${printYear} da Fazenda ${report.farm_name} (Cliente: ${report.client_name}), gerado pelo AgroSkan.`;
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Relatório AgroSkan - RTP ${report.id}/${printYear}`,
          text: shareText,
          url: shareUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Erro ao compartilhar:', err);
        }
      }
    } else {
      const formattedText = encodeURIComponent(`${shareText}\n\nConfira os detalhes no link abaixo:\n${shareUrl}`);
      window.open(`https://api.whatsapp.com/send?text=${formattedText}`, '_blank');
    }
  };

  return (
    <div class="report-view-container min-h-screen bg-slate-50 dark:bg-slate-900 md:p-6 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200 animate-slide-up">
      {/* Botões do Topo (Escondidos na Impressão) */}
      <div class="max-w-4xl mx-auto mb-6 px-4 flex items-center justify-between no-print gap-2">
        <div class="flex items-center space-x-1.5 flex-shrink-0">
          <button
            onClick={onBack}
            class="flex items-center space-x-1.5 text-slate-650 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-bold text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 px-3 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span class="hidden sm:inline">Voltar ao Painel</span>
            <span class="sm:hidden">Voltar</span>
          </button>
          
          {/* Botão de Tema */}
          <button
            onClick={toggleTheme}
            type="button"
            class="p-2.5 bg-white dark:bg-slate-800 text-slate-650 dark:text-slate-200 border border-slate-200 dark:border-slate-600/50 rounded-xl transition-all shadow-xs cursor-pointer"
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
        
        <div class="flex items-center space-x-1.5 flex-shrink-0">
          <button
            onClick={handleShareReport}
            class="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2.5 rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
          >
            <Share2 size={14} />
            <span class="hidden sm:inline">Compartilhar</span>
          </button>
          
          <button
            onClick={() => window.print()}
            class="flex items-center space-x-1.5 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white px-3.5 py-2.5 rounded-xl text-xs font-extrabold shadow-lg shadow-primary-500/10 transition-all cursor-pointer"
          >
            <Printer size={14} />
            <span class="hidden sm:inline">Exportar PDF / Imprimir</span>
            <span class="sm:hidden">PDF / Imprimir</span>
          </button>
        </div>
      </div>

      {/* ==========================================
         CONTAINER DO RELATÓRIO (FORMATO A4)
         ========================================== */}
      <div class="print-container max-w-[21cm] mx-auto bg-white p-[2cm] shadow-2xl rounded-none md:border border-slate-200 text-black min-h-[29.7cm] flex flex-col justify-between relative overflow-hidden">
        
        {/* ==========================================
           PÁGINA 1: CAPA
           ========================================== */}
        <div class="page-break-inside-avoid h-[25cm] print:h-auto print:block relative">
          {/* Logo Topo Direita */}
          <div class="flex justify-end">
            {report.company_logo_url ? (
              <img src={report.company_logo_url} alt="Logo" class="h-16 max-w-[200px] object-contain" />
            ) : (
              <span class="text-sm font-black tracking-tight text-slate-700 uppercase">{report.company_name}</span>
            )}
          </div>

          {/* Logo Principal Centro */}
          <div class="flex flex-col items-center justify-center flex-1 my-16 print:my-4 print:py-2 space-y-6">
            {report.company_logo_url ? (
              <img src={report.company_logo_url} alt="Logo Central" class="h-36 print:h-28 max-w-[400px] object-contain" />
            ) : (
              <span class="text-5xl font-black text-slate-700 uppercase tracking-wider">{report.company_name}</span>
            )}
          </div>

          {/* Título Principal */}
          <div class="text-left space-y-2 border-l-4 border-emerald-600 pl-4 py-2 print:my-6">
            <h1 class="text-2xl font-black tracking-tight text-slate-800 uppercase">RELATÓRIO DE PRESTAÇÃO DE SERVIÇOS</h1>
          </div>

          {/* Dados do Cliente e Assinatura */}
          <div class="border-t border-slate-200 pt-6 mt-16 print:mt-4 text-xs text-slate-700 font-semibold space-y-1.5">
            <div>CLIENTE: <span class="text-slate-900 font-bold uppercase">{report.client_name}</span></div>
            {report.client_document && (
              <div>CPF/CNPJ: <span class="text-slate-900 font-bold">{report.client_document}</span></div>
            )}
            <div>FAZENDA: <span class="text-slate-900 font-bold uppercase">{report.farm_name}</span></div>
            {report.farm_address && (
              <div>ENDEREÇO DA FAZENDA: <span class="text-slate-900 font-bold uppercase">{report.farm_address}</span></div>
            )}
            {report.client_email && (
              <div>E-MAIL: <span class="text-slate-900 font-bold">{report.client_email}</span></div>
            )}
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
                  {report.client_email && (
                    <th class="border border-slate-300 px-3 py-2">E-MAIL</th>
                  )}
                  <th class="border border-slate-300 px-3 py-2">FAZENDA</th>
                  <th class="border border-slate-300 px-3 py-2">CULTURA</th>
                </tr>
              </thead>
              <tbody>
                <tr class="text-slate-800">
                  <td class="border border-slate-300 px-3 py-2 uppercase">
                    <div>{report.client_name}</div>
                    {report.client_document && (
                      <div class="text-[9px] text-slate-500 font-black mt-0.5">CPF/CNPJ: {report.client_document}</div>
                    )}
                  </td>
                  {report.client_email && (
                    <td class="border border-slate-300 px-3 py-2">{report.client_email}</td>
                  )}
                  <td class="border border-slate-300 px-3 py-2 uppercase">
                    <div>Fazenda {report.farm_name}</div>
                    {report.farm_address && (
                      <div class="text-[9px] text-slate-500 font-black mt-0.5 normal-case">{report.farm_address}</div>
                    )}
                  </td>
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
        <div class="page-break-before pt-6 space-y-6 page-break-inside-avoid">
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
                  <img src={report.ph_photo_url} alt="Comprovante pH" class="w-full max-h-[300px] object-contain rounded-xl" />
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
          <div key={idx} class="page-break-before pt-6 space-y-6 page-break-inside-avoid">
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
                  <img src={map.photo_url} alt={`Mapa da área ${idx + 1}`} class="w-full max-h-[350px] object-contain rounded-xl" />
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
              <h2 class="text-sm font-black text-slate-800 uppercase tracking-wider">Fechamento de Relatório</h2>
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
            {/* 5. ASSINATURAS DIGITAIS */}
            <div class="mt-8 pt-4 border-t border-slate-200">
              <div class="grid grid-cols-2 gap-8 text-center text-xs font-semibold text-slate-700">
                <div class="flex flex-col items-center justify-end h-32">
                  {report.pilot_signature ? (
                    <img src={report.pilot_signature} alt="Assinatura do Piloto" class="max-h-20 max-w-full object-contain mb-2" />
                  ) : (
                    <div class="w-full border-b border-dashed border-slate-400 mb-6"></div>
                  )}
                  <div class="font-bold text-slate-800">PILOTO RESPONSÁVEL</div>
                  <div class="text-[10px] text-slate-500">{pilotResponsible}</div>
                </div>
                <div class="flex flex-col items-center justify-end h-32">
                  {report.client_signature ? (
                    <img src={report.client_signature} alt="Assinatura do Cliente" class="max-h-20 max-w-full object-contain mb-2" />
                  ) : (
                    <div class="w-full border-b border-dashed border-slate-400 mb-6"></div>
                  )}
                  <div class="font-bold text-slate-800">CONTRATANTE / PRODUTOR</div>
                  <div class="text-[10px] text-slate-500">{report.client_name}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé impresso (Marca d'água) */}
          <div class="print-footer text-center pt-4 text-[10px] text-slate-400 font-medium border-t border-slate-100 mt-16">
            Gerado por <strong>AgroSkan</strong> - www.agroskan.com
          </div>
        </div>

      </div>
    </div>
  );
}
