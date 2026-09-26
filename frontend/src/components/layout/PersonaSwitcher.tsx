import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Building2, UserCheck, RefreshCw, ChevronDown, TrendingUp } from 'lucide-react';
import { storageService } from '../../services/storageService';
import './PersonaSwitcher.css';

export const PersonaSwitcher: React.FC = () => {
  const { user, tenant, isSuperAdmin, switchPersona } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const personas = [
    {
      label: 'Super Admin (Console)',
      role: 'super_admin' as const,
      badge: 'Platform Operator',
      icon: <Shield size={14} color="#8b5cf6" />,
      desc: 'Cross-tenant administration, onboarding wizard, audit logs',
    },
    {
      label: 'GHL India (Admin)',
      role: 'company_admin' as const,
      slug: 'ghl' as const,
      badge: 'Wealth & Advisory',
      icon: <Building2 size={14} color="#ef4444" />,
      desc: 'Investors, Consultations, Opportunities, Full Admin',
    },
    {
      label: 'GHL India (Executive)',
      role: 'sales_executive' as const,
      slug: 'ghl' as const,
      badge: 'Sales Agent',
      icon: <UserCheck size={14} color="#ef4444" />,
      desc: 'Assigned Leads, Calling, Consultations',
    },
    {
      label: 'GHL India (IRM)',
      role: 'irm' as const,
      slug: 'ghl' as const,
      badge: 'Relationship Mgr',
      icon: <TrendingUp size={14} color="#ef4444" />,
      desc: 'Investors 360, Consultations, Opportunities, Calling',
    },
    {
      label: 'Jamin Bazaar (Admin)',
      role: 'company_admin' as const,
      slug: 'jamin' as const,
      badge: 'Plotted Real Estate',
      icon: <Building2 size={14} color="#e10600" />,
      desc: 'Plot Inventory, Site Visits, Bookings, Full Admin',
    },
    {
      label: 'Jamin Bazaar (Executive)',
      role: 'sales_executive' as const,
      slug: 'jamin' as const,
      badge: 'Sales Agent',
      icon: <UserCheck size={14} color="#e10600" />,
      desc: 'Assigned Leads, Calling, Plot Holds, Site Visits',
    },
  ];

  const customTenants = storageService.getTenants().filter(t => t.slug !== 'ghl' && t.slug !== 'jamin');

  const handleResetData = () => {
    if (confirm('Reset demo data to initial defaults?')) {
      storageService.resetData();
      window.location.reload();
    }
  };

  return (
    <div className="persona-switcher-container">
      <button
        className={`btn btn-secondary btn-sm persona-trigger-btn ${isSuperAdmin ? 'super-admin' : 'tenant-admin'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="persona-role-prefix">ROLE:</span>
        <span className="persona-role-name">
          {isSuperAdmin ? 'Super Admin' : `${tenant?.name} (${user?.role.name})`}
        </span>
        <ChevronDown size={14} color="#ffffff" />
      </button>

      {isOpen && (
        <>
          <div
            className="persona-backdrop"
            onClick={() => setIsOpen(false)}
          />
          <div className="card animate-slide-down persona-dropdown">
            <div className="persona-dropdown-header">
              <span>Switch Tenant Persona</span>
              <button
                className="btn btn-ghost btn-sm persona-reset-btn"
                onClick={handleResetData}
                title="Reset local storage"
              >
                <RefreshCw size={11} /> Reset Data
              </button>
            </div>

            <div className="persona-list">
              {personas.map((p, idx) => {
                const isActive =
                  p.role === 'super_admin'
                    ? isSuperAdmin
                    : tenant?.slug === p.slug && user?.role.code === p.role;

                return (
                  <button
                    key={idx}
                    className={`btn btn-ghost persona-item-btn ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      switchPersona(p.role, (p as any).slug);
                      setIsOpen(false);
                    }}
                  >
                    <div className="persona-item-icon">{p.icon}</div>
                    <div className="persona-item-content">
                      <div className="persona-item-header">
                        <span className={`persona-item-label ${isActive ? 'active' : ''}`}>
                          {p.label}
                        </span>
                        <span className="persona-item-badge">
                          {p.badge}
                        </span>
                      </div>
                      <div className={`persona-item-desc ${isActive ? 'active' : ''}`}>
                        {p.desc}
                      </div>
                    </div>
                  </button>
                );
              })}

              {customTenants.length > 0 && (
                <>
                  <div className="persona-custom-header">
                    Custom Tenants
                  </div>
                  {customTenants.map(t => {
                    const isActive = tenant?.slug === t.slug && user?.role.code === 'company_admin';
                    return (
                      <button
                        key={t.id}
                        className={`btn btn-ghost persona-item-btn ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          switchPersona('company_admin', t.slug);
                          setIsOpen(false);
                        }}
                      >
                        <div className="persona-item-icon">
                          <Building2 size={14} color={t.brandColor || '#8b5cf6'} />
                        </div>
                        <div className="persona-item-content">
                          <div className="persona-item-header">
                            <span className={`persona-item-label ${isActive ? 'active' : ''}`}>
                              {t.name}
                            </span>
                            <span className="persona-item-badge">
                              Admin
                            </span>
                          </div>
                          <div className={`persona-item-desc ${isActive ? 'active' : ''}`}>
                            {t.tagline}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
