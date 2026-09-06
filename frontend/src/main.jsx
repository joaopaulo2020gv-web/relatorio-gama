import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { initPwaAutoUpdate } from './utils/pwaUpdate.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Inicializa o sistema de atualização automática contínua do PWA
initPwaAutoUpdate();

