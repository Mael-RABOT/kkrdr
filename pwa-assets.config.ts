import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// poop.png is a full-bleed mark on a transparent background.
// Maskable and Apple icons get the app background and room for the platform's mask.
const background = { background: '#faf6f0', fit: 'contain' } as const;

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0.05 },
    maskable: { ...minimal2023Preset.maskable, padding: 0.3, resizeOptions: background },
    apple: { ...minimal2023Preset.apple, padding: 0.15, resizeOptions: background },
  },
  images: ['public/poop.png'],
});
