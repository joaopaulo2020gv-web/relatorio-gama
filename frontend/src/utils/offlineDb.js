const DB_NAME = 'AgroSkanOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'reports_drafts';

// Abre a conexão com o banco de dados IndexedDB
export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Erro ao abrir IndexedDB:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        console.log(`Object store "${STORE_NAME}" criada com sucesso.`);
      }
    };
  });
}

// Salva um rascunho de relatório
export async function saveDraft(draft) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Adiciona timestamp de criação local para controle
    const draftWithTime = {
      ...draft,
      savedAt: new Date().toISOString()
    };

    const request = store.add(draftWithTime);

    request.onsuccess = (event) => {
      console.log('Rascunho salvo offline com ID:', event.target.result);
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('Erro ao salvar rascunho offline:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Obtém todos os rascunhos salvos
export async function getDrafts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      resolve(event.target.result || []);
    };

    request.onerror = (event) => {
      console.error('Erro ao buscar rascunhos offline:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Remove um rascunho após a sincronização
export async function deleteDraft(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log('Rascunho offline removido com ID:', id);
      resolve();
    };

    request.onerror = (event) => {
      console.error('Erro ao remover rascunho offline:', event.target.error);
      reject(event.target.error);
    };
  });
}
