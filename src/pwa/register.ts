// The only module that touches the PWA plugin's virtual module. Loaded lazily by serviceWorker.ts in
// production builds, so dev and tests (where the plugin is not active) never need to resolve it.
export { registerSW } from 'virtual:pwa-register';
