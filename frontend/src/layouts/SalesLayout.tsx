import React, { useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';
import { useTheme } from '../context/ThemeContext';
import {
  IncomingCallPopup,
  InCallBar,
  DispositionModal,
} from '../components/calling/CallCenterComponents';

interface SalesLayoutProps {
  currentRoute: string;
  onNavigate: (route: string, extraState?: any) => void;
  onOpenQuickCreate: (type: 'lead' | 'followup' | 'deal' | 'visit' | 'consultation') => void;
  children: React.ReactNode;
}

export const SalesLayout: React.FC<SalesLayoutProps> = ({
  currentRoute,
  onNavigate,
  onOpenQuickCreate,
  children,
}) => {
  const { theme } = useTheme();

  return (
    <div className={`app-container ${theme === 'dark' ? 'dark-theme' : ''}`}>
      {/* Dynamic Tenant-Aware Sidebar */}
      <Sidebar currentRoute={currentRoute} onNavigate={onNavigate} />

      {/* Main Content Area */}
      <div className="main-content-area">
        {/* Top Navigation Bar with Search, Call Toggle, New Menu */}
        <TopBar onNavigate={onNavigate} onOpenQuickCreate={onOpenQuickCreate} />

        {/* Dynamic Page Content */}
        <main className={`page-scrollable ${currentRoute === 'chat' ? 'page-chat-layout' : ''}`}>{children}</main>
      </div>

      {/* Global Persistent Call Surfaces (Section 3.3 & 7.6) */}
      <IncomingCallPopup />
      <InCallBar />
      <DispositionModal />
    </div>
  );
};
