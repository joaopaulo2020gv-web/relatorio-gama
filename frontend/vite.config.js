import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Plugin para carimbar versão única e data de build no sw.js e version.json
function pwaVersionPlugin() {
  const buildTimestamp = Date.now().toString();
  return {
    name: 'pwa-version-stamp',
    closeBundle() {
      const swDistPath = path.resolve(__dirname, 'dist/sw.js');
      if (fs.existsSync(swDistPath)) {
        let content = fs.readFileSync(swDistPath, 'utf-8');
        content = content.replace(/__SW_VERSION__/g, buildTimestamp);
        fs.writeFileSync(swDistPath, content, 'utf-8');
        console.log(`[PWA Plugin] Service Worker carimbado com versão: ${buildTimestamp}`);
      }
      
      const versionDistPath = path.resolve(__dirname, 'dist/version.json');
      fs.writeFileSync(
        versionDistPath, 
        JSON.stringify({ 
          version: buildTimestamp, 
          builtAt: new Date().toISOString() 
        }, null, 2),
        'utf-8'
      );
      console.log(`[PWA Plugin] Arquivo version.json gerado em dist/`);
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), pwaVersionPlugin()],
  define: {
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});

