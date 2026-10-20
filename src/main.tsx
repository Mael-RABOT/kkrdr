import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from './i18n';
import { SessionProvider } from './session';
import App from './App';
import UpdatePrompt from './components/UpdatePrompt';
import '@fontsource-variable/nunito';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <SessionProvider>
          <App />
          <UpdatePrompt />
        </SessionProvider>
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
);
