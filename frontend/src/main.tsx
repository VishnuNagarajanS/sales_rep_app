import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/shared/index.css';
import { AuthProvider } from './context/AuthContext';
import { NavigationGuardProvider } from './context/NavigationGuardContext';
import { CallProvider } from './context/CallContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { sanitizeStoredKycData } from './utils/kycStorage';

// Lazy-loaded code-split route bundles: isolates 2.5MB+ admin app from public customer KYC and reset-password portals
const App = lazy(() => import('./App.tsx'));
const CustomerKycApp = lazy(() =>
  import('./pages/CustomerKyc/CustomerKycApp').then(m => ({ default: m.CustomerKycApp }))
);
const ResetPasswordPage = lazy(() =>
  import('./pages/Auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage }))
);

// One-time sanitization of legacy sensitive KYC keys (O(1) runtime after initial run)
sanitizeStoredKycData();

const isCustomerKycRoute =
  /^\/kyc\/[^/]+/i.test(window.location.pathname) ||
  (window.location.pathname === '/kyc' && new URLSearchParams(window.location.search).has('token'));
const isResetPasswordRoute = /^\/reset-password/i.test(window.location.pathname);

// Sleek, zero-flicker loading fallback for chunk hydration
const LoadingFallback = () => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-primary, #090d16)',
      color: 'var(--text-primary, #f1f5f9)',
      fontFamily: 'var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      gap: '16px',
    }}
  >
    <div
      style={{
        width: '42px',
        height: '42px',
        border: '3px solid rgba(59, 130, 246, 0.18)',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    <span
      style={{
        fontSize: '13px',
        fontWeight: 500,
        letterSpacing: '0.04em',
        color: 'var(--text-secondary, #94a3b8)',
      }}
    >
      Loading Nexus...
    </span>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <Suspense fallback={<LoadingFallback />}>
            {isCustomerKycRoute ? (
              <CustomerKycApp />
            ) : isResetPasswordRoute ? (
              <ResetPasswordPage />
            ) : (
              <AuthProvider>
                <NavigationGuardProvider>
                  <CallProvider>
                    <App />
                  </CallProvider>
                </NavigationGuardProvider>
              </AuthProvider>
            )}
          </Suspense>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
