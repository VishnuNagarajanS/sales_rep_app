import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  PhoneCall,
  History,
  Kanban,
  Briefcase,
  CalendarCheck,
  MapPin,
  Grid,
  Calendar,
  CheckCircle,
  TrendingUp,
  BarChart3,
  Bell,
  Settings,
  Shield,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  XCircle,
  Trash2,
  MessageSquare,
  User as UserIcon,
  UserCheck,
  Server,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getFollowups } from '../../services/ghlApiService';
import { FEATURES } from '../../constants/features';
import { PERMISSIONS } from '../../constants/permissions';
import './Sidebar.css';

interface SidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  feature?: string;
  permission?: string;
  badge?: string | number;
}

interface NavSection {
  header?: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentRoute, onNavigate }) => {
  const { isSuperAdmin, tenant, enabledFeatures, permissions, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isCollapseHovered, setIsCollapseHovered] = useState(false);

  const roleCode = user?.role?.code;
  const isGhlAdmin =
    !isSuperAdmin &&
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
    (roleCode === 'company_admin' || (roleCode as string) === 'admin');
  const isGhlSalesExec = tenant?.slug === 'ghl' && user?.role?.code === 'sales_executive';
  const isIrm = user?.role?.code === 'irm';
  const isGhlIrm = (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01' || tenant?.name === 'GHL India Ventures' || user?.companySlug === 'ghl' || user?.companyName === 'GHL India Ventures') && isIrm;

  const [pendingFollowupsCount, setPendingFollowupsCount] = useState(0);

  useEffect(() => {
    if (!isGhlSalesExec || !tenant?.id) {
      setPendingFollowupsCount(0);
      return;
    }
    let mounted = true;
    const updateFollowups = () => {
      getFollowups(tenant.id)
        .then(followups => {
          if (mounted) {
            const count = (followups || []).filter(
              f => f.status === 'Pending' && (f.assignedAgentId === user?.id || f.assignedAgentName === user?.name)
            ).length;
            setPendingFollowupsCount(count);
          }
        })
        .catch(() => {});
    };
    updateFollowups();
    window.addEventListener('nexus_storage_updated', updateFollowups);
    return () => {
      mounted = false;
      window.removeEventListener('nexus_storage_updated', updateFollowups);
    };
  }, [tenant?.id, isGhlSalesExec, user?.id, user?.name]);

  const companyId = (user?.companyId as string | undefined) ?? tenant?.id ?? '';
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    const updateUnread = () => {
      if (!companyId) {
        setUnreadChatCount(0);
        return;
      }
      try {
        const raw = localStorage.getItem('nexus_chat_conversations');
        const all = raw ? JSON.parse(raw) : [];
        const filtered = all.filter((c: any) => c.companyId === companyId);
        const count = filtered.reduce((acc: number, c: any) => acc + (c.unreadCount || 0), 0);
        setUnreadChatCount(count);
      } catch {
        setUnreadChatCount(0);
      }
    };

    updateUnread();
    window.addEventListener('nexus_chat_updated', updateUnread);
    return () => window.removeEventListener('nexus_chat_updated', updateUnread);
  }, [companyId]);

  // Super Admin Navigation Map (Section 4.1)
  const superAdminSections: NavSection[] = [
    {
      items: [
        { id: 'admin-dashboard', label: 'Platform Console', icon: <LayoutDashboard size={18} /> },
        { id: 'admin-companies', label: 'Companies (Tenants)', icon: <Building2 size={18} /> },
        { id: 'admin-users', label: 'Cross-Tenant Users', icon: <Users size={18} /> },
        { id: 'admin-roles', label: 'Roles & Matrix', icon: <Shield size={18} /> },
        { id: 'admin-features', label: 'Feature Packages', icon: <Sparkles size={18} /> },
        { id: 'admin-call-config', label: 'Call Configuration', icon: <PhoneCall size={18} /> },
        { id: 'admin-audit', label: 'Platform Audit Logs', icon: <FileCheck size={18} /> },
        { id: 'admin-system', label: 'System & Health', icon: <Server size={18} /> },
      ],
    },
  ];

  // Company User Navigation Map (Section 4.2)
  const companySections: NavSection[] = [
    {
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      ],
    },
    {
      header: 'Sales',
      items: [
        { id: 'leads', label: 'Leads', icon: <Users size={18} />, feature: FEATURES.LEADS, permission: PERMISSIONS.LEADS_VIEW },
        ...(isGhlAdmin ? [{ id: 'assigned-leads', label: 'Assigned Leads', icon: <UserCheck size={18} />, feature: FEATURES.LEADS, permission: PERMISSIONS.LEADS_VIEW }] : []),
        { id: 'customers', label: 'Customers 360', icon: <Building2 size={18} />, feature: FEATURES.CUSTOMERS, permission: PERMISSIONS.CUSTOMERS_VIEW },
        { id: 'pipeline', label: 'Pipeline', icon: <Kanban size={18} />, feature: FEATURES.DEALS, permission: PERMISSIONS.DEALS_VIEW },
        { id: 'deals', label: 'Deals', icon: <Briefcase size={18} />, feature: FEATURES.DEALS, permission: PERMISSIONS.DEALS_VIEW },
        { id: 'followups', label: 'Follow-ups', icon: <CalendarCheck size={18} />, feature: FEATURES.FOLLOWUPS, permission: PERMISSIONS.FOLLOWUPS_VIEW },
      ],
    },
    {
      header: 'Calling',
      items: [
        { id: 'call-center', label: 'Call Center', icon: <PhoneCall size={18} />, feature: FEATURES.CALLS, permission: PERMISSIONS.CALLS_MAKE },
        { id: 'call-history', label: 'Call History', icon: <History size={18} />, feature: FEATURES.CALLS, permission: PERMISSIONS.CALLS_VIEW },
        { id: 'call-settings', label: 'Call Settings', icon: <PhoneCall size={18} />, feature: FEATURES.CALLS, permission: PERMISSIONS.CALLS_VIEW },
      ],
    },
    {
      header: 'Operations', // Jamin specific
      items: [
        { id: 'projects', label: 'Projects', icon: <MapPin size={18} />, feature: FEATURES.PROPERTIES, permission: PERMISSIONS.PROPERTIES_VIEW },
        { id: 'plots', label: 'Plot Inventory', icon: <Grid size={18} />, feature: FEATURES.PROPERTIES, permission: PERMISSIONS.PROPERTIES_VIEW },
        { id: 'site-visits', label: 'Site Visits', icon: <Calendar size={18} />, feature: FEATURES.SITE_VISITS, permission: PERMISSIONS.SITE_VISITS_VIEW },
        { id: 'bookings', label: 'Bookings', icon: <CheckCircle size={18} />, feature: FEATURES.BOOKINGS, permission: PERMISSIONS.BOOKINGS_VIEW },
      ],
    },
    {
      header: 'Investors', // GHL specific
      items: [
        { id: 'investors', label: 'Investors 360', icon: <TrendingUp size={18} />, feature: FEATURES.INVESTORS, permission: PERMISSIONS.INVESTORS_VIEW },
        { id: 'consultations', label: 'Consultations', icon: <Calendar size={18} />, feature: FEATURES.CONSULTATIONS, permission: PERMISSIONS.CONSULTATIONS_VIEW },
        { id: 'opportunities', label: 'Opportunities', icon: <Briefcase size={18} />, feature: FEATURES.INVESTMENT_OPPORTUNITIES, permission: PERMISSIONS.OPPORTUNITIES_VIEW },
      ],
    },
    {
      header: 'Analytics',
      items: [
        { id: 'reports', label: 'Reports', icon: <BarChart3 size={18} />, feature: FEATURES.REPORTS, permission: PERMISSIONS.REPORTS_VIEW },
        { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
      ],
    },
    {
      header: 'Administration',
      items: [
        { id: 'company-users', label: 'Users', icon: <Users size={18} />, feature: FEATURES.USERS, permission: PERMISSIONS.USERS_VIEW },
        { id: 'company-settings', label: 'Company Settings', icon: <Settings size={18} />, feature: FEATURES.COMPANY_SETTINGS, permission: PERMISSIONS.SETTINGS_VIEW },
        { id: 'company-audit', label: 'Audit Logs', icon: <FileCheck size={18} />, feature: FEATURES.AUDIT_LOGS, permission: PERMISSIONS.AUDIT_VIEW },
      ],
    },
    {
      header: 'Help and Support',
      items: [
        { id: 'chat', label: 'Chat', icon: <MessageSquare size={18} />, badge: unreadChatCount > 0 ? unreadChatCount : undefined },
      ],
    },
  ];

  const ghlSalesExecSections: NavSection[] = [
    {
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      ],
    },
    {
      header: 'Sales',
      items: [
        { id: 'leads', label: 'Leads', icon: <Users size={18} />, feature: FEATURES.LEADS, permission: PERMISSIONS.LEADS_VIEW },
        ...(isGhlAdmin ? [{ id: 'assigned-leads', label: 'Assigned Leads', icon: <UserCheck size={18} />, feature: FEATURES.LEADS, permission: PERMISSIONS.LEADS_VIEW }] : []),
        { id: 'followups', label: 'Follow-ups', icon: <CalendarCheck size={18} />, feature: FEATURES.FOLLOWUPS, permission: PERMISSIONS.FOLLOWUPS_VIEW },
        { id: 'consultations', label: 'Consultations', icon: <Calendar size={18} />, feature: FEATURES.CONSULTATIONS, permission: PERMISSIONS.CONSULTATIONS_VIEW },
        { id: 'customers', label: 'Customers 360', icon: <Building2 size={18} />, feature: FEATURES.CUSTOMERS, permission: PERMISSIONS.CUSTOMERS_VIEW },
        { id: 'not-interested', label: 'Not - Interested', icon: <XCircle size={18} /> },
        { id: 'junk', label: 'Junk', icon: <Trash2 size={18} /> },
      ],
    },
    {
      header: 'Calling',
      items: [
        { id: 'call-center', label: 'Call Center', icon: <PhoneCall size={18} />, feature: FEATURES.CALLS, permission: PERMISSIONS.CALLS_MAKE },
        { id: 'call-history', label: 'Call History', icon: <History size={18} />, feature: FEATURES.CALLS, permission: PERMISSIONS.CALLS_VIEW },
      ],
    },
    {
      header: 'Analytics',
      items: [
        { id: 'reports', label: 'Reports', icon: <BarChart3 size={18} />, feature: FEATURES.REPORTS, permission: PERMISSIONS.REPORTS_VIEW },
        { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
      ],
    },
    {
      header: 'Help and Support',
      items: [
        { id: 'chat', label: 'Chat', icon: <MessageSquare size={18} />, badge: unreadChatCount > 0 ? unreadChatCount : undefined },
        { id: 'smarty-ai', label: 'Smarty AI', icon: <Sparkles size={18} /> },
      ],
    },
    {
      header: 'Settings',
      items: [
        { id: 'call-settings', label: 'Call Settings', icon: <PhoneCall size={18} />, feature: FEATURES.CALLS, permission: PERMISSIONS.CALLS_VIEW },
        { id: 'profile', label: 'Profile', icon: <UserIcon size={18} /> },
      ],
    },
  ];

  // Investor Relationship Manager (IRM) Navigation Map
  const irmSections: NavSection[] = [
    {
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      ],
    },
    {
      header: 'Investors',
      items: [
        { id: 'leads', label: 'My Leads', icon: <Users size={18} />, feature: FEATURES.LEADS, permission: PERMISSIONS.LEADS_VIEW },
        { id: 'followups', label: 'Follow-up', icon: <CalendarCheck size={18} />, feature: FEATURES.FOLLOWUPS, permission: PERMISSIONS.FOLLOWUPS_VIEW },
        { id: 'kyc', label: 'KYC', icon: <FileCheck size={18} />, feature: FEATURES.INVESTORS, permission: PERMISSIONS.INVESTORS_VIEW },
        { id: 'opportunities', label: 'Opportunities', icon: <Briefcase size={18} />, feature: FEATURES.INVESTMENT_OPPORTUNITIES, permission: PERMISSIONS.OPPORTUNITIES_VIEW },
        { id: 'investors', label: 'Investor 360', icon: <TrendingUp size={18} />, feature: FEATURES.INVESTORS, permission: PERMISSIONS.INVESTORS_VIEW },
        ...(isGhlIrm ? [{ id: 'pipeline', label: 'Pipeline', icon: <Kanban size={18} />, feature: FEATURES.DEALS, permission: PERMISSIONS.DEALS_VIEW }] : []),
      ],
    },
    {
      header: 'Calling',
      items: [
        { id: 'call-center', label: 'Call Center', icon: <PhoneCall size={18} />, feature: FEATURES.CALLS, permission: PERMISSIONS.CALLS_MAKE },
        { id: 'call-history', label: 'Call History', icon: <History size={18} />, feature: FEATURES.CALLS, permission: PERMISSIONS.CALLS_VIEW },
      ],
    },
    {
      header: 'Analytics',
      items: [
        { id: 'reports', label: 'Reports', icon: <BarChart3 size={18} />, feature: FEATURES.REPORTS, permission: PERMISSIONS.REPORTS_VIEW },
        { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
      ],
    },
    {
      header: 'Help and Support',
      items: [
        { id: 'chat', label: 'Chat', icon: <MessageSquare size={18} />, badge: unreadChatCount > 0 ? unreadChatCount : undefined },
        { id: 'smarty-ai', label: 'Smarty AI', icon: <Sparkles size={18} /> },
      ],
    },
    {
      header: 'Settings',
      items: [
        { id: 'call-settings', label: 'Call Settings', icon: <PhoneCall size={18} />, feature: FEATURES.CALLS, permission: PERMISSIONS.CALLS_VIEW },
        { id: 'profile', label: 'Profile', icon: <UserIcon size={18} /> },
      ],
    },
  ];

  // Helper to filter items based on tenant-enabled features and user permissions
  const filterSection = (section: NavSection): NavItem[] => {
    return section.items.filter(item => {
      if (item.feature && !enabledFeatures.includes(item.feature)) return false;
      if (item.permission && !permissions.includes(item.permission)) {
        if (isIrm && (item.permission === PERMISSIONS.LEADS_VIEW || item.permission === PERMISSIONS.FOLLOWUPS_VIEW || item.permission === PERMISSIONS.DEALS_VIEW)) {
          return true;
        }
        return false;
      }
      return true;
    });
  };

  const sectionsToRender = isSuperAdmin
    ? superAdminSections
    : isIrm
      ? irmSections
      : isGhlSalesExec
        ? ghlSalesExecSections
        : companySections;

  return (
    <aside
      style={{
        width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        height: '100vh',
        backgroundColor: isSuperAdmin ? '#0b0f19' : 'var(--bg-surface)',
        borderRight: `1px solid ${isSuperAdmin ? '#1e293b' : 'var(--border-base)'}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--transition-normal)',
        position: 'relative',
        zIndex: 60,
        userSelect: 'none',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: 'var(--topbar-height)',
          backgroundColor: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed
            ? 'center'
            : isSuperAdmin
              ? 'space-between'
              : tenant?.slug === 'ghl'
                ? 'center'
                : 'space-between',
          padding: collapsed
            ? '0'
            : isSuperAdmin
              ? '0 20px'
              : tenant?.slug === 'ghl'
                ? '0 48px'
                : '0 20px',
          borderBottom: `1px solid ${isSuperAdmin ? '#1e293b' : 'var(--border-base)'}`,
          position: 'relative',
        }}
      >
        {collapsed ? (
          isSuperAdmin ? (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 12,
              }}
            >
              ⚡
            </div>
          ) : tenant?.slug === 'jamin' ? (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#e10600',
                boxShadow: '0 2px 8px rgba(225, 6, 0, 0.3)',
              }}
            >
              <img
                src="/jamin-icon.png"
                alt="Jamin Bazaar"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).src = '/jamin-logo.png';
                }}
              />
            </div>
          ) : tenant?.slug === 'ghl' ? (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 12,
                letterSpacing: '-0.02em',
                boxShadow: '0 2px 8px rgba(220,38,38,0.35)',
              }}
            >
              GHL
            </div>
          ) : (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${tenant?.brandColor || '#8b5cf6'} 0%, #1e1b4b 100%)`,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 12,
              }}
            >
              {tenant?.name?.charAt(0) || 'T'}
            </div>
          )
        ) : isSuperAdmin ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <div
              style={{
                width: 38,
                height: 38,
                minWidth: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 13,
              }}
            >
              ⚡
            </div>
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 15,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                }}
              >
                Platform Operator
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                }}
              >
                SUPER ADMIN CONSOLE
              </div>
            </div>
          </div>
        ) : tenant?.slug === 'jamin' ? (
          <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <img
              src="/jamin-logo.png"
              alt="Jamin Bazaar"
              style={{
                height: 38,
                maxWidth: 175,
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        ) : tenant?.slug === 'ghl' ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: '8px',
              boxSizing: 'border-box',
            }}
          >
            <img
              src="/og-image -GHL Ventures.png"
              alt="GHL India Ventures"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            {tenant?.logo ? (
              <img
                src={tenant.logo}
                alt={tenant.name}
                style={{ height: 38, maxWidth: 175, objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    minWidth: 36,
                    borderRadius: 10,
                    background: `linear-gradient(135deg, ${tenant?.brandColor || '#8b5cf6'} 0%, #1e1b4b 100%)`,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 14,
                  }}
                >
                  {tenant?.name?.charAt(0) || 'T'}
                </div>
                <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 14,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {tenant?.name}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: 600,
                    }}
                  >
                    {tenant?.tagline
                      ? tenant.tagline.length > 26
                        ? tenant.tagline.slice(0, 26) + '...'
                        : tenant.tagline
                      : 'Workspace'}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <button
          className="sidebar-collapse-btn"
          style={{
            color: isCollapseHovered ? '#ff0000' : isSuperAdmin ? '#94a3b8' : 'var(--text-muted)',
            flexShrink: 0,
            ...(tenant?.slug === 'ghl' && !collapsed
              ? {
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
              }
              : {}),
          }}
          onMouseEnter={() => setIsCollapseHovered(true)}
          onMouseLeave={() => setIsCollapseHovered(false)}
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight
              size={16}
              color={isCollapseHovered ? '#ff0000' : undefined}
              strokeWidth={isCollapseHovered ? 3 : 2}
            />
          ) : (
            <ChevronLeft
              size={16}
              color={isCollapseHovered ? '#ff0000' : undefined}
              strokeWidth={isCollapseHovered ? 3 : 2}
            />
          )}
        </button>
      </div>

      {/* Nav List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {sectionsToRender.map((sec, sIdx) => {
          const visibleItems = filterSection(sec);
          // Omit section headers if zero children are permitted/enabled (Section 4.2 rule)
          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {sec.header && !collapsed && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: isSuperAdmin ? '#64748b' : 'var(--text-muted)',
                    padding: '6px 12px 2px',
                  }}
                >
                  {sec.header}
                </div>
              )}

              {visibleItems.map(item => {
                const isActive = currentRoute === item.id;

                return (
                  <button
                    key={item.id}
                    className="btn btn-ghost"
                    style={{
                      width: '100%',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      padding: collapsed ? '10px 0' : '9px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isActive
                        ? isSuperAdmin
                          ? 'rgba(139, 92, 246, 0.18)'
                          : 'var(--primary-50)'
                        : 'transparent',
                      color: isActive
                        ? isSuperAdmin
                          ? '#c084fc'
                          : 'var(--primary-600)'
                        : isSuperAdmin
                          ? '#cbd5e1'
                          : 'var(--text-secondary)',
                      fontWeight: isActive ? 700 : 500,
                      border: isActive
                        ? isSuperAdmin
                          ? '1px solid rgba(139, 92, 246, 0.3)'
                          : '1px solid rgba(239, 68, 68, 0.25)'
                        : '1px solid transparent',
                    }}
                    title={collapsed ? item.label : undefined}
                    onClick={() => onNavigate(item.id)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                    {!collapsed && (
                      <span style={{ fontSize: 13, marginLeft: 12, display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'space-between' }}>
                        <span>{item.label}</span>
                        {item.badge !== undefined && (
                          <span
                            style={{
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 10,
                              lineHeight: 1,
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </aside>
  );
};