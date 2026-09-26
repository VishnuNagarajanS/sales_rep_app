import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Search,
  Plus,
  KeyRound,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Building2,
  Filter,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { User, Tenant, Role } from '../../../types';
import { superAdminService } from '../../../services/superAdminService';
import { StatusChip } from '../../../components/common/StatusChip';
import { Modal } from '../../../components/common/Modal';
import { Drawer } from '../../../components/common/Drawer';
import './PlatformUsersPage.css';

export const PlatformUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [roles, setRoles] = useState<Record<string, Role>>({});

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');

  // Provision User Modal state
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [provisionUserType, setProvisionUserType] = useState<'platform_admin' | 'tenant_user'>('tenant_user');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('+91 98450 ');
  const [newCompanyId, setNewCompanyId] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('company_admin');
  const [newDesignation, setNewDesignation] = useState('Organization Administrator');
  const [newEmployeeCode, setNewEmployeeCode] = useState('');

  // Edit User Drawer state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompanyId, setEditCompanyId] = useState('');
  const [editRoleCode, setEditRoleCode] = useState('');
  const [editDesignation, setEditDesignation] = useState('');

  // Password Reset Modal state
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [generatedTempPassword, setGeneratedTempPassword] = useState('');
  const [hasCopiedPassword, setHasCopiedPassword] = useState(false);

  // Success Feedback
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const loadData = () => {
    setTenants(superAdminService.getTenants());
    setRoles(superAdminService.getRoles());
    applyFilters();
  };

  const applyFilters = () => {
    const list = superAdminService.getUsers({
      companyId: selectedCompanyFilter,
      roleCode: selectedRoleFilter,
      status: selectedStatusFilter,
      search: searchQuery,
    });
    setUsers(list);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('nexus_admin_updated', loadData);
    window.addEventListener('nexus_storage_updated', loadData);
    return () => {
      window.removeEventListener('nexus_admin_updated', loadData);
      window.removeEventListener('nexus_storage_updated', loadData);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedCompanyFilter, selectedRoleFilter, selectedStatusFilter]);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  // Handle Provisioning
  const handleProvisionUser = () => {
    if (!newName || !newEmail) return;

    const isPlatform = provisionUserType === 'platform_admin';
    const targetRole = isPlatform ? roles.super_admin : roles.company_admin;
    const targetCompany = isPlatform ? undefined : newCompanyId || tenants[0]?.id;

    superAdminService.createUser({
      name: newName,
      email: newEmail,
      phone: newPhone,
      role: targetRole,
      companyId: targetCompany,
      designation: newDesignation,
      employeeCode: newEmployeeCode,
      status: 'Active',
    });

    setIsProvisionModalOpen(false);
    // Reset
    setNewName('');
    setNewEmail('');
    showFeedback(`User account "${newName}" provisioned successfully.`);
  };

  // Handle Editing
  const openEditDrawer = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPhone(u.phone);
    setEditCompanyId(u.companyId || 'global');
    setEditRoleCode(u.role.code);
    setEditDesignation(u.designation || '');
    setIsEditDrawerOpen(true);
  };

  const handleSaveEditUser = () => {
    if (!editingUser) return;

    const isGlobal = editCompanyId === 'global';
    const targetRole = roles[editRoleCode] || editingUser.role;
    const tenantObj = isGlobal ? undefined : tenants.find(t => t.id === editCompanyId);

    superAdminService.updateUser(editingUser.id, {
      name: editName,
      email: editEmail,
      phone: editPhone,
      role: targetRole,
      companyId: isGlobal ? undefined : editCompanyId,
      companyName: isGlobal ? 'Platform Console (Global)' : tenantObj?.name,
      companySlug: isGlobal ? undefined : tenantObj?.slug,
      designation: editDesignation,
    });

    setIsEditDrawerOpen(false);
    showFeedback(`User profile for "${editName}" updated.`);
  };

  // Handle Password Reset
  const openResetModal = (u: User) => {
    setResettingUser(u);
    const result = superAdminService.resetUserPassword(u.id);
    setGeneratedTempPassword(result.tempPassword || 'Nexus#2026!');
    setHasCopiedPassword(false);
    setIsResetModalOpen(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedTempPassword);
    setHasCopiedPassword(true);
    setTimeout(() => setHasCopiedPassword(false), 2000);
  };

  // Handle Toggle Status
  const handleToggleStatus = (u: User) => {
    const nextStatus = u.status === 'Active' ? 'Disabled' : 'Active';
    superAdminService.toggleUserStatus(u.id, nextStatus);
    showFeedback(`User status for ${u.name} set to ${nextStatus}.`);
  };

  // Handle Delete
  const handleDeleteUser = (u: User) => {
    if (u.email === 'alex@nexusplatform.io') {
      alert('The root platform Super Admin cannot be deleted.');
      return;
    }
    if (confirm(`Are you sure you want to permanently delete user "${u.name}" (${u.email})?`)) {
      superAdminService.deleteUser(u.id);
      showFeedback(`User account "${u.name}" removed.`);
    }
  };

  return (
    <div className="platform-users-page-container">
      {/* Page Header */}
      <div className="users-page-header">
        <div>
          <div className="header-breadcrumbs">
            <span>PLATFORM CONSOLE</span> &gt; <span className="current">USERS & REPS</span>
          </div>
          <h1 className="page-main-title">Cross-Tenant Identity & Directory</h1>
          <p className="page-main-desc">
            Global directory of platform administrators, company admins, sales executives, and relationship managers.
          </p>
        </div>

        <button
          className="btn btn-primary btn-sm btn-provision-user"
          onClick={() => {
            setProvisionUserType('tenant_user');
            setNewCompanyId(tenants[0]?.id || '');
            setIsProvisionModalOpen(true);
          }}
        >
          <UserPlus size={14} /> Provision User Account
        </button>
      </div>

      {feedbackMsg && (
        <div className="users-feedback-alert animate-fade-in">
          <CheckCircle2 size={16} /> {feedbackMsg}
        </div>
      )}

      {/* Filter Card */}
      <div className="card users-filter-card">
        <div className="users-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="users-search-input"
            placeholder="Search by name, email, phone, or organization..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="users-dropdown-filters">
          {/* Organization Filter */}
          <select
            className="filter-select"
            value={selectedCompanyFilter}
            onChange={e => setSelectedCompanyFilter(e.target.value)}
          >
            <option value="all">All Organizations ({tenants.length + 1})</option>
            <option value="global">Platform Console (Super Admins)</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            className="filter-select"
            value={selectedRoleFilter}
            onChange={e => setSelectedRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="company_admin">Company Admin</option>
            <option value="sales_executive">Sales Executive</option>
            <option value="irm">IRM</option>
          </select>

          {/* Status Filter */}
          <select
            className="filter-select"
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Invited">Invited</option>
            <option value="Disabled">Disabled</option>
          </select>
        </div>
      </div>

      {/* Users Data Table Card */}
      <div className="card users-table-card">
        <div className="table-responsive">
          <table className="users-data-table">
            <thead>
              <tr>
                <th>User Identity</th>
                <th>Tenant Organization</th>
                <th>Role & Scope</th>
                <th>Status</th>
                <th>Last Active</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isSuperAdminUser = u.role.code === 'super_admin';
                return (
                  <tr key={u.id} className="user-table-row">
                    <td>
                      <div className="user-identity-cell">
                        <div
                          className="user-avatar-circle"
                          style={{
                            backgroundColor: isSuperAdminUser ? '#8b5cf6' : '#334155',
                          }}
                        >
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="user-name-title">
                            {u.name}
                            {isSuperAdminUser && <span className="super-crown">⚡</span>}
                          </div>
                          <div className="user-email-subtitle">
                            {u.email} • {u.phone}
                          </div>
                          {u.designation && <div className="user-designation-tag">{u.designation}</div>}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="tenant-tag-badge">
                        <Building2 size={12} />
                        {u.companyName || 'Platform Console (Global)'}
                      </span>
                    </td>

                    <td>
                      <div className="role-cell-wrap">
                        <span className={`role-badge ${u.role.code}`}>{u.role.name}</span>
                        <span className="role-privilege-count">
                          {u.role.permissions.length} Privileges
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className={`user-status-pill ${u.status.toLowerCase()}`}>
                        {u.status}
                      </span>
                    </td>

                    <td>
                      <span className="last-login-text">{u.lastLogin || 'Never'}</span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div className="user-row-actions">
                        <button
                          className="action-icon-btn"
                          title="Reset Password"
                          onClick={() => openResetModal(u)}
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          className="action-icon-btn"
                          title="Edit Profile"
                          onClick={() => openEditDrawer(u)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className={`action-icon-btn ${u.status === 'Active' ? 'text-amber' : 'text-green'}`}
                          title={u.status === 'Active' ? 'Suspend Account' : 'Activate Account'}
                          onClick={() => handleToggleStatus(u)}
                        >
                          {u.status === 'Active' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                        </button>
                        {!isSuperAdminUser && (
                          <button
                            className="action-icon-btn text-danger"
                            title="Delete User"
                            onClick={() => handleDeleteUser(u)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PROVISION USER MODAL */}
      {/* ========================================================================= */}
      {isProvisionModalOpen && (
        <Modal
          isOpen={isProvisionModalOpen}
          onClose={() => setIsProvisionModalOpen(false)}
          title="⚡ Provision User Identity Account"
          size="md"
        >
          <div className="provision-modal-content">
            {/* User Type Switcher */}
            <div className="user-type-selector-tabs">
              <button
                className={`type-tab ${provisionUserType === 'tenant_user' ? 'active' : ''}`}
                onClick={() => setProvisionUserType('tenant_user')}
              >
                Tenant Organization Rep
              </button>
              <button
                className={`type-tab ${provisionUserType === 'platform_admin' ? 'active' : ''}`}
                onClick={() => setProvisionUserType('platform_admin')}
              >
                ⚡ Platform Super Admin
              </button>
            </div>

            <div className="form-group">
              <label className="form-label required">Full Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Rahul Sen"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Official Work Email</label>
              <input
                type="email"
                className="form-control"
                placeholder="rahul@ghlindiatrust.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
              />
            </div>

            <div className="form-grid-two">
              <div className="form-group">
                <label className="form-label">Contact Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Employee Code</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="EMP-1042"
                  value={newEmployeeCode}
                  onChange={e => setNewEmployeeCode(e.target.value)}
                />
              </div>
            </div>

            {provisionUserType === 'tenant_user' ? (
              <>
                <div className="form-group">
                  <label className="form-label required">Assign Tenant Organization</label>
                  <select
                    className="form-control"
                    value={newCompanyId}
                    onChange={e => setNewCompanyId(e.target.value)}
                  >
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-grid-two">
                  <div className="form-group">
                    <label className="form-label required">Role Scope</label>
                    <select
                      className="form-control"
                      value="company_admin"
                      disabled
                    >
                      <option value="company_admin">Company Admin (Tenant Root)</option>
                    </select>
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                      Super Admin creates Company Admins. Company Admins manage their own Sales Executives and IRMs.
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Designation / Title</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newDesignation}
                      onChange={e => setNewDesignation(e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="platform-admin-notice">
                <Shield size={18} color="#c084fc" />
                <div>
                  <strong>Root Operator Privileges:</strong> This account will be provisioned with platform-wide
                  Super Admin privileges across all tenant nodes, telephony gateways, and security audit ledgers.
                </div>
              </div>
            )}

            <div className="modal-actions-footer">
              <button className="btn btn-ghost" onClick={() => setIsProvisionModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!newName || !newEmail}
                onClick={handleProvisionUser}
              >
                Provision Account
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* EDIT USER DRAWER */}
      {/* ========================================================================= */}
      {isEditDrawerOpen && editingUser && (
        <Drawer
          isOpen={isEditDrawerOpen}
          onClose={() => setIsEditDrawerOpen(false)}
          title={`Edit User: ${editingUser.name}`}
          size="md"
        >
          <div className="edit-drawer-content">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-control"
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Work Email</label>
              <input
                type="email"
                className="form-control"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-control"
                value={editPhone}
                onChange={e => setEditPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Designation</label>
              <input
                type="text"
                className="form-control"
                value={editDesignation}
                onChange={e => setEditDesignation(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Organization Assignment</label>
              <select
                className="form-control"
                value={editCompanyId}
                onChange={e => setEditCompanyId(e.target.value)}
              >
                <option value="global">Platform Console (Global)</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Assigned Role</label>
              <select
                className="form-control"
                value={editRoleCode}
                onChange={e => setEditRoleCode(e.target.value)}
                disabled={editRoleCode === 'sales_executive' || editRoleCode === 'irm'}
              >
                <option value="company_admin">Company Admin (Tenant Root)</option>
                <option value="super_admin">Super Admin (Platform Root)</option>
                {(editRoleCode === 'sales_executive' || editRoleCode === 'irm') && (
                  <option value={editRoleCode} disabled>
                    {editRoleCode === 'irm' ? 'IRM (Managed by Company Admin)' : 'Sales Executive (Managed by Company Admin)'}
                  </option>
                )}
              </select>
              {(editRoleCode === 'sales_executive' || editRoleCode === 'irm') && (
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                  Company-level operational roles are managed directly by the Company Admin.
                </span>
              )}
            </div>

            <div className="drawer-actions-row">
              <button className="btn btn-ghost" onClick={() => setIsEditDrawerOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveEditUser}>
                Save Changes
              </button>
            </div>
          </div>
        </Drawer>
      )}

      {/* ========================================================================= */}
      {/* PASSWORD RESET MODAL */}
      {/* ========================================================================= */}
      {isResetModalOpen && resettingUser && (
        <Modal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          title={`Temporary Credentials for ${resettingUser.name}`}
          size="sm"
        >
          <div className="reset-modal-content">
            <p className="reset-desc">
              A temporary password has been generated for <strong>{resettingUser.email}</strong>. Share this secure key
              with the user. They will be prompted to reset upon next login.
            </p>

            <div className="password-display-card">
              <div className="password-label">TEMPORARY PASSWORD</div>
              <div className="password-val font-mono">{generatedTempPassword}</div>
              <button
                className={`btn btn-secondary btn-sm btn-copy-pwd ${hasCopiedPassword ? 'copied' : ''}`}
                onClick={copyToClipboard}
              >
                {hasCopiedPassword ? (
                  <>
                    <Check size={14} /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy Key
                  </>
                )}
              </button>
            </div>

            <div className="modal-actions-footer">
              <button className="btn btn-primary" onClick={() => setIsResetModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
