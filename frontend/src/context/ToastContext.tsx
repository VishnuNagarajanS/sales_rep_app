import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import './ToastContext.css';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Standalone global trigger that works anywhere without React hooks
export const toast = {
  show: (message: string, type: ToastType = 'info', duration = 3500) => {
    window.dispatchEvent(new CustomEvent('app_toast', { detail: { message, type, duration } }));
  },
  success: (message: string, duration = 3500) => {
    window.dispatchEvent(new CustomEvent('app_toast', { detail: { message, type: 'success', duration } }));
  },
  error: (message: string, duration = 4000) => {
    window.dispatchEvent(new CustomEvent('app_toast', { detail: { message, type: 'error', duration } }));
  },
  info: (message: string, duration = 3500) => {
    window.dispatchEvent(new CustomEvent('app_toast', { detail: { message, type: 'info', duration } }));
  },
  warning: (message: string, duration = 3500) => {
    window.dispatchEvent(new CustomEvent('app_toast', { detail: { message, type: 'warning', duration } }));
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: ToastItem = { id, message, type, duration };

    setToasts(prev => [...prev.slice(-4), item]); // Keep at most 5 toasts visible

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  useEffect(() => {
    const handleGlobalToast = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type?: ToastType; duration?: number }>;
      if (customEvent.detail && customEvent.detail.message) {
        addToast(
          customEvent.detail.message,
          customEvent.detail.type || 'info',
          customEvent.detail.duration || 3500
        );
      }
    };

    window.addEventListener('app_toast', handleGlobalToast);
    return () => window.removeEventListener('app_toast', handleGlobalToast);
  }, [addToast]);

  const value: ToastContextValue = {
    showToast: addToast,
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="app-toast-container" aria-live="polite" role="region">
        {toasts.map(t => (
          <div key={t.id} className={`app-toast-item app-toast-${t.type}`}>
            <div className="app-toast-icon">
              {t.type === 'success' && <CheckCircle2 size={18} color="#10b981" />}
              {t.type === 'error' && <AlertCircle size={18} color="#ef4444" />}
              {t.type === 'warning' && <AlertTriangle size={18} color="#f59e0b" />}
              {t.type === 'info' && <Info size={18} color="#3b82f6" />}
            </div>
            <div className="app-toast-message">{t.message}</div>
            <button
              type="button"
              className="app-toast-close"
              onClick={() => removeToast(t.id)}
              aria-label="Close notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: toast.show,
      success: toast.success,
      error: toast.error,
      info: toast.info,
      warning: toast.warning,
    };
  }
  return ctx;
};
