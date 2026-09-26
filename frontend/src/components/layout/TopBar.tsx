import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  Plus,
  ChevronDown,
  LogOut,
  Sun,
  Moon,
  Download,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AgentAvailabilityToggle } from '../calling/CallCenterComponents';
import { PersonaSwitcher } from './PersonaSwitcher';
import { FEATURES } from '../../constants/features';
import { getLeads, getCustomers, getDeals, getInvestors } from '../../services/ghlApiService';
import { Lead, Customer, Deal, Investor, NotificationItem } from '../../types';
import './TopBar.css';

const getStoredNotifications = (tenantId?: string, userId?: string, roleCode?: string): NotificationItem[] => {
  try {
    const raw = localStorage.getItem('nexus_notifications');
    const all = raw ? JSON.parse(raw) : [];
    return all.filter((n: any) => {
      if (n.tenantId && tenantId && n.tenantId !== tenantId) return false;
      if (n.recipientUserId && userId && n.recipientUserId !== userId) return false;
      if (n.recipientRoleCode && roleCode && n.recipientRoleCode !== roleCode) return false;
      return true;
    });
  } catch {
    return [];
  }
};

const markAllStoredNotificationsRead = (tenantId?: string, userId?: string) => {
  try {
    const raw = localStorage.getItem('nexus_notifications');
    const all = raw ? JSON.parse(raw) : [];
    all.forEach((n: any) => {
      if ((!tenantId || n.tenantId === tenantId) && (!userId || n.recipientUserId === userId)) {
        n.read = true;
      }
    });
    localStorage.setItem('nexus_notifications', JSON.stringify(all));
    window.dispatchEvent(new Event('nexus_storage_updated'));
  } catch {}
};

const markStoredNotificationRead = (id: string) => {
  try {
    const raw = localStorage.getItem('nexus_notifications');
    const all = raw ? JSON.parse(raw) : [];
    const item = all.find((n: any) => n.id === id);
    if (item) item.read = true;
    localStorage.setItem('nexus_notifications', JSON.stringify(all));
    window.dispatchEvent(new Event('nexus_storage_updated'));
  } catch {}
};

