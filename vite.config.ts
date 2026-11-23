import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { projectHqApi } from './server/vite-plugin.mjs';

/** Content-Security-Policy for the production build (not used in dev, where Vite needs inline scripts). */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "connect-src 'self' https://api.github.com",
  "frame-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspMeta(): Plugin {
  return {
    name: 'project-hq-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  };
}

/**
 * Installable PWA. The service worker precaches the app shell only: the local API (`/api/*`) and
 * api.github.com are never cached or intercepted (no runtime caching, navigations to /api are excluded).
 * Registration happens from bundled code (src/pwa), so it satisfies the CSP above without inline scripts.
 */
function pwa() {
  return VitePWA({
    registerType: 'prompt',
    injectRegister: false,
    includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
    manifest: {
      name: 'Project HQ',
      short_name: 'HQ',
      description: 'Notes, roadmap, store listings and quick links for your side projects.',
      start_url: './',
      scope: './',
      display: 'standalone',
      lang: 'tr',
      theme_color: '#ffffff', // --color-bg (light)
      background_color: '#ffffff',
      icons: [
        { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
      navigateFallback: 'index.html',
      navigateFallbackDenylist: [/\/api(\/|$)/],
      cleanupOutdatedCaches: true,
    },
    devOptions: { enabled: false },
  });
}

export default defineConfig({
  base: './',
  plugins: [react(), projectHqApi(), cspMeta(), pwa()],
  // No CORS: Vite's default allows any localhost origin on any port to read responses, including /api.
  server: { host: '127.0.0.1', cors: false },
  preview: { host: '127.0.0.1', cors: false },
});
