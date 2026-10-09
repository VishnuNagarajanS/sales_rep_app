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

import { useAuth } from '../context/AuthContext';
import { workHandoverService, WorkHandoverDto } from '../services/workHandoverService';
import { Modal } from '../components/common/Modal';
import { AiAssistant } from '../components/ai/AiAssistant';

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
  const [coveredHandover, setCoveredHandover] = useState<WorkHandoverDto | null>(null);
  const [coveringHandover, setCoveringHandover] = useState<WorkHandoverDto | null>(null);
  const [recentlyEnded, setRecentlyEnded] = useState<WorkHandoverDto | null>(null);
  const [showEndedPanel, setShowEndedPanel] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    const checkHandovers = async () => {
      try {
        const status = await workHandoverService.getMyStatus();
        if (!status || !isMounted) return;
        if (isMounted) {
          setCoveredHandover(status.activeCoverage || null);
          setCoveringHandover(status.activeCovering || null);
          
          if (status.recentlyEnded) {
            const dismissed = localStorage.getItem(`nexus_handover_dismissed_${status.recentlyEnded.id}`);
            if (!dismissed) {
              setRecentlyEnded(status.recentlyEnded);
              setShowEndedPanel(true);
            }
          }
        }
      } catch {
        // quiet fallback
      }
    };
    checkHandovers();
    window.addEventListener('nexus_handover_updated', checkHandovers);
    return () => {
      isMounted = false;
      window.removeEventListener('nexus_handover_updated', checkHandovers);
    };
  }, [user?.id]);

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
      <div className={`main-content-area ${currentRoute === 'smarty-ai' ? 'smarty-ai-route' : ''}`}>
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

        {/* Covered User Banner */}
        {coveredHandover && (
          <div
            style={{
              background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
              borderBottom: '1px solid rgba(99, 102, 241, 0.35)',
              padding: '10px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>🏖️</span>
              <span>
                <strong>Temporary Work Coverage Active:</strong> Your open records are currently being managed by{' '}
                <strong style={{ color: 'var(--brand-primary, #6366f1)' }}>{coveredHandover.coveringUserName}</strong> since{' '}
                {new Date(coveredHandover.startedAt).toLocaleDateString()}
                {coveredHandover.plannedEndAt ? ` · Planned return: ${new Date(coveredHandover.plannedEndAt).toLocaleDateString()}` : ''}.
              </span>
            </div>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 12,
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
                fontWeight: 600,
              }}
            >
              Coverage Active
            </span>
          </div>
        )}

        {/* Covering Peer Banner */}
        {coveringHandover && (
          <div
            style={{
              background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)',
              borderBottom: '1px solid rgba(16, 185, 129, 0.35)',
              padding: '10px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>🤝</span>
              <span>
                <strong>Covering Active:</strong> You are temporarily covering open records for{' '}
                <strong style={{ color: '#10b981' }}>{coveringHandover.originalUserName}</strong>. Actions you perform will be tracked for return.
              </span>
            </div>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 12,
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                fontWeight: 600,
              }}
            >
              Covering Mode
            </span>
          </div>
        )}

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
            currentRoute === 'chat' || currentRoute === 'smarty-ai'
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

      {/* Return Summary Panel */}
      {showEndedPanel && recentlyEnded && (
        <Modal
          isOpen={showEndedPanel}
          onClose={() => setShowEndedPanel(false)}
          title="Updated while you were away"
          size="md"
        >
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Welcome back! Your work coverage by <strong>{recentlyEnded.coveringUserName}</strong> has ended.
              Here is what happened while you were away:
            </p>

            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Calls Connected:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{recentlyEnded.progress?.callsMadeCount || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Follow-ups Completed:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{recentlyEnded.progress?.followupsCompletedCount || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Records Converted/Closed:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{recentlyEnded.progress?.recordsConvertedOrClosedCount || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>New Records Created:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{recentlyEnded.progress?.newRecordsCreatedCount || 0}</strong>
              </div>
            </div>

            {recentlyEnded.progress?.highlights && recentlyEnded.progress.highlights.length > 0 && (
              <div>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>Highlights:</strong>
                <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {recentlyEnded.progress.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  localStorage.setItem(`nexus_handover_dismissed_${recentlyEnded.id}`, 'true');
                  setShowEndedPanel(false);
                }}
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </Modal>
      )}

      <AiAssistant />
    </div>
  );
};
