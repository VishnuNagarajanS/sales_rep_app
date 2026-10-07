import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';
import { superAdminService } from '../services/superAdminService';
import { signalRService } from '../services/signalRService';
import { BroadcastAnnouncement, SystemDiagnostics } from '../types';
import { NetworkStatusBanner } from '../components/common/NetworkStatusBanner';
import './AdminLayout.css';

interface AdminLayoutProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentRoute,
  onNavigate,
  children,
}) => {
  const [announcements, setAnnouncements] = useState<BroadcastAnnouncement[]>([]);
  const [maintenance, setMaintenance] = useState(() => superAdminService.getMaintenanceMode());
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);

  const loadBannerData = async () => {
    try {
      const liveMaint = await superAdminService.fetchMaintenanceModeFromApi();
      setMaintenance(liveMaint);
    } catch {
      setMaintenance(superAdminService.getMaintenanceMode());
    }

    try {
      const live = await superAdminService.fetchAnnouncementsFromApi();
      setAnnouncements(live);
    } catch {
      setAnnouncements(superAdminService.getAnnouncements());
    }

    try {
      const liveDiag = await superAdminService.fetchSystemDiagnosticsFromApi();
      setDiagnostics(liveDiag);
    } catch {
      setDiagnostics(null);
    }
  };

  useEffect(() => {
    loadBannerData();

    const handleAnnouncementChange = (data: any) => {
      const action = data?.action || (data?.isActive === false ? 'deactivated' : 'activated');
      const ann: BroadcastAnnouncement | undefined = data?.announcement || (data?.title ? data : undefined);
      const annId = String(data?.announcementId || ann?.id || '');

      if (!annId && !ann) return;

      if (action === 'deleted') {
        setAnnouncements(prev => prev.filter(a => String(a.id) !== annId));
        return;
      }

      if (action === 'deactivated') {
        setAnnouncements(prev => prev.map(a => String(a.id) === annId ? { ...a, isActive: false } : a));
        return;
      }

      if (action === 'activated' || action === 'created') {
        if (!ann) {
          loadBannerData();
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
      loadBannerData();
    });

    window.addEventListener('nexus_admin_updated', loadBannerData);
    window.addEventListener('nexus_signalr_reconnected', loadBannerData);

    return () => {
      unsubCreated();
      unsubActivated();
      unsubDeactivated();
      unsubDeleted();
      unsubBroadcast();
      unsubReconnected();
      window.removeEventListener('nexus_admin_updated', loadBannerData);
      window.removeEventListener('nexus_signalr_reconnected', loadBannerData);
    };
  }, []);

  const activeAnnouncement = announcements.find(a => a.isActive);

  return (
    <div className="app-container admin-theme">
      <NetworkStatusBanner />
      {/* Super Admin Dark Console Sidebar */}
      <Sidebar currentRoute={currentRoute} onNavigate={onNavigate} />

      {/* Main Content Area */}
      <div className="main-content-area admin-layout-main">
        <TopBar onNavigate={onNavigate} onOpenQuickCreate={() => { }} />

        {/* Global Environment Banner */}
        <div className="admin-platform-banner">
          <span>⚡</span>
          <div className="admin-status-cluster">
            {maintenance.enabled && (
              <span className="maintenance-active-tag">● MAINTENANCE LOCK ACTIVE</span>
            )}
            {diagnostics && (
              <span className="admin-platform-status">
                System Health: {typeof diagnostics.systemUptimePercentage === 'number'
                  ? `${diagnostics.systemUptimePercentage}%`
                  : diagnostics.apiStatus}
              </span>
            )}
          </div>
        </div>

        {/* Global Broadcast Announcement Banner (if active) */}
        {activeAnnouncement && (
          <div className={`platform-broadcast-banner priority-${activeAnnouncement.priority}`}>
            <span>📢 <strong>{activeAnnouncement.title}:</strong> {activeAnnouncement.message}</span>
            <button
              className="btn btn-ghost btn-xs text-white"
              onClick={() => onNavigate('admin-system')}
            >
              Manage &rarr;
            </button>
          </div>
        )}

        <main className="page-scrollable">{children}</main>
      </div>
    </div>
  );
};
