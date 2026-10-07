import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/shared/index.css';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { NavigationGuardProvider } from './context/NavigationGuardContext';
import { CallProvider } from './context/CallContext';
import { ThemeProvider } from './context/ThemeContext';
import { CustomerKycApp } from './pages/CustomerKyc/CustomerKycApp';
import { ResetPasswordPage } from './pages/Auth/ResetPasswordPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { sanitizeStoredKycData } from './utils/kycStorage';

// Remove PAN/Aadhaar/bank numbers that older versions cached in localStorage.
sanitizeStoredKycData();

const isCustomerKycRoute = /^\/kyc\/[^/]+/i.test(window.location.pathname);
const isResetPasswordRoute = /^\/reset-password/i.test(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {isCustomerKycRoute ? (
        <CustomerKycApp />
      ) : isResetPasswordRoute ? (
        <ThemeProvider>
          <ResetPasswordPage />
        </ThemeProvider>
      ) : (
        <AuthProvider>
          <NavigationGuardProvider>
            <ThemeProvider>
              <CallProvider>
                <App />
              </CallProvider>
            </ThemeProvider>
          </NavigationGuardProvider>
        </AuthProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
);
