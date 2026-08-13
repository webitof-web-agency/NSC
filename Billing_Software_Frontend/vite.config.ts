import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite'
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(({ mode }) => {
  const isElectronBuild = mode === 'electron';

  return {
    // Browser deploys need absolute asset paths so refresh on nested routes still loads JS/CSS.
    // Electron needs relative asset paths because it serves the app from file:// URLs.
    base: isElectronBuild ? './' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@assets': path.resolve(__dirname, 'src/assets'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@constants': path.resolve(__dirname, 'src/constants'),
        '@hooks': path.resolve(__dirname, 'src/hooks'),
        '@pages': path.resolve(__dirname, 'src/pages'),
        '@store': path.resolve(__dirname, 'src/store'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@models': path.resolve(__dirname, 'src/types'),
        '@context': path.resolve(__dirname, 'src/context'),
      },
    },
    server: {
      port: 3000,
    },
  };
});
