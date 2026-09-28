import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/shared/index.css';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { CallProvider } from './context/CallContext';
import { ThemeProvider } from './context/ThemeContext';
import { CustomerKycApp } from './pages/CustomerKyc/CustomerKycApp';

const isCustomerKycRoute = /^\/kyc\/[^/]+/i.test(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isCustomerKycRoute ? (
      <CustomerKycApp />
    ) : (
      <AuthProvider>
        <ThemeProvider>
          <CallProvider>
            <App />
          </CallProvider>
        </ThemeProvider>
      </AuthProvider>
    )}
  </StrictMode>,
);
