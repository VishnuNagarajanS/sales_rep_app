import React, { useState, useEffect } from 'react';
import {
  Shield,
  Check,
  Save,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Info,
} from 'lucide-react';
import { PERMISSIONS } from '../../../constants/permissions';
import { SYSTEM_ROLES } from '../../../constants/roles';
import { Role } from '../../../types';
import { superAdminService } from '../../../services/superAdminService';
import { Modal } from '../../../components/common/Modal';
import './PlatformRolesPage.css';

interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
}

export const PlatformRolesPage: React.FC = () => {
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Custom Role Modal state
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('');
  const [baseTemplateRole, setBaseTemplateRole] = useState('sales_executive');

  const loadRoles = () => {
    setRoles(superAdminService.getRoles());
    setHasUnsavedChanges(false);
  };

  useEffect(() => {
    loadRoles();
    window.addEventListener('nexus_admin_updated', loadRoles);
    return () => window.removeEventListener('nexus_admin_updated', loadRoles);
  }, []);

  const permissionGroups: { group: string; items: PermissionDefinition[] }[] = [
    {
      group: 'Inbound Leads Management',
      items: [
        { key: PERMISSIONS.LEADS_VIEW, label: 'View Leads', description: 'Browse and inspect inbound and converted lead profiles' },
        { key: PERMISSIONS.LEADS_CREATE, label: 'Create Lead', description: 'Manually register prospective contact records' },
        { key: PERMISSIONS.LEADS_UPDATE, label: 'Update Lead', description: 'Modify contact information, intent tags, and custom fields' },
        { key: PERMISSIONS.LEADS_DELETE, label: 'Delete Lead', description: 'Permanently remove or archive lead records' },
        { key: PERMISSIONS.LEADS_ASSIGN, label: 'Assign Lead', description: 'Re-route or delegate leads to individual sales reps' },
        { key: PERMISSIONS.LEADS_CONVERT, label: 'Convert Lead', description: 'Execute conversion workflow from Lead to Customer 360' },
        { key: PERMISSIONS.LEADS_EXPORT, label: 'Export Leads CSV', description: 'Download CSV dumps of company lead tables' },
        { key: PERMISSIONS.LEADS_IMPORT, label: 'Import Leads CSV', description: 'Batch ingest contacts with custom column mapping' },
      ],
    },
    {
      group: 'Customer 360 & Commercial Deals',
      items: [
        { key: PERMISSIONS.CUSTOMERS_VIEW, label: 'View Customers', description: 'Access Customer 360 profiles and unified interaction timelines' },
        { key: PERMISSIONS.CUSTOMERS_CREATE, label: 'Create Customer', description: 'Manually register confirmed institutional/buyer accounts' },
        { key: PERMISSIONS.CUSTOMERS_UPDATE, label: 'Update Customer', description: 'Modify contact details, VIP badges, and custom notes' },
        { key: PERMISSIONS.CUSTOMERS_DELETE, label: 'Delete Customer', description: 'Deactivate or purge customer records' },
        { key: PERMISSIONS.DEALS_VIEW, label: 'View Deals & Pipeline', description: 'Access Kanban pipeline stages and financial revenue values' },
        { key: PERMISSIONS.DEALS_CREATE, label: 'Create Deal', description: 'Add new commercial deal to active pipeline' },
        { key: PERMISSIONS.DEALS_UPDATE, label: 'Update Deal & Stage', description: 'Move deals across stages and adjust close probability' },
        { key: PERMISSIONS.DEALS_DELETE, label: 'Delete Deal', description: 'Purge deal records from company pipeline' },
      ],
    },
    {
      group: 'Telephony & Live Softphone Calling',
      items: [
        { key: PERMISSIONS.CALLS_MAKE, label: 'Initiate Click-to-Call', description: 'Trigger outgoing WebRTC/SIP calls via embedded softphone' },
        { key: PERMISSIONS.CALLS_RECEIVE, label: 'Receive Inbound Calls', description: 'Accept inbound incoming calls routed to queue' },
        { key: PERMISSIONS.CALLS_VIEW, label: 'View Call Logs', description: 'Inspect call center history, durations, and dispositions' },
        { key: PERMISSIONS.CALLS_RECORDINGS_PLAY, label: 'Playback Call Audio', description: 'Stream voice recordings and review speech transcripts' },
      ],
    },
    {
      group: 'Follow-ups & Task Reminders',
      items: [
        { key: PERMISSIONS.FOLLOWUPS_VIEW, label: 'View Tasks & Follow-ups', description: 'Inspect scheduled callback agenda and overdue reminders' },
        { key: PERMISSIONS.FOLLOWUPS_CREATE, label: 'Schedule Follow-up', description: 'Book upcoming callbacks, meetings, or WhatsApp tasks' },
        { key: PERMISSIONS.FOLLOWUPS_UPDATE, label: 'Complete / Reschedule', description: 'Mark follow-up completed or reschedule slot' },
      ],
    },
    {
      group: 'Operations & Real Estate (Jamin)',
      items: [
        { key: PERMISSIONS.PROPERTIES_VIEW, label: 'View Layouts & Plots', description: 'Browse project inventory and plot status availability grid' },
        { key: PERMISSIONS.PROPERTIES_UPDATE, label: 'Update Plot Status', description: 'Put plots on Hold or release reservations' },
        { key: PERMISSIONS.SITE_VISITS_VIEW, label: 'View Site Visits', description: 'Inspect prospective buyer layout tour calendar' },
        { key: PERMISSIONS.SITE_VISITS_CREATE, label: 'Schedule Site Visit', description: 'Book customer layout tour with driver escort' },
        { key: PERMISSIONS.BOOKINGS_VIEW, label: 'View Plot Bookings', description: 'Inspect token advances and allotment documentation' },
        { key: PERMISSIONS.BOOKINGS_CREATE, label: 'Execute Booking', description: 'Record token receipt and transition plot to Sold' },
      ],
    },
    {
      group: 'Wealth Advisory & Investors (GHL)',
      items: [
        { key: PERMISSIONS.INVESTORS_VIEW, label: 'View HNW Investors', description: 'Access Ultra-HNI capital allocation and mandate profiles' },
        { key: PERMISSIONS.INVESTORS_CREATE, label: 'Create Investor', description: 'Onboard new accredited family office or institutional investor' },
        { key: PERMISSIONS.CONSULTATIONS_VIEW, label: 'View Consultations', description: 'Inspect private wealth advisory session schedules' },
        { key: PERMISSIONS.CONSULTATIONS_CREATE, label: 'Book Consultation', description: 'Schedule 1-on-1 private wealth advisory consultations' },
        { key: PERMISSIONS.OPPORTUNITIES_VIEW, label: 'View CRE Opportunities', description: 'Browse pre-leased commercial real estate syndication tranches' },
        { key: PERMISSIONS.OPPORTUNITIES_CREATE, label: 'Create Opportunity', description: 'List new investment tranche with target yield and deadlines' },
      ],
    },
    {
      group: 'Analytics, Governance & Platform',
      items: [
        { key: PERMISSIONS.REPORTS_VIEW, label: 'View Analytics', description: 'Access conversion funnels, rep leaderboards, and call talk-time' },
        { key: PERMISSIONS.REPORTS_EXPORT, label: 'Export Reports', description: 'Download CSV and Excel executive analytics reports' },
        { key: PERMISSIONS.USERS_VIEW, label: 'View Team Directory', description: 'Browse employee list and sales team structures' },
        { key: PERMISSIONS.USERS_MANAGE, label: 'Manage Team Users', description: 'Invite reps, modify quotas, and change user roles' },
        { key: PERMISSIONS.SETTINGS_VIEW, label: 'View Settings', description: 'Inspect organization branding, hours, and timezone' },
        { key: PERMISSIONS.SETTINGS_UPDATE, label: 'Update Settings', description: 'Modify branding colors, lead SLA timers, and company details' },
        { key: PERMISSIONS.AUDIT_VIEW, label: 'View Audit Logs', description: 'Inspect tamper-evident compliance audit trails' },
      ],
    },
  ];

  // List of active roles to display as matrix columns
  const activeRoleList = Object.values(roles);

  const hasPermission = (roleCode: string, permKey: string): boolean => {
    return Boolean(roles[roleCode]?.permissions?.includes(permKey));
  };

  const handleTogglePermission = (roleCode: string, permKey: string) => {
    if (roleCode === 'super_admin') {
      // Super admin always retains all permissions
      return;
    }

    const targetRole = roles[roleCode];
    if (!targetRole) return;

    const currentPerms = targetRole.permissions || [];
    const newPerms = currentPerms.includes(permKey)
      ? currentPerms.filter(p => p !== permKey)
      : [...currentPerms, permKey];

    const updatedRoles = {
      ...roles,
      [roleCode]: {
        ...targetRole,
        permissions: newPerms,
      },
    };

    setRoles(updatedRoles);
    setHasUnsavedChanges(true);
  };

  const handleSaveAllChanges = () => {
    Object.entries(roles).forEach(([code, r]) => {
      superAdminService.updateRolePermissions(code, r.permissions);
    });

    setHasUnsavedChanges(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleCreateCustomRole = () => {
    if (!newRoleName.trim() || !newRoleCode.trim()) return;

    const basePerms = roles[baseTemplateRole]?.permissions || [];
    const newRole = superAdminService.createCustomRole(
      newRoleName.trim(),
      newRoleCode.trim(),
      [...basePerms]
    );

    setRoles({ ...roles, [newRole.code]: newRole });
    setIsAddRoleModalOpen(false);
    setNewRoleName('');
    setNewRoleCode('');
  };

  // Filter permission groups based on search & category
  const filteredGroups = permissionGroups
    .filter(g => {
      if (selectedGroupFilter !== 'all' && g.group !== selectedGroupFilter) return false;
      return true;
    })
    .map(g => {
      if (!searchQuery) return g;
      const q = searchQuery.toLowerCase();
      const filteredItems = g.items.filter(
        i =>
          i.key.toLowerCase().includes(q) ||
          i.label.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q)
      );
      return { ...g, items: filteredItems };
    })
    .filter(g => g.items.length > 0);

  return (
    <div className="platform-roles-page-container">
      {/* Header */}
      <div className="roles-page-header">
        <div>
          <div className="header-breadcrumbs">
            <span>PLATFORM CONSOLE</span> &gt; <span className="current">ROLES & RBAC</span>
          </div>
          <h1 className="page-main-title">Master Role-Permission Matrix</h1>
          <p className="page-main-desc">
            Define canonical RBAC privilege grids, fine-grained action switches, and tenant role policies.
          </p>
        </div>

        <div className="roles-header-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsAddRoleModalOpen(true)}
          >
            <Plus size={14} /> Add Custom Role
          </button>

          <button
            className={`btn btn-primary btn-sm btn-save-matrix ${hasUnsavedChanges ? 'dirty-pulse' : ''}`}
            onClick={handleSaveAllChanges}
          >
            <Save size={14} />
            {hasUnsavedChanges ? 'Save Matrix Changes *' : 'Matrix Saved'}
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="roles-success-banner animate-fade-in">
          <CheckCircle2 size={16} /> Role permission definitions committed across all active tenant nodes.
        </div>
      )}

      {/* Role Summary Cards */}
      <div className="roles-summary-cards-grid">
        {activeRoleList.map(r => (
          <div key={r.code} className="card role-summary-card">
            <div className="role-summary-header">
              <span className={`role-badge ${r.code}`}>{r.name}</span>
              <span className="role-perms-count">{r.permissions.length} Privileges</span>
            </div>
            <div className="role-code-tag">
              Code: <code>{r.code}</code>
            </div>
            <p className="role-desc-text">
              {r.code === 'super_admin'
                ? 'Platform operator with unrestricted access across all tenants.'
                : r.code === 'company_admin'
                ? 'Tenant root administrator managing team users and company setup.'
                : r.code === 'sales_manager'
                ? 'Team squad leader with re-assignment and performance oversight.'
                : r.code === 'irm'
                ? 'Institutional Relationship Manager for HNW wealth & CRE.'
                : 'Frontline sales representative executing dialer outreach.'}
            </p>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="card roles-filter-card">
        <div className="roles-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="roles-search-input"
            placeholder="Search permissions by key, action, or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="roles-group-select"
          value={selectedGroupFilter}
          onChange={e => setSelectedGroupFilter(e.target.value)}
        >
          <option value="all">All Functional Groups ({permissionGroups.length})</option>
          {permissionGroups.map(g => (
            <option key={g.group} value={g.group}>
              {g.group}
            </option>
          ))}
        </select>
      </div>

      {/* Interactive Permission Matrix Table */}
      <div className="card matrix-table-card">
        <div className="table-responsive">
          <table className="interactive-matrix-table">
            <thead>
              <tr className="matrix-thead-tr">
                <th className="matrix-th-perm">Functional Privilege & Description</th>
                {activeRoleList.map(r => (
                  <th key={r.code} className="matrix-th-role">
                    <div className="th-role-name">{r.name}</div>
                    <div className="th-role-code">{r.code}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map(group => (
                <React.Fragment key={group.group}>
                  <tr className="matrix-group-row">
                    <td colSpan={activeRoleList.length + 1} className="matrix-group-td">
                      ● {group.group.toUpperCase()}
                    </td>
                  </tr>

                  {group.items.map(item => (
                    <tr key={item.key} className="matrix-item-row">
                      <td className="matrix-item-name-col">
                        <div className="perm-label">{item.label}</div>
                        <div className="perm-desc">{item.description}</div>
                        <code className="perm-key">{item.key}</code>
                      </td>

                      {activeRoleList.map(r => {
                        const isGranted = hasPermission(r.code, item.key);
                        const isSuperAdmin = r.code === 'super_admin';

                        return (
                          <td key={r.code} className="matrix-checkbox-cell">
                            <label className={`matrix-toggle-label ${isSuperAdmin ? 'locked' : ''}`}>
                              <input
                                type="checkbox"
                                checked={isGranted}
                                disabled={isSuperAdmin}
                                onChange={() => handleTogglePermission(r.code, item.key)}
                              />
                              <span className={`toggle-check-box ${isGranted ? 'checked' : ''}`}>
                                {isGranted && <Check size={12} />}
                              </span>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Custom Role Modal */}
      {isAddRoleModalOpen && (
        <Modal
          isOpen={isAddRoleModalOpen}
          onClose={() => setIsAddRoleModalOpen(false)}
          title="⚡ Define Custom Platform Role"
          size="md"
        >
          <div className="add-role-modal-content">
            <p className="modal-desc">
              Create a specialized role template with cloned default permissions.
            </p>

            <div className="form-group">
              <label className="form-label required">Role Display Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Senior Wealth Partner"
                value={newRoleName}
                onChange={e => {
                  setNewRoleName(e.target.value);
                  if (!newRoleCode) {
                    setNewRoleCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                  }
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Unique Role Code</label>
              <input
                type="text"
                className="form-control font-mono"
                placeholder="senior_wealth_partner"
                value={newRoleCode}
                onChange={e => setNewRoleCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Clone Base Permissions From</label>
              <select
                className="form-control"
                value={baseTemplateRole}
                onChange={e => setBaseTemplateRole(e.target.value)}
              >
                <option value="sales_executive">Sales Executive (Field Rep)</option>
                <option value="sales_manager">Sales Manager (Team Lead)</option>
                <option value="company_admin">Company Admin (Tenant Root)</option>
                <option value="irm">IRM (Wealth Management)</option>
              </select>
            </div>

            <div className="modal-actions-footer">
              <button className="btn btn-ghost" onClick={() => setIsAddRoleModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!newRoleName.trim() || !newRoleCode.trim()}
                onClick={handleCreateCustomRole}
              >
                Create Role Template
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
