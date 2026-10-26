declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** GIPHY API key (developers.giphy.com), to search GIFs in the app. Optional: without it, links are pasted. */
  readonly VITE_GIPHY_API_KEY?: string;
}
