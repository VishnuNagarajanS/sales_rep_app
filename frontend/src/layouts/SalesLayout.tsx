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

        {/* Global Broadcast Announcement Banner (from Super Admin) */}
        {(() => {
          try {
            const raw = localStorage.getItem('nexus_admin_announcements');
            const anns = raw ? JSON.parse(raw) : [];
            const active = anns.find((a: any) => a.isActive);
            if (!active) return null;
            return (
              <div className={`platform-broadcast-banner priority-${active.priority}`}>
                <span>📢 <strong>{active.title}:</strong> {active.message}</span>
              </div>
            );
          } catch {
            return null;
          }
        })()}

        {/* Support Impersonation Mode Banner (Super Admin "View as Company") */}
        {sessionStorage.getItem('nexus_support_mode_active') === 'true' && (
          <div className="support-impersonation-banner">
            <div className="support-banner-left">
              <span className="support-badge">👁️ SUPPORT MODE</span>
              <span>
                Viewing <strong>{sessionStorage.getItem('nexus_support_company_name') || 'Organization'}</strong> as Platform Super Admin (Read-Only Inspection Mode)
              </span>
            </div>
            <button
              className="btn btn-secondary btn-xs btn-exit-support"
              onClick={() => {
                sessionStorage.removeItem('nexus_support_mode_active');
                sessionStorage.removeItem('nexus_support_company_name');
                const rawUsers = localStorage.getItem('nexus_users');
                const users = rawUsers ? JSON.parse(rawUsers) : [];
                const superUser = users.find((u: any) => u.role?.code === 'super_admin');
                if (superUser) {
                  sessionStorage.setItem('nexus_current_user', JSON.stringify(superUser));
                  sessionStorage.removeItem('nexus_current_tenant');
                  window.dispatchEvent(new Event('nexus_storage_updated'));
                  window.location.reload();
                } else {
                  window.location.reload();
                }
              }}
            >
              Exit Support Mode &rarr;
            </button>
          </div>
        )}

        {/* Dynamic Page Content */}
        <main
          className={`page-scrollable ${
            currentRoute === 'chat'
              ? 'page-chat-layout'
              : currentRoute === 'assigned-leads'
              ? 'page-static-layout'
              : ''
          }`}
        >
          {children}
        </main>
      </div>

      {/* Global Persistent Call Surfaces (Section 3.3 & 7.6) */}
      <IncomingCallPopup />
      <InCallBar />
      <DispositionModal />
    </div>
  );
};
