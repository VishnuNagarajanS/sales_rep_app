import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { superAdminService, isAnnouncementEligibleForUser } from '../services/superAdminService';
import { signalRService } from '../services/signalRService';
import { BroadcastAnnouncement } from '../types';
import { NetworkStatusBanner } from '../components/common/NetworkStatusBanner';
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
  const { user, tenant } = useAuth();
  const [announcements, setAnnouncements] = useState<BroadcastAnnouncement[]>([]);

  useEffect(() => {
    let isMounted = true;
    const userRole = user?.role?.code;
    const companyId = tenant?.id || user?.companyId;

    const loadAnnouncements = async () => {
      try {
        const live = await superAdminService.fetchActiveAnnouncementsFromApi(companyId, userRole);
        if (isMounted) {
          setAnnouncements(live || []);
        }
      } catch {
        if (isMounted) {
          const raw = localStorage.getItem('nexus_admin_announcements');
          const anns = raw ? JSON.parse(raw) : [];
          setAnnouncements(
            anns.filter(
              (a: any) =>
                a.isActive &&
                isAnnouncementEligibleForUser(a, userRole, companyId)
            )
          );
        }
      }
    };

    loadAnnouncements();

    const handleAnnouncementChange = (data: any) => {
      if (!isMounted) return;
      const action = data?.action || (data?.isActive === false ? 'deactivated' : 'activated');
      const ann: BroadcastAnnouncement | undefined = data?.announcement || (data?.title ? data : undefined);
      const annId = String(data?.announcementId || ann?.id || '');

      if (!annId && !ann) return;

      if (action === 'deleted' || action === 'deactivated') {
        setAnnouncements(prev => prev.filter(a => String(a.id) !== annId));
        return;
      }

      if (action === 'activated' || action === 'created') {
        if (!ann) {
          loadAnnouncements();
          return;
        }

        const isEligible = isAnnouncementEligibleForUser(ann, userRole, companyId);
        if (!isEligible || !ann.isActive) {
          setAnnouncements(prev => prev.filter(a => String(a.id) !== String(ann.id)));
          return;
        }

        setAnnouncements(prev => {
          const idx = prev.findIndex(a => String(a.id) === String(ann.id));
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = ann;
            return next;
          }
          return [ann, ...prev];
        });
      }
    };

    const unsubCreated = signalRService.on('AnnouncementCreated', handleAnnouncementChange);
    const unsubActivated = signalRService.on('AnnouncementActivated', handleAnnouncementChange);
    const unsubDeactivated = signalRService.on('AnnouncementDeactivated', handleAnnouncementChange);
    const unsubDeleted = signalRService.on('AnnouncementDeleted', handleAnnouncementChange);
    const unsubBroadcast = signalRService.on('AnnouncementBroadcast', (ann: any) => {
      handleAnnouncementChange({
        announcementId: ann?.id,
        action: ann?.isActive ? 'activated' : 'deactivated',
        announcement: ann,
      });
    });

    const unsubReconnected = signalRService.on('reconnected', () => {
      loadAnnouncements();
    });

    const handleAdminUpdated = () => loadAnnouncements();
    window.addEventListener('nexus_admin_updated', handleAdminUpdated);
    window.addEventListener('nexus_signalr_reconnected', handleAdminUpdated);

    return () => {
      isMounted = false;
      unsubCreated();
      unsubActivated();
      unsubDeactivated();
      unsubDeleted();
      unsubBroadcast();
      unsubReconnected();
      window.removeEventListener('nexus_admin_updated', handleAdminUpdated);
      window.removeEventListener('nexus_signalr_reconnected', handleAdminUpdated);
    };
  }, [user?.role?.code, tenant?.id, user?.companyId]);

  return (
    <div className={`app-container ${theme === 'dark' ? 'dark-theme' : ''}`}>
      <NetworkStatusBanner />
      {/* Dynamic Tenant-Aware Sidebar */}
      <Sidebar currentRoute={currentRoute} onNavigate={onNavigate} />

      {/* Main Content Area */}
      <div className="main-content-area">
        {/* Top Navigation Bar with Search, Call Toggle, New Menu */}
        <TopBar onNavigate={onNavigate} onOpenQuickCreate={onOpenQuickCreate} />

        {/* Global Broadcast Announcement Banner (from Super Admin) */}
        {(() => {
          const active = announcements.find(a => a.isActive) || announcements[0];
          if (!active) return null;
          return (
            <div className={`platform-broadcast-banner priority-${active.priority}`}>
              <span>📢<strong>{active.title}:</strong> {active.message}</span>
            </div>
          );
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
          className={`page-scrollable ${currentRoute === 'chat'
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
