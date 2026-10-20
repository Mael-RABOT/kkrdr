import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// icon.svg already has a full-bleed background with the mark inside the maskable safe zone,
// so no extra padding is added.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/icon.svg'],
});
