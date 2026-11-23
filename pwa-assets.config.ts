// Icons for the PWA, generated from public/logo.svg by `npm run icons` (@vite-pwa/assets-generator).
// The output PNGs/ICO are committed under public/; re-run the script after changing the logo.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const accent = '#4f46e5'; // --color-accent in src/styles/tokens.css

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: accent } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: accent } },
  },
  images: ['public/logo.svg'],
});
