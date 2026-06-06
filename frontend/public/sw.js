const CACHE_NAME = 'agroskan-cache-v10';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Instalação do Service Worker e caching inicial
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Instalando Service Worker e cacheando estáticos essenciais');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Removendo cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia Network First com Fallback to Cache
self.addEventListener('fetch', event => {
  // Ignora requisições de API (que devem ir sempre para a rede) e de extensões
  if (event.request.url.includes('/api/') || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Se a resposta for válida, clona e atualiza no cache
        if (response && response.status === 200) {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseCopy);
          });
        }
        return response;
      })
      .catch(() => {
        // Se falhar a rede (offline), tenta recuperar do cache
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se for uma requisição de navegação (HTML), retorna o index do cache
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// ==========================================
// BACKGROUND SYNC & LOCAL NOTIFICATIONS
// ==========================================

// Função para abrir o IndexedDB do AgroSkan no Service Worker
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = self.indexedDB.open('AgroSkanOfflineDB', 1);
    request.onerror = event => reject(event.target.error);
    request.onsuccess = event => resolve(event.target.result);
  });
}

// Converte string Base64 para Blob para envio Multipart via FormData no Service Worker
function base64ToBlob(base64Data, contentType) {
  try {
    const parts = base64Data.split(';base64,');
    const mime = parts[0].split(':')[1] || contentType;
    const raw = atob(parts[1] || parts[0]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: mime });
  } catch (e) {
    console.error('Erro ao converter base64 para blob:', e);
    return null;
  }
}

// Executa upload de imagem em segundo plano
async function uploadPhotoBackground(base64Photo, token) {
  if (!base64Photo || !base64Photo.startsWith('data:image')) {
    return base64Photo; // Já é uma URL HTTP/HTTPS ou está vazia
  }
  
  const blob = base64ToBlob(base64Photo, 'image/jpeg');
  if (!blob) return '';

  const formData = new FormData();
  formData.append('photo', blob, `sync_photo_${Date.now()}.jpg`);

  try {
    const response = await fetch('/api/reports/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    if (response.ok) {
      const data = await response.json();
      return data.url;
    }
  } catch (err) {
    console.error('Erro ao subir foto em segundo plano:', err);
  }
  return base64Photo; // Retorna o original se falhar para tentar de novo
}

// Sincroniza todos os rascunhos de relatórios no background
async function syncReports() {
  try {
    const db = await openIndexedDB();
    
    // Ler rascunhos salvos
    const drafts = await new Promise((resolve, reject) => {
      const transaction = db.transaction(['reports_drafts'], 'readonly');
      const store = transaction.objectStore('reports_drafts');
      const request = store.getAll();
      request.onsuccess = event => resolve(event.target.result || []);
      request.onerror = event => reject(event.target.error);
    });

    if (drafts.length === 0) return;

    let syncedCount = 0;

    for (const draft of drafts) {
      // Se não tiver token salvo no IndexedDB, não temos como autenticar o POST
      if (!draft.token) continue;

      // 1. Fazer upload de fotos de pH se estiver em Base64
      if (draft.ph_photo_url && draft.ph_photo_url.startsWith('data:image')) {
        draft.ph_photo_url = await uploadPhotoBackground(draft.ph_photo_url, draft.token);
      }

      // 2. Fazer upload de fotos de mapas se estiverem em Base64
      if (draft.maps_data && draft.maps_data.length > 0) {
        for (let i = 0; i < draft.maps_data.length; i++) {
          if (draft.maps_data[i].photo_url && draft.maps_data[i].photo_url.startsWith('data:image')) {
            draft.maps_data[i].photo_url = await uploadPhotoBackground(draft.maps_data[i].photo_url, draft.token);
          }
        }
      }

      // 3. Montar o payload final do relatório
      const reportPayload = {
        client_name: draft.client_name,
        farm_name: draft.farm_name,
        client_email: draft.client_email,
        client_document: draft.client_document,
        farm_address: draft.farm_address,
        culture: draft.culture,
        report_date: draft.report_date,
        flights_data: draft.flights_data,
        weather_temp: draft.weather_temp,
        weather_humidity: draft.weather_humidity,
        weather_desc: draft.weather_desc,
        delta_t: draft.delta_t,
        weather_forecast: draft.weather_forecast,
        caldas_data: draft.caldas_data,
        ph_photo_url: draft.ph_photo_url,
        ph_desc: draft.ph_desc,
        maps_data: draft.maps_data,
        observations: draft.observations,
        total_area: draft.total_area,
        price_per_ha: draft.price_per_ha,
        total_price: draft.total_price,
        pilot_signature: draft.pilot_signature,
        client_signature: draft.client_signature
      };

      try {
        const response = await fetch('/api/reports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${draft.token}`
          },
          body: JSON.stringify(reportPayload)
        });

        if (response.ok) {
          // Remover o rascunho com sucesso do IndexedDB
          await new Promise((resolve, reject) => {
            const deleteTx = db.transaction(['reports_drafts'], 'readwrite');
            const deleteStore = deleteTx.objectStore('reports_drafts');
            const deleteReq = deleteStore.delete(draft.id);
            deleteReq.onsuccess = () => resolve();
            deleteReq.onerror = event => reject(event.target.error);
          });
          syncedCount++;
        }
      } catch (err) {
        console.error('Erro ao enviar relatório no sync em segundo plano:', err);
      }
    }

    if (syncedCount > 0) {
      // Disparar notificação local avisando do sucesso do sincronismo
      self.registration.showNotification('AgroSkan', {
        body: syncedCount === 1 
          ? '1 relatório pendente foi sincronizado com sucesso! 🚀' 
          : `${syncedCount} relatórios pendentes foram sincronizados com sucesso! 🚀`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [100, 50, 100],
        data: { url: '/' }
      });
    }

  } catch (err) {
    console.error('Falha geral na rotina de sync em segundo plano:', err);
  }
}

// Listener para o evento 'sync' (Background Sync API)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncReports());
  }
});

// Listener para o evento 'notificationclick' (Tratamento de cliques nas notificações)
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Se já houver uma aba aberta, foca nela
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não, abre uma nova janela
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
