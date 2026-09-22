import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  Plus,
  ChevronDown,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AgentAvailabilityToggle } from '../calling/CallCenterComponents';
import { PersonaSwitcher } from './PersonaSwitcher';
import { FEATURES } from '../../constants/features';
import { notificationStore } from '../../services/secondaryStores';
import './TopBar.css';

interface TopBarProps {
  onNavigate: (route: string, extraState?: any) => void;
  onOpenQuickCreate: (type: 'lead' | 'followup' | 'deal' | 'visit' | 'consultation') => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onNavigate, onOpenQuickCreate }) => {
  const { user, tenant, isSuperAdmin, logout, enabledFeatures } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Notifications state
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications] = useState<any[]>([]);

  // Quick New state
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);

  // User menu
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Global search items
  const searchResults = React.useMemo<{
    leads: any[];
    customers: any[];
    deals: any[];
    plots: any[];
    investors: any[];
  } | null>(() => {
    if (!searchQuery.trim()) return null;
    return { leads: [], customers: [], deals: [], plots: [], investors: [] };
  }, [searchQuery]);

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
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Notifications</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: 0, color: 'var(--primary-600)' }}
                    onClick={() => notificationStore.markAllNotificationsRead()}
                  >
                    Mark all read
                  </button>
                </div>

                <div className="topbar-notif-list">
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      className={`btn-ghost topbar-notif-item ${!n.read ? 'unread' : ''}`}
                      onClick={() => {
                        notificationStore.markNotificationRead(n.id);
                        if (n.link) onNavigate(n.link.replace('/', ''));
                        setIsNotifOpen(false);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{n.title}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{n.timestamp}</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                        {n.message}
                      </p>
                    </div>
                  ))}
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