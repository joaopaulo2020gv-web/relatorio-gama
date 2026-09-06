/**
 * Módulo de Gerenciamento e Atualização Automática Contínua do PWA (AgroSkan)
 * 
 * Garante que:
 * 1. O app verifique atualizações ativamente ao iniciar, ao voltar do segundo plano e periodicamente.
 * 2. O novo Service Worker assuma o controle imediatamente (skipWaiting).
 * 3. A página recarregue de forma suave quando houver uma nova versão, sem exigir desinstalação.
 * 4. Falhas de importação dinâmica do Vite (chunks deletados pós-deploy) sejam recuperadas automaticamente.
 */

let swRegistration = null;
let isRefreshing = false;

export function initPwaAutoUpdate() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // 1. Tratamento para chunks do Vite que mudaram de hash após deploy
  setupViteChunkErrorRecovery();

  // 2. Escutar quando o Service Worker controlador for alterado (nova versão assumiu)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isRefreshing) return;
    isRefreshing = true;
    console.log('[PWA] Novo Service Worker assumiu o controle. Recarregando suavemente...');
    
    // Pequeno delay para garantir que caches antigos foram expurgados
    setTimeout(() => {
      window.location.reload();
    }, 400);
  });

  // 3. Registrar o Service Worker com updateViaCache: 'none'
  window.addEventListener('load', () => {
    registerServiceWorker();
  });

  // 4. Checar atualização sempre que o usuário voltar para o app (celular ou navegador)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForPwaUpdate();
    }
  });

  window.addEventListener('focus', () => {
    checkForPwaUpdate();
  });

  window.addEventListener('online', () => {
    checkForPwaUpdate();
  });

  // 5. Checagem periódica a cada 15 minutos em segundo plano
  setInterval(() => {
    checkForPwaUpdate();
  }, 15 * 60 * 1000);
}

async function registerServiceWorker() {
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {
      updateViaCache: 'none' // Não usar cache HTTP ao buscar atualizações do sw.js
    });

    swRegistration = reg;
    console.log('[PWA] Service Worker registrado com sucesso. Escopo:', reg.scope);

    // Se já tiver um worker em espera (waiting), força ele a ativar
    if (reg.waiting) {
      promptWorkerSkipWaiting(reg.waiting);
    }

    // Monitora novos workers que forem descobertos
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      console.log('[PWA] Nova versão encontrada! Instalando em segundo plano...');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          // Se já existe um controller, significa que é um UPDATE (não é a 1ª instalação)
          if (navigator.serviceWorker.controller) {
            console.log('[PWA] Nova versão instalada com sucesso. Ativando...');
            promptWorkerSkipWaiting(newWorker);
          }
        }
      });
    });

    // Realiza a 1ª checagem ativa
    checkForPwaUpdate();

  } catch (err) {
    console.error('[PWA] Erro ao registrar Service Worker:', err);
  }
}

function promptWorkerSkipWaiting(worker) {
  try {
    worker.postMessage({ type: 'SKIP_WAITING' });
  } catch (e) {
    console.warn('[PWA] Falha ao enviar SKIP_WAITING:', e);
  }
}

export async function checkForPwaUpdate() {
  if (!swRegistration) {
    if ('serviceWorker' in navigator) {
      swRegistration = await navigator.serviceWorker.getRegistration();
    }
  }

  if (swRegistration) {
    try {
      console.log('[PWA] Verificando se há atualizações no servidor...');
      await swRegistration.update();
      
      if (swRegistration.waiting) {
        promptWorkerSkipWaiting(swRegistration.waiting);
      }
    } catch (err) {
      console.warn('[PWA] Erro não-crítico ao checar atualização do SW:', err);
    }
  }

  // Verificação complementar rápida via version.json
  checkVersionJson();
}

async function checkVersionJson() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    if (res.ok) {
      const data = await res.json();
      const currentStoredVersion = localStorage.getItem('agroskan_installed_version');
      
      if (!currentStoredVersion) {
        localStorage.setItem('agroskan_installed_version', data.version);
      } else if (currentStoredVersion !== data.version) {
        console.log(`[PWA] Nova versão detectada (${data.version} vs ${currentStoredVersion}). Sincronizando...`);
        localStorage.setItem('agroskan_installed_version', data.version);
        if (swRegistration) {
          await swRegistration.update();
          if (swRegistration.waiting) {
            promptWorkerSkipWaiting(swRegistration.waiting);
          }
        }
      }
    }
  } catch (e) {
    // Silencioso se offline
  }
}

/**
 * Recuperação de erro de importação dinâmica do Vite:
 * Quando um novo build é feito, os arquivos .js antigos deixam de existir na VPS.
 * Se o usuário estava com a página aberta e clica numa rota que carrega um chunk antigo,
 * o Vite lança "Failed to fetch dynamically imported module".
 * Esse interceptor captura o erro e recarrega a página automaticamente para puxar os novos scripts.
 */
function setupViteChunkErrorRecovery() {
  const isChunkError = (message) => {
    return (
      message &&
      (message.includes('dynamically imported module') ||
       message.includes('Importing a module script failed') ||
       message.includes('Loading chunk') ||
       message.includes('Loading CSS chunk'))
    );
  };

  window.addEventListener('error', (event) => {
    if (isChunkError(event.message)) {
      handleChunkRecovery();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = typeof reason === 'string' ? reason : (reason?.message || '');
    if (isChunkError(msg)) {
      handleChunkRecovery();
    }
  });
}

function handleChunkRecovery() {
  const lastReload = sessionStorage.getItem('pwa_chunk_error_reload');
  const now = Date.now();
  // Evita loops de reload caso haja algum erro de rede real (limite de 1 reload a cada 10s)
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem('pwa_chunk_error_reload', now.toString());
    console.warn('[PWA] Detectado chunk desatualizado do Vite. Recarregando para nova versão...');
    window.location.reload();
  }
}
