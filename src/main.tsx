import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { DialogsProvider } from './dialogs';
import { I18nProvider } from './i18n';
import { SessionProvider } from './session';
import { ThemeProvider } from './theme';
import App from './App';
import UpdatePrompt from './components/UpdatePrompt';
import '@fontsource-variable/nunito';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <DialogsProvider>
          <BrowserRouter>
            <SessionProvider>
              <App />
              <UpdatePrompt />
            </SessionProvider>
          </BrowserRouter>
        </DialogsProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
