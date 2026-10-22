/** The app version, from package.json (injected at build time by vite.config.ts). */
export default function AppVersion() {
  return <span className="app-version">v{__APP_VERSION__}</span>;
}