interface TopBarProps {
  onNavigate: (route: string, extraState?: any) => void;
  onOpenQuickCreate: (type: 'lead' | 'followup' | 'deal' | 'visit' | 'consultation') => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onNavigate, onOpenQuickCreate }) => {
  const { user, tenant, isSuperAdmin, logout, enabledFeatures } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const roleCode = user?.role?.code;
  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
    (roleCode === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Notifications state
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(() =>
    getStoredNotifications(tenant?.id, user?.id, user?.role?.code)
  );

  // Quick New state
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);

  // User menu
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Search entities
  const [searchLeads, setSearchLeads] = useState<Lead[]>([]);
  const [searchCustomers, setSearchCustomers] = useState<Customer[]>([]);
  const [searchDeals, setSearchDeals] = useState<Deal[]>([]);
  const [searchInvestors, setSearchInvestors] = useState<Investor[]>([]);

  useEffect(() => {
    if (!tenant?.id) return;
    let mounted = true;
    const fetchSearchData = () => {
      if (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') {
        Promise.all([
          getLeads(tenant.id).catch(() => []),
          getCustomers(tenant.id).catch(() => []),
          getDeals(tenant.id).catch(() => []),
          getInvestors(tenant.id).catch(() => []),
        ]).then(([l, c, d, i]) => {
          if (mounted) {
            setSearchLeads(l || []);
            setSearchCustomers(c || []);
            setSearchDeals(d || []);
            setSearchInvestors(i || []);
          }
        });
      } else {
        try {
          setSearchLeads(JSON.parse(localStorage.getItem('nexus_leads') || '[]'));
          setSearchCustomers(JSON.parse(localStorage.getItem('nexus_customers') || '[]'));
          setSearchDeals(JSON.parse(localStorage.getItem('nexus_deals') || '[]'));
          setSearchInvestors(JSON.parse(localStorage.getItem('nexus_investors') || '[]'));
        } catch {}
      }
    };
    fetchSearchData();
    window.addEventListener('nexus_storage_updated', fetchSearchData);
    return () => {
      mounted = false;
      window.removeEventListener('nexus_storage_updated', fetchSearchData);
    };
  }, [tenant?.id, tenant?.slug]);

  // Sync notifications with tenant and user scoping
  useEffect(() => {
    const handleUpdate = () => {
      setNotifications(getStoredNotifications(tenant?.id, user?.id, user?.role?.code));
    };
    handleUpdate();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id, tenant?.slug, user?.id, user?.role?.code]);

  // Global search items
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();

    const leads = searchLeads.filter(l =>
      l.name.toLowerCase().includes(q) || l.phone.includes(q) || (l.email && l.email.toLowerCase().includes(q))
    );

    const customers = searchCustomers.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.email && c.email.toLowerCase().includes(q))
    );

    const deals = searchDeals.filter(d =>
      d.title.toLowerCase().includes(q) || (d.customerName && d.customerName.toLowerCase().includes(q))
    );

    const plots = enabledFeatures.includes(FEATURES.PROPERTIES)
      ? (JSON.parse(localStorage.getItem('nexus_plots') || '[]') as any[]).filter(p => p.plotNumber?.toLowerCase().includes(q))
      : [];

    const investors = enabledFeatures.includes(FEATURES.INVESTORS)
      ? searchInvestors.filter(i =>
        i.name.toLowerCase().includes(q) || i.phone.includes(q)
      )
      : [];

    const roleCode = user?.role?.code;
    const isExec = roleCode === 'sales_executive';
    const isIrm = roleCode === 'irm';
    const scopedLeads = isIrm
      ? []
      : isExec
      ? leads.filter(l => l.assignedAgentId === user?.id || l.assignedAgentName === user?.name)
      : leads;
    const scopedCustomers = isIrm
      ? []
      : isExec
      ? customers.filter(c => c.assignedAgentId === user?.id || c.assignedAgentName === user?.name)
      : customers;
    const scopedDeals = isIrm
      ? []
      : isExec
      ? deals.filter(d => d.assignedAgentId === user?.id || d.assignedAgentName === user?.name)
      : deals;
    const scopedInvestors = (isExec || isIrm)
      ? investors.filter(i => i.assignedAgentId === user?.id || i.assignedAgentName === user?.name)
      : investors;

    return { leads: scopedLeads, customers: scopedCustomers, deals: scopedDeals, plots: isIrm ? [] : plots, investors: scopedInvestors };
  }, [searchQuery, tenant?.id, enabledFeatures, user?.id, user?.name, user?.role?.code]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="topbar-header">
      {/* Hidden SVG Gradient definition for Red Gradient icon stroke */}
      <svg width="0" height="0" className="topbar-svg-def">
        <defs>
          <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
        </defs>
      </svg>
      {/* Left: Global Search Input */}
      <div className="topbar-search-container" ref={searchRef}>
        <div className="topbar-search-input-wrapper">
          <Search size={16} className="topbar-search-icon" />
          <input
            type="text"
            className="form-input topbar-search-input"
            placeholder="Search leads, customers, deals, plots... (Press /)"
            value={searchQuery}
            onFocus={() => setIsSearchOpen(true)}
            onChange={e => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
          />
        </div>

        {/* Global Search Results Dropdown */}
        {isSearchOpen && searchResults && (
          <>
            <div
              className="topbar-dropdown-backdrop"
              onClick={() => setIsSearchOpen(false)}
            />
            <div className="card animate-slide-down topbar-search-results">
              {searchResults.leads.length === 0 &&
                searchResults.customers.length === 0 &&
                searchResults.deals.length === 0 &&
                searchResults.plots.length === 0 &&
                searchResults.investors.length === 0 ? (
                <div className="topbar-search-empty">
                  No matches found for "{searchQuery}".
                </div>
              ) : (
                <>
                  {searchResults.leads.length > 0 && (
                    <div className="topbar-search-group">
                      <div className="topbar-search-category-title">
                        LEADS
                      </div>
                      {searchResults.leads.map(lead => (
                        <div
                          key={lead.id}
                          className="btn-ghost topbar-search-result-item"
                          onClick={() => {
                            onNavigate('leads', { selectId: lead.id });
                            setIsSearchOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          <div>
                            <div className="topbar-search-item-name">{lead.name}</div>
                            <div className="topbar-search-item-meta">{lead.phone} • {lead.location}</div>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--primary-600)', fontWeight: 600 }}>{lead.status}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchResults.customers.length > 0 && (
                    <div className="topbar-search-group">
                      <div className="topbar-search-category-title">
                        CUSTOMERS
                      </div>
                      {searchResults.customers.map(cust => (
                        <div
                          key={cust.id}
                          className="btn-ghost topbar-search-result-item"
                          onClick={() => {
                            onNavigate('customers', { selectId: cust.id });
                            setIsSearchOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          <div>
                            <div className="topbar-search-item-name">{cust.name}</div>
                            <div className="topbar-search-item-meta">{cust.phone} • {cust.location}</div>
                          </div>
                          <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>{cust.status}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchResults.deals.length > 0 && (
                    <div className="topbar-search-group">
                      <div className="topbar-search-category-title">
                        DEALS
                      </div>
                      {searchResults.deals.map(deal => (
                        <div
                          key={deal.id}
                          className="btn-ghost topbar-search-result-item"
                          onClick={() => {
                            onNavigate('deals');
                            setIsSearchOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          <div>
                            <div className="topbar-search-item-name">{deal.title}</div>
                            <div className="topbar-search-item-meta">{deal.customerName}</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600 }}>₹{(deal.value / 100000).toFixed(1)}L</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchResults.plots.length > 0 && (
                    <div className="topbar-search-group">
                      <div className="topbar-search-category-title">
                        PLOTS (JAMIN)
                      </div>
                      {searchResults.plots.map(plot => (
                        <div
                          key={plot.id}
                          className="btn-ghost topbar-search-result-item"
                          onClick={() => {
                            onNavigate('plots');
                            setIsSearchOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          <div>
                            <div className="topbar-search-item-name">{plot.plotNumber} ({plot.sizeSqft} sqft)</div>
                            <div className="topbar-search-item-meta">{plot.projectName}</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600 }}>{plot.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right Controls */}
      <div className="topbar-right-controls">
        {isGhlAdmin && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              alert("Downloading comprehensive report for all users...");
            }}
            title="Export Report"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} /> Export Report
          </button>
        )}

        {/* Theme Toggle (Available for all roles except Super Admin) */}
        {!isSuperAdmin && (
          <button
            className="btn btn-ghost btn-icon btn-sm"
            style={{ color: 'var(--text-secondary)' }}
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        )}

        {/* Agent Availability (Only for company users) */}
        {!isSuperAdmin && <AgentAvailabilityToggle />}

        {/* Persona Switcher for easy demo */}
        <PersonaSwitcher />

        {/* "+ New" Action Menu */}
        {!isSuperAdmin && (
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-primary btn-sm topbar-new-btn"
              onClick={() => setIsNewMenuOpen(!isNewMenuOpen)}
            >
              <Plus size={15} /> New <ChevronDown size={12} />
            </button>

            {isNewMenuOpen && (
              <>
                <div
                  className="topbar-dropdown-backdrop"
                  onClick={() => setIsNewMenuOpen(false)}
                />
                <div className="card animate-slide-down topbar-menu-dropdown">
                  <button
                    className="btn btn-ghost btn-sm topbar-menu-item-btn"
                    onClick={() => {
                      setIsNewMenuOpen(false);
                      onOpenQuickCreate('lead');
                    }}
                  >
                    + New Lead
                  </button>

                  {enabledFeatures.includes(FEATURES.SITE_VISITS) && (
                    <button
                      className="btn btn-ghost btn-sm topbar-menu-item-btn"
                      onClick={() => {
                        setIsNewMenuOpen(false);
                        onOpenQuickCreate('visit');
                      }}
                    >
                      + Schedule Site Visit
                    </button>
                  )}
                  {enabledFeatures.includes(FEATURES.CONSULTATIONS) && (
                    <button
                      className="btn btn-ghost btn-sm topbar-menu-item-btn"
                      onClick={() => {
                        setIsNewMenuOpen(false);
                        onOpenQuickCreate('consultation');
                      }}
                    >
                      + Schedule Consultation
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Notifications Bell */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost btn-icon btn-sm topbar-notif-btn"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
          >
            <Bell size={18} stroke="url(#redGradient)" />
            {unreadCount > 0 && (
              <span className="topbar-notif-badge">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <>
              <div
                className="topbar-dropdown-backdrop"
                onClick={() => setIsNotifOpen(false)}
              />
              <div className="card animate-slide-down topbar-notif-dropdown">
                <div className="topbar-notif-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Notifications</span>
                    <span style={{ fontSize: 10, background: 'var(--bg-surface-hover)', padding: '1px 6px', borderRadius: 10, color: 'var(--text-muted)' }}>
                      {tenant?.name}
                    </span>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: 0, color: 'var(--primary-600)' }}
                    onClick={() => markAllStoredNotificationsRead(tenant?.id, user?.id)}
                  >
                    Mark all read
                  </button>
                </div>

                <div className="topbar-notif-list">
                  {notifications.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      No notifications for {tenant?.name}. You're all caught up!
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`btn-ghost topbar-notif-item ${!n.read ? 'unread' : ''}`}
                        onClick={() => {
                          markStoredNotificationRead(n.id);
                          if (n.link) onNavigate(n.link.replace('/', ''));
                          setIsNotifOpen(false);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                            {n.priority === 'urgent' && (
                              <span style={{ fontSize: 9, fontWeight: 700, background: '#dc2626', color: '#fff', padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase' }}>
                                Urgent
                              </span>
                            )}
                            {n.type === 'broadcast' && (
                              <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '1px 5px', borderRadius: 4 }}>
                                Alert
                              </span>
                            )}
                            <span style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {n.title}
                            </span>
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{n.timestamp}</span>
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.4 }}>
                          {n.message}
                        </p>
                        {n.createdByName && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                            📢 By {n.createdByName}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid var(--border-base)', background: 'var(--bg-surface-hover)' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '2px 6px', color: 'var(--text-secondary)' }}
                    onClick={() => {
                      setIsNotifOpen(false);
                      onNavigate('notifications');
                    }}
                  >
                    View All Center →
                  </button>
                  {((user?.role?.code as string) === 'company_admin' || (user?.role?.code as string) === 'admin' || user?.role?.code === 'super_admin') && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: 11, padding: '3px 8px', gap: 4 }}
                      onClick={() => {
                        sessionStorage.setItem('nexus_open_alert_modal', 'true');
                        setIsNotifOpen(false);
                        onNavigate('notifications');
                      }}
                    >
                      <Plus size={12} /> Send Alert
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Profile Avatar / Menu */}
        <div style={{ position: 'relative' }}>
          <button
            className="topbar-user-avatar-btn"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          >
            <div
              className="topbar-user-avatar"
              style={{
                background: isSuperAdmin
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
                  : `linear-gradient(135deg, ${tenant?.brandColor || '#ef4444'} 0%, #991b1b 100%)`,
              }}
            >
              {user?.name.charAt(0)}
            </div>
          </button>

          {isUserMenuOpen && (
            <>
              <div
                className="topbar-dropdown-backdrop"
                onClick={() => setIsUserMenuOpen(false)}
              />
              <div className="card animate-slide-down topbar-user-dropdown">
                <div className="topbar-user-dropdown-header">
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{user?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user?.email}</div>
                  <div className="topbar-user-role-label">
                    {user?.role.name}
                  </div>
                </div>


                <div style={{ marginTop: 6 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--danger)' }}
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};