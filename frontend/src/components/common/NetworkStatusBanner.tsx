import React, { useState, useEffect } from 'react';
import { WifiOff, AlertCircle } from 'lucide-react';
import './NetworkStatusBanner.css';

export const NetworkStatusBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(() => {
    return typeof window !== 'undefined' && typeof window.navigator !== 'undefined'
      ? !window.navigator.onLine
      : false;
  });

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="network-status-banner animate-slide-down" role="alert">
      <div className="network-status-content">
        <WifiOff size={16} className="network-status-icon" />
        <span className="network-status-text">
          <strong>Network connection unavailable.</strong> You are currently offline. Actions and changes cannot be saved until connectivity is restored.
        </span>
      </div>
    </div>
  );
};
