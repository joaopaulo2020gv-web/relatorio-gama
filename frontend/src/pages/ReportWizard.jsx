import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Save, Plus, Trash2, Camera, MapPin, Thermometer, Droplet, DollarSign, Calendar } from 'lucide-react';

export default function ReportWizard({ onCancel, onSaveSuccess }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  // Dados da Empresa (buscados no login)
  const user = JSON.parse(localStorage.getItem('gama_user') || '{}');

  // ==========================================
  // ESTADO DO RELATÓRIO
  // ==========================================
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [farmName, setFarmName] = useState('');
  const [culture, setCulture] = useState('Pastagem');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  // Passo 2: Histórico de Voo
  const [flights, setFlights] = useState([
    { date: new Date().toISOString().split('T')[0], drone: 'T20P', area: 10, height: '8,0-12,0', width: '6', speed: '18-21' }
  ]);
  const [pilotResponsible, setPilotResponsible] = useState(user.name);

  // Passo 3: Clima
  const [weatherTemp, setWeatherTemp] = useState(25);
  const [weatherHumidity, setWeatherHumidity] = useState(70);
  const [weatherDesc, setWeatherDesc] = useState('As aplicações ficaram dentro dos limites de indicação.');
  const [deltaT, setDeltaT] = useState(4);

  // Passo 4: Caldas
  const [caldas, setCaldas] = useState([
    {
      day: 'DIA 1',
      location: 'Geral',
      ingredients: [
        { product: 'ÁGUA', dosage: '7,43 L/ha' },
        { product: 'Dominux XT', dosage: '2,50 L/ha' },
        { product: 'ZARTAN', dosage: '20 gr/ha' },
        { product: 'Óleo Mineral', dosage: '0,05 L/ha' },
        { product: 'P51', dosage: '0,01 L/ha' },
        { product: 'AD+', dosage: '0,01 L/ha' }
      ],
      total: '10 L/ha'
    }
  ]);
  const [phPhotoUrl, setPhPhotoUrl] = useState('');
  const [phDesc, setPhDesc] = useState('Sem problemas com a calda. pH após o uso do P51 (redutor de pH).');

  // Passo 5: Mapas
  const [maps, setMaps] = useState([]); // Array de { photo_url, description }
  
  // Passo 6: Fechamento
  const [observations, setObservations] = useState('');
  const [pricePerHa, setPricePerHa] = useState(150); // R$ 150 por hectare padrão
  const [bankInfo, setBankInfo] = useState({
    bank_name: '', bank_agency: '', bank_account: '', bank_owner: '', bank_cpf_pix: ''
  });

  // ==========================================
  // CÁLCULOS E UTILS
  // ==========================================

  // Buscar dados bancários padrão da empresa ao iniciar
  useEffect(() => {
    const fetchCompanyBank = async () => {
      try {
        const response = await fetch('/api/admin/company', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('gama_token')}` }
        });
        const data = await response.json();
        if (response.ok && data.company) {
          setBankInfo({
            bank_name: data.company.bank_name || '',
            bank_agency: data.company.bank_agency || '',
            bank_account: data.company.bank_account || '',
            bank_owner: data.company.bank_owner || '',
            bank_cpf_pix: data.company.bank_cpf_pix || ''
          });
        }
      } catch (e) {
        console.error('Erro ao buscar dados bancários padrão:', e);
      }
    };
    fetchCompanyBank();
  }, []);

  // Calcular Delta T automaticamente usando a fórmula de Stull
  useEffect(() => {
    const temp = parseFloat(weatherTemp);
    const rh = parseFloat(weatherHumidity);
    if (!isNaN(temp) && !isNaN(rh)) {
      // Fórmula de Stull para Temperatura de Bulbo Úmido (Tw)
      const tw = temp * Math.atan(0.151977 * Math.pow(rh + 8.313659, 0.5))
               + Math.atan(temp + rh)
               - Math.atan(rh - 1.676331)
               + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh)
               - 4.686035;
      const calculatedDeltaT = temp - tw;
      setDeltaT(parseFloat(calculatedDeltaT.toFixed(1)));
    }
  }, [weatherTemp, weatherHumidity]);

  const totalArea = flights.reduce((sum, item) => sum + (parseFloat(item.area) || 0), 0);
  const totalPrice = totalArea * (parseFloat(pricePerHa) || 0);

  // ==========================================
  // FUNÇÕES DE UPLOAD
  // ==========================================
  const handlePhotoUpload = async (file, callback) => {
    if (!file) return;
    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const response = await fetch('/api/reports/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('gama_token')}` },
        body: formData
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer upload da imagem.');
      }
      callback(data.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ==========================================
  // CONTROLADORES DA TABELA E CALDA
  // ==========================================
  const addFlightRow = () => {
    setFlights([...flights, { date: new Date().toISOString().split('T')[0], drone: 'T20P', area: 0, height: '8,0-12,0', width: '6', speed: '18' }]);
  };

  const removeFlightRow = (index) => {
    if (flights.length === 1) return;
    setFlights(flights.filter((_, i) => i !== index));
  };

  const updateFlightField = (index, field, value) => {
    const updated = [...flights];
    updated[index][field] = value;
    setFlights(updated);
  };

  const addCalda = () => {
    const nextDay = caldas.length + 1;
    setCaldas([...caldas, {
      day: `DIA ${nextDay}`,
      location: 'Geral',
      ingredients: [{ product: 'ÁGUA', dosage: '10 L/ha' }],
      total: '10 L/ha'
    }]);
  };

  const removeCalda = (index) => {
    if (caldas.length === 1) return;
    setCaldas(caldas.filter((_, i) => i !== index));
  };

  const updateCaldaDayField = (index, field, value) => {
    const updated = [...caldas];
    updated[index][field] = value;
    setCaldas(updated);
  };

  // Função para recalcular o total da calda com base nos ingredientes
  const recalcCaldaTotal = (calda) => {
    let totalLiters = 0;
    calda.ingredients.forEach(ing => {
      const dosageStr = (ing.dosage || '').trim().replace(',', '.');
      if (!dosageStr) return;

      // 1. Verificar se é sólido (gramas, kg, etc.) e ignorar na soma de volume líquido
      const isSolid = /g(r)?\/ha|g(r)?\b|gramas?|kg/i.test(dosageStr);
      if (isSolid) return;

      // 2. Verificar se está em ml e converter para litros (dividido por 1000)
      const mlMatch = dosageStr.match(/([\d.]+)\s*m[lL]/);
      if (mlMatch) {
        const value = parseFloat(mlMatch[1]) || 0;
        totalLiters += value / 1000;
        return;
      }

      // 3. Extrair qualquer número puro e tratar como litros
      const numMatch = dosageStr.match(/([\d.]+)/);
      if (numMatch) {
        const value = parseFloat(numMatch[1]) || 0;
        totalLiters += value;
      }
    });
    return `${totalLiters.toFixed(2).replace('.', ',')} L/ha`;
  };

  const addIngredient = (caldaIndex) => {
    const updated = [...caldas];
    updated[caldaIndex].ingredients.push({ product: '', dosage: '' });
    setCaldas(updated);
  };

  const removeIngredient = (caldaIndex, ingIndex) => {
    const updated = [...caldas];
    updated[caldaIndex].ingredients = updated[caldaIndex].ingredients.filter((_, i) => i !== ingIndex);
    updated[caldaIndex].total = recalcCaldaTotal(updated[caldaIndex]);
    setCaldas(updated);
  };

  const updateIngredientField = (caldaIndex, ingIndex, field, value) => {
    const updated = [...caldas];
    updated[caldaIndex].ingredients[ingIndex][field] = value;
    if (field === 'dosage') {
      updated[caldaIndex].total = recalcCaldaTotal(updated[caldaIndex]);
    }
    setCaldas(updated);
  };

  const addMap = () => {
    setMaps([...maps, { photo_url: '', description: '' }]);
  };

  const removeMap = (index) => {
    setMaps(maps.filter((_, i) => i !== index));
  };

  const updateMapField = (index, field, value) => {
    const updated = [...maps];
    updated[index][field] = value;
    setMaps(updated);
  };

  // ==========================================
  // SALVAR RELATÓRIO
  // ==========================================
  const handleSaveReport = async () => {
    if (!clientName || !farmName || !culture) {
      setError('Por favor, preencha Cliente, Fazenda e Cultura.');
      setStep(1);
      return;
    }

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gama_token')}`
        },
        body: JSON.stringify({
          client_name: clientName,
          farm_name: farmName,
          client_email: clientEmail,
          culture,
          report_date: reportDate,
          flights_data: flights,
          weather_temp: weatherTemp,
          weather_humidity: weatherHumidity,
          weather_desc: weatherDesc,
          delta_t: deltaT,
          caldas_data: caldas,
          ph_photo_url: phPhotoUrl,
          ph_desc: phDesc,
          maps_data: maps,
          observations,
          total_area: totalArea,
          price_per_ha: pricePerHa,
          total_price: totalPrice
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar relatório.');
      }

      onSaveSuccess();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div class="min-h-screen bg-slate-900 text-slate-100 font-sans pb-12">
      {/* Header Wizard */}
      <header class="bg-slate-800 border-b border-slate-700/60 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div class="flex items-center space-x-3">
          <button onClick={onCancel} class="text-slate-400 hover:text-white font-bold text-sm">
            ← Sair do Assistente
          </button>
        </div>
        <div class="text-center">
          <span class="text-xs text-primary-400 font-bold uppercase tracking-wider">Passo {step} de 6</span>
          <h2 class="text-sm font-black text-white">Criando Relatório</h2>
        </div>
        <div>
          <button
            onClick={handleSaveReport}
            class="flex items-center space-x-1.5 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md"
          >
            <Save size={14} />
            <span>Finalizar</span>
          </button>
        </div>
      </header>

      {/* Progresso de Steps */}
      <div class="max-w-4xl mx-auto px-6 mt-6">
        <div class="flex items-center justify-between relative">
          <div class="absolute h-0.5 bg-slate-700 left-0 right-0 top-1/2 -translate-y-1/2 z-0"></div>
          <div class="absolute h-0.5 bg-primary-600 left-0 top-1/2 -translate-y-1/2 z-0 transition-all duration-300" style={{ width: `${((step - 1) / 5) * 100}%` }}></div>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <button
              key={i}
              onClick={() => setStep(i)}
              class={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs z-10 border transition-all ${
                i <= step 
                  ? 'bg-primary-600 border-primary-500 text-white shadow-lg shadow-primary-500/20' 
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      {/* Main Wizard Form */}
      <main class="max-w-4xl mx-auto p-6 mt-6 bg-slate-800 border border-slate-700/40 rounded-3xl shadow-xl">
        {error && (
          <div class="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        {/* ==========================================
           PASSO 1: INFORMAÇÕES BÁSICAS
           ========================================== */}
        {step === 1 && (
          <div class="space-y-6">
            <div class="border-b border-slate-700 pb-2 flex items-center space-x-2">
              <MapPin class="text-primary-500" size={20} />
              <h3 class="text-lg font-bold">Informações do Cliente & Localização</h3>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-slate-300 text-xs font-bold mb-1.5">Nome do Cliente *</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: Produtor Exemplo"
                  class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                />
              </div>
              <div>
                <label class="block text-slate-300 text-xs font-bold mb-1.5">E-mail do Cliente (Opcional)</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="Ex: cliente@email.com"
                  class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label class="block text-slate-300 text-xs font-bold mb-1.5">Nome da Fazenda *</label>
                <input
                  type="text"
                  required
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  placeholder="Ex: Fazenda Primavera"
                  class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                />
              </div>
              <div>
                <label class="block text-slate-300 text-xs font-bold mb-1.5">Cultura / Plantação *</label>
                <input
                  type="text"
                  required
                  value={culture}
                  onChange={(e) => setCulture(e.target.value)}
                  placeholder="Ex: Soja, Milho, Pastagem"
                  class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                />
              </div>
              <div>
                <label class="block text-slate-300 text-xs font-bold mb-1.5">Data do Relatório *</label>
                <div class="relative">
                  <input
                    type="date"
                    required
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    class="w-full pl-4 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm text-left appearance-none"
                  />
                  <div class="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Calendar size={16} />
                  </div>
                </div>
              </div>
            </div>

            <div class="p-4 bg-slate-900/50 border border-slate-700/60 rounded-2xl flex items-center space-x-4">
              <div class="w-12 h-12 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center font-bold">
                i
              </div>
              <div class="text-xs text-slate-400 font-semibold space-y-0.5">
                <div>Empresa: <strong class="text-slate-200">{user.company_name}</strong></div>
                <div>CNPJ: <strong class="text-slate-200">{user.cnpj || 'Preencher nas config. de Admin'}</strong></div>
                <div>Os dados da sua empresa e o logotipo serão impressos de forma automática no PDF.</div>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
           PASSO 2: HISTÓRICO DE VOOS
           ========================================== */}
        {step === 2 && (
          <div class="space-y-6">
            <div class="border-b border-slate-700 pb-2 flex items-center justify-between">
              <h3 class="text-lg font-bold">Histórico de Aplicação</h3>
              <button
                type="button"
                onClick={addFlightRow}
                class="flex items-center space-x-1.5 bg-primary-600/20 text-primary-400 border border-primary-500/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary-600 hover:text-white transition-all"
              >
                <Plus size={14} />
                <span>Adicionar Linha</span>
              </button>
            </div>

            <div class="overflow-x-auto no-scrollbar">
              <table class="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr class="text-slate-400 text-xs font-bold border-b border-slate-700">
                    <th class="py-2 pr-2">Data</th>
                    <th class="py-2 px-2">Drone</th>
                    <th class="py-2 px-2">Área (ha)</th>
                    <th class="py-2 px-2">Altura (m)</th>
                    <th class="py-2 px-2">Faixa (m)</th>
                    <th class="py-2 px-2">Veloc. (km/h)</th>
                    <th class="py-2 pl-2 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-700/50">
                  {flights.map((flight, idx) => (
                    <tr key={idx}>
                      <td class="py-3 pr-2">
                        <input
                          type="date"
                          value={flight.date}
                          onChange={(e) => updateFlightField(idx, 'date', e.target.value)}
                          class="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white text-left appearance-none"
                        />
                      </td>
                      <td class="py-3 px-2">
                        <input
                          type="text"
                          value={flight.drone}
                          onChange={(e) => updateFlightField(idx, 'drone', e.target.value)}
                          class="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                        />
                      </td>
                      <td class="py-3 px-2">
                        <input
                          type="number"
                          step="0.1"
                          value={flight.area}
                          onChange={(e) => updateFlightField(idx, 'area', parseFloat(e.target.value) || 0)}
                          class="w-16 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-bold"
                        />
                      </td>
                      <td class="py-3 px-2">
                        <input
                          type="text"
                          value={flight.height}
                          onChange={(e) => updateFlightField(idx, 'height', e.target.value)}
                          class="w-24 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                        />
                      </td>
                      <td class="py-3 px-2">
                        <input
                          type="text"
                          value={flight.width}
                          onChange={(e) => updateFlightField(idx, 'width', e.target.value)}
                          class="w-16 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                        />
                      </td>
                      <td class="py-3 px-2">
                        <input
                          type="text"
                          value={flight.speed}
                          onChange={(e) => updateFlightField(idx, 'speed', e.target.value)}
                          class="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                        />
                      </td>
                      <td class="py-3 pl-2 text-center">
                        <button
                          type="button"
                          disabled={flights.length === 1}
                          onClick={() => removeFlightRow(idx)}
                          class="p-1.5 text-slate-500 hover:text-red-400 disabled:opacity-30"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div class="pt-4 border-t border-slate-700 flex justify-between items-center text-sm">
              <span class="text-slate-400 font-semibold">Área Total:</span>
              <span class="text-base font-black text-primary-400">{totalArea} ha</span>
            </div>

            <div>
              <label class="block text-slate-300 text-xs font-bold mb-1.5">Piloto Responsável & Auxiliares de Calda</label>
              <input
                type="text"
                value={pilotResponsible}
                onChange={(e) => setPilotResponsible(e.target.value)}
                placeholder="Ex: Equipe de campo no acompanhamento"
                class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
              />
            </div>
          </div>
        )}

        {/* ==========================================
           PASSO 3: CONDIÇÕES CLIMÁTICAS & DELTA T
           ========================================== */}
        {step === 3 && (
          <div class="space-y-6">
            <div class="border-b border-slate-700 pb-2 flex items-center space-x-2">
              <Thermometer class="text-primary-500" size={20} />
              <h3 class="text-lg font-bold">Condições Climáticas & Delta T</h3>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-4">
                <div>
                  <label class="block text-slate-300 text-xs font-bold mb-1.5 flex justify-between">
                    <span>Temperatura Média (°C)</span>
                    <span class="text-slate-400">{weatherTemp} °C</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="45"
                    step="0.5"
                    value={weatherTemp}
                    onChange={(e) => setWeatherTemp(parseFloat(e.target.value))}
                    class="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                </div>

                <div>
                  <label class="block text-slate-300 text-xs font-bold mb-1.5 flex justify-between">
                    <span>Umidade Relativa (%)</span>
                    <span class="text-slate-400">{weatherHumidity} %</span>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    value={weatherHumidity}
                    onChange={(e) => setWeatherHumidity(parseInt(e.target.value))}
                    class="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                </div>
              </div>

              {/* Indicador Delta T */}
              <div class="bg-slate-900/50 border border-slate-700/60 p-6 rounded-2xl flex flex-col justify-center items-center text-center">
                <div class="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Delta T Calculado</div>
                <div class="text-5xl font-black text-white mb-2">{deltaT}</div>
                
                {/* Safe / Danger zones baseadas no Delta T (ideal de 2 a 8) */}
                {deltaT >= 2 && deltaT <= 8 ? (
                  <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold">
                    Condições Ideais para Aplicação
                  </div>
                ) : deltaT > 8 && deltaT <= 10 ? (
                  <div class="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-bold">
                    Condições Marginais (Evaporação rápida)
                  </div>
                ) : (
                  <div class="bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold">
                    Inadequado para Aplicação (Alto risco)
                  </div>
                )}
              </div>
            </div>

            <div>
              <label class="block text-slate-300 text-xs font-bold mb-1.5">Descrição Climática (Resumo)</label>
              <textarea
                value={weatherDesc}
                onChange={(e) => setWeatherDesc(e.target.value)}
                placeholder="Ex: As condições climáticas estavam adequadas durante a aplicação."
                rows="3"
                class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
              ></textarea>
            </div>
          </div>
        )}

        {/* ==========================================
           PASSO 4: CALDAS & PH
           ========================================== */}
        {step === 4 && (
          <div class="space-y-6">
            <div class="border-b border-slate-700 pb-2 flex items-center justify-between">
              <h3 class="text-lg font-bold flex items-center space-x-2">
                <Droplet class="text-primary-500" size={20} />
                <span>Formulação de Calda por Área</span>
              </h3>
              <button
                type="button"
                onClick={addCalda}
                class="flex items-center space-x-1 bg-primary-600/20 text-primary-400 border border-primary-500/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary-600 hover:text-white transition-all"
              >
                <Plus size={14} />
                <span>Adicionar Calda</span>
              </button>
            </div>

            {/* Lista de Caldas */}
            <div class="space-y-6">
              {caldas.map((calda, cIdx) => (
                <div key={cIdx} class="bg-slate-900/40 border border-slate-700/60 p-5 rounded-2xl relative space-y-4">
                  <button
                    type="button"
                    disabled={caldas.length === 1}
                    onClick={() => removeCalda(cIdx)}
                    class="absolute top-4 right-4 text-slate-500 hover:text-red-400 disabled:opacity-30"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div class="flex flex-wrap gap-4">
                    <div class="flex-1 min-w-[120px]">
                      <label class="block text-slate-400 text-xs font-bold mb-1">Identificação Calda (ex: DIA 1)</label>
                      <input
                        type="text"
                        value={calda.day}
                        onChange={(e) => updateCaldaDayField(cIdx, 'day', e.target.value)}
                        class="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-bold"
                      />
                    </div>
                    <div class="flex-1 min-w-[120px]">
                      <label class="block text-slate-400 text-xs font-bold mb-1">Local (ex: Jaqueira)</label>
                      <input
                        type="text"
                        value={calda.location}
                        onChange={(e) => updateCaldaDayField(cIdx, 'location', e.target.value)}
                        class="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* Ingredientes da calda */}
                  <div class="space-y-2">
                    <div class="flex items-center justify-between text-xs text-slate-400 font-bold">
                      <span>Produto / Ingrediente</span>
                      <span>Dosagem (L/ha, gr/ha)</span>
                    </div>

                    {calda.ingredients.map((ing, iIdx) => (
                      <div key={iIdx} class="flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder="Ex: ÁGUA ou Produto Exemplo"
                          value={ing.product}
                          onChange={(e) => updateIngredientField(cIdx, iIdx, 'product', e.target.value)}
                          class="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Ex: 10,00 L/ha"
                          value={ing.dosage}
                          onChange={(e) => updateIngredientField(cIdx, iIdx, 'dosage', e.target.value)}
                          class="w-32 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                        />
                        <button
                          type="button"
                          disabled={calda.ingredients.length === 1}
                          onClick={() => removeIngredient(cIdx, iIdx)}
                          class="text-slate-500 hover:text-red-400 p-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    <div class="flex justify-between items-center pt-2">
                      <button
                        type="button"
                        onClick={() => addIngredient(cIdx)}
                        class="text-[11px] text-primary-400 hover:text-primary-300 font-bold"
                      >
                        + Adicionar Produto
                      </button>
                      <div class="flex items-center space-x-2 text-xs">
                        <span class="text-slate-400">Total calda:</span>
                        <span class="w-auto px-3 py-1 bg-primary-600/10 border border-primary-500/30 rounded text-center text-xs text-primary-300 font-black">
                          {calda.total}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* pH Section */}
            <div class="border-t border-slate-700 pt-6 space-y-4">
              <h4 class="text-sm font-bold text-primary-400 uppercase tracking-wider">Verificação de pH</h4>
              <div class="flex flex-col md:flex-row md:space-x-6 space-y-4 md:space-y-0">
                <div class="flex flex-col items-center">
                  <div class="w-36 h-36 border border-slate-700 bg-slate-900 rounded-2xl flex items-center justify-center overflow-hidden relative">
                    {phPhotoUrl ? (
                      <img src={phPhotoUrl} alt="Foto Fita Teste pH" class="w-full h-full object-cover" />
                    ) : (
                      <Camera size={32} class="text-slate-600" />
                    )}
                    {uploading && (
                      <div class="absolute inset-0 bg-black/60 flex items-center justify-center text-xs">Aguarde...</div>
                    )}
                  </div>
                  <label class="mt-3 cursor-pointer flex items-center space-x-1.5 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold">
                    <Camera size={14} />
                    <span>Tirar Foto / Anexar</span>
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden"
                      onChange={(e) => handlePhotoUpload(e.target.files[0], setPhPhotoUrl)}
                    />
                  </label>
                </div>
                <div class="flex-1">
                  <label class="block text-slate-300 text-xs font-bold mb-1.5">Descrição do Teste de pH</label>
                  <textarea
                    value={phDesc}
                    onChange={(e) => setPhDesc(e.target.value)}
                    placeholder="Ex: pH medido ideal de acordo com a recomendação técnica."
                    rows="4"
                    class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
           PASSO 5: ANEXAR MAPAS DE APLICAÇÃO
           ========================================== */}
        {step === 5 && (
          <div class="space-y-6">
            <div class="border-b border-slate-700 pb-2 flex items-center justify-between">
              <h3 class="text-lg font-bold">Mapas de Aplicação (DJI/Drone)</h3>
              <button
                type="button"
                onClick={addMap}
                class="flex items-center space-x-1 bg-primary-600/20 text-primary-400 border border-primary-500/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary-600 hover:text-white transition-all"
              >
                <Plus size={14} />
                <span>Adicionar Mapa</span>
              </button>
            </div>

            {maps.length === 0 ? (
              <div class="p-12 text-center border-2 border-dashed border-slate-700 rounded-2xl text-slate-400 space-y-3">
                <p>Nenhum mapa anexado ainda. Tire fotos ou busque imagens da galeria.</p>
                <button
                  type="button"
                  onClick={addMap}
                  class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs"
                >
                  Anexar Primeiro Mapa
                </button>
              </div>
            ) : (
              <div class="space-y-6">
                {maps.map((map, idx) => (
                  <div key={idx} class="bg-slate-900/40 border border-slate-700/60 p-5 rounded-2xl relative flex flex-col md:flex-row md:space-x-6 space-y-4 md:space-y-0">
                    <button
                      type="button"
                      onClick={() => removeMap(idx)}
                      class="absolute top-4 right-4 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>

                    <div class="flex flex-col items-center">
                      <div class="w-48 h-36 border border-slate-700 bg-slate-950 rounded-xl flex items-center justify-center overflow-hidden relative">
                        {map.photo_url ? (
                          <img src={map.photo_url} alt={`Mapa ${idx + 1}`} class="w-full h-full object-cover" />
                        ) : (
                          <span class="text-xs text-slate-600 font-bold">Carregar Imagem</span>
                        )}
                      </div>
                      <label class="mt-2.5 cursor-pointer flex items-center space-x-1.5 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold">
                        <Camera size={13} />
                        <span>Carregar Mapa</span>
                        <input
                          type="file"
                          accept="image/*"
                          class="hidden"
                          onChange={(e) => handlePhotoUpload(e.target.files[0], (url) => updateMapField(idx, 'photo_url', url))}
                        />
                      </label>
                    </div>

                    <div class="flex-1">
                      <label class="block text-slate-400 text-xs font-bold mb-1.5">Descrição do Voo / Área</label>
                      <textarea
                        value={map.description}
                        onChange={(e) => updateMapField(idx, 'description', e.target.value)}
                        placeholder="Ex: Talhão 1, Área Norte, aplicação dia 10/05/2026"
                        rows="3"
                        class="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                      ></textarea>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==========================================
           PASSO 6: FECHAMENTO & VALORES
           ========================================== */}
        {step === 6 && (
          <div class="space-y-6">
            <div class="border-b border-slate-700 pb-2 flex items-center space-x-2">
              <DollarSign class="text-primary-500" size={20} />
              <h3 class="text-lg font-bold">Dados Bancários & Valor Total</h3>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label class="block text-slate-300 text-xs font-bold mb-1.5">Área Aplicada (ha)</label>
                <input
                  type="text"
                  readOnly
                  value={`${totalArea} ha`}
                  class="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-slate-400 font-black text-sm"
                />
              </div>
              <div>
                <label class="block text-slate-300 text-xs font-bold mb-1.5">Valor do Hectare (R$/ha)</label>
                <input
                  type="number"
                  value={pricePerHa}
                  onChange={(e) => setPricePerHa(parseFloat(e.target.value) || 0)}
                  class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
                />
              </div>
              <div>
                <label class="block text-slate-300 text-xs font-bold mb-1.5">Valor Total Cobrado</label>
                <input
                  type="text"
                  readOnly
                  value={totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  class="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-emerald-400 font-black text-sm"
                />
              </div>
            </div>

            {/* Dados Bancários para Revisão */}
            <div class="bg-slate-900/50 border border-slate-700/60 p-5 rounded-2xl space-y-3">
              <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Dados Bancários preenchidos</h4>
              <div class="text-sm font-semibold text-slate-300 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>Banco: <span class="text-slate-100">{bankInfo.bank_name || 'Não cadastrado'}</span></div>
                <div>Agência: <span class="text-slate-100">{bankInfo.bank_agency || 'Não cadastrado'}</span></div>
                <div>Conta: <span class="text-slate-100">{bankInfo.bank_account || 'Não cadastrado'}</span></div>
                <div>Titular: <span class="text-slate-100">{bankInfo.bank_owner || 'Não cadastrado'}</span></div>
                <div class="md:col-span-2">Chave PIX / CPF: <span class="text-slate-100">{bankInfo.bank_cpf_pix || 'Não cadastrado'}</span></div>
              </div>
              <div class="text-[10px] text-slate-500 mt-1">
                * Caso precise alterar esses dados bancários permanentes, solicite ao Administrador da Empresa em seu painel.
              </div>
            </div>

            <div>
              <label class="block text-slate-300 text-xs font-bold mb-1.5">Observações Finais / Adiamentos</label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Ex: Aplicação suspensa devido a rajadas de vento acima do limite seguro, retomada no dia seguinte."
                rows="4"
                class="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary-500 transition-all font-medium text-sm"
              ></textarea>
            </div>
          </div>
        )}

        {/* Botoes de Navegação */}
        <div class="flex items-center justify-between mt-8 pt-6 border-t border-slate-700/60">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
            class="flex items-center space-x-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft size={16} />
            <span>Voltar</span>
          </button>

          {step < 6 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              class="flex items-center space-x-1.5 bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md"
            >
              <span>Avançar</span>
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveReport}
              class="flex items-center space-x-1.5 bg-gradient-to-r from-primary-600 to-emerald-500 hover:from-primary-500 hover:to-emerald-400 text-white px-6 py-3 rounded-xl font-extrabold text-sm shadow-lg transition-all"
            >
              <Save size={16} />
              <span>Salvar e Finalizar</span>
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
