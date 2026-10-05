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

  // Provision User Modal state (Super Admin can create ONLY Company Admins)
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('+91 98450 ');
  const [newCompanyId, setNewCompanyId] = useState('');
  const [newRoleCode] = useState('company_admin');
  const [newDesignation, setNewDesignation] = useState('Company Administrator');
  const [newEmployeeCode, setNewEmployeeCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const [isLoading, setIsLoading] = useState(false);

  // Success Feedback
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [tList, rMap, uList] = await Promise.all([
        superAdminService.fetchTenantsFromApi(),
        superAdminService.fetchRolesFromApi(),
        superAdminService.fetchUsersFromApi(),
      ]);
      setTenants(tList || []);
      setRoles(rMap || {});
      setUsers(uList || []);
    } catch (err: any) {
      console.error('Failed to load user directory from API:', err);
      setLoadError(err.message || 'Failed to load user directory from database.');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = async () => {
    await loadData();
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener('nexus_admin_updated', handleUpdate);
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => {
      window.removeEventListener('nexus_admin_updated', handleUpdate);
      window.removeEventListener('nexus_storage_updated', handleUpdate);
    };
  }, []);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  // Handle Provisioning (Super Admin can create ONLY Company Admins)
  const handleProvisionUser = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      alert('Full Name and Work Email are required.');
      return;
    }

    const targetCompanyId = newCompanyId || tenants[0]?.id;
    if (!targetCompanyId) {
      alert('A valid Tenant Organization must be assigned for Company Admin creation.');
      return;
    }

    const companyAdminRole = roles.company_admin || {
      id: '2',
      name: 'Company Admin',
      code: 'company_admin',
      permissions: [],
      isSystemRole: true,
    };

    setIsSubmitting(true);
    try {
      await superAdminService.createUserApi({
        name: newName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim(),
        role: companyAdminRole,
        companyId: targetCompanyId,
        designation: newDesignation || 'Company Administrator',
        employeeCode: newEmployeeCode.trim() || undefined,
        status: 'Active',
      });

      setIsProvisionModalOpen(false);
      // Reset form
      setNewName('');
      setNewEmail('');
      setNewEmployeeCode('');
      showFeedback(`Company Admin account "${newName.trim()}" provisioned successfully in database.`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to provision Company Admin.');
    } finally {
      setIsSubmitting(false);
    }
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

  const handleSaveEditUser = async () => {
    if (!editingUser) return;

    const isGlobal = editCompanyId === 'global';
    const targetRole = roles[editRoleCode] || editingUser.role;
    const tenantObj = isGlobal ? undefined : tenants.find(t => t.id === editCompanyId);

    await superAdminService.updateUserApi(editingUser.id, {
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
    showFeedback(`User profile for "${editName}" updated in database.`);
    await applyFilters();
  };

  // Handle Password Reset
  const openResetModal = async (u: User) => {
    setResettingUser(u);
    const result = await superAdminService.resetUserPasswordApi(u.id);
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
  const handleToggleStatus = async (u: User) => {
    const nextStatus = u.status === 'Active' ? 'Disabled' : 'Active';
    await superAdminService.toggleUserStatusApi(u.id, nextStatus);
    showFeedback(`User status for ${u.name} set to ${nextStatus}.`);
    await applyFilters();
  };

  // Handle Delete
  const handleDeleteUser = async (u: User) => {
    if (u.email === 'yanosh@ghlindiaventures.com') {
      alert('The root platform Super Admin cannot be deleted.');
      return;
    }
    if (confirm(`Are you sure you want to permanently delete user "${u.name}" (${u.email})?`)) {
      await superAdminService.deleteUserApi(u.id);
      showFeedback(`User account "${u.name}" removed from database.`);
      await applyFilters();
    }
  };

  // Filter users by dropdown filters (Organization, Role, Status) and search query
  const filteredUsers = users.filter(u => {
    // 1. Organization filter
    if (selectedCompanyFilter !== 'all') {
      if (selectedCompanyFilter === 'global') {
        if (u.companyId && u.companyId !== 'global') {
          return false;
        }
      } else {
        if (!u.companyId || String(u.companyId) !== String(selectedCompanyFilter)) {
          return false;
        }
      }
    }

    // 2. Role filter
    if (selectedRoleFilter !== 'all') {
      const roleCode = typeof u.role === 'object' && u.role ? u.role.code : String(u.role || '');
      if (!roleCode || roleCode.toLowerCase() !== selectedRoleFilter.toLowerCase()) {
        return false;
      }
    }

    // 3. Status filter
    if (selectedStatusFilter !== 'all') {
      if (!u.status || u.status.toLowerCase() !== selectedStatusFilter.toLowerCase()) {
        return false;
      }
    }

    // 4. Search query (Name, Email, Phone, Organization)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = (u.name || '').toLowerCase().includes(q);
      const emailMatch = (u.email || '').toLowerCase().includes(q);
      const phoneMatch = (u.phone || '').toLowerCase().includes(q);
      const tenantObj = u.companyId ? tenants.find(t => String(t.id) === String(u.companyId)) : undefined;
      const orgName = u.companyName || tenantObj?.name || 'Platform Console (Global)';
      const orgMatch =
        orgName.toLowerCase().includes(q) ||
        Boolean(tenantObj?.slug && tenantObj.slug.toLowerCase().includes(q)) ||
        Boolean(u.companySlug && u.companySlug.toLowerCase().includes(q));
      if (!nameMatch && !emailMatch && !phoneMatch && !orgMatch) {
        return false;
      }
    }

    return true;
  });

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

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => loadData()}
            disabled={isLoading}
            title="Reload users directly from development database"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh Directory
          </button>
          <button
            className="btn btn-primary btn-sm btn-provision-user"
            onClick={() => {
              setNewCompanyId(tenants[0]?.id || '');
              setNewDesignation('Company Administrator');
              setIsProvisionModalOpen(true);
            }}
          >
            <UserPlus size={14} /> Provision Company Admin
          </button>
        </div>
      </div>

      {loadError && (
        <div className="users-feedback-alert animate-fade-in" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.35)', color: '#f87171' }}>
          <AlertTriangle size={16} /> {loadError}
        </div>
      )}

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
            {Object.values(roles).map(r => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
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
              {isLoading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <RefreshCw size={16} className="animate-spin" /> Loading cross-tenant directory from database...
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
                    No users found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
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
                          {u.companyName || (u.companyId ? (tenants.find(t => String(t.id) === String(u.companyId))?.name || `Tenant #${u.companyId}`) : 'Platform Console (Global)')}
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PROVISION USER MODAL */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* PROVISION COMPANY ADMIN MODAL */}
      {/* ========================================================================= */}
      {isProvisionModalOpen && (
        <Modal
          isOpen={isProvisionModalOpen}
          onClose={() => setIsProvisionModalOpen(false)}
          title="⚡ Provision Company Admin Account"
          size="md"
        >
          <div className="provision-modal-content">
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
                  <option value="company_admin">Company Admin (Tenant Scope)</option>
                </select>
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                  Super Admin can provision Company Admins only. Sales Executives, IRMs, and other team members must be invited by their respective Company Admin.
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

            <div className="modal-actions-footer">
              <button className="btn btn-ghost" onClick={() => setIsProvisionModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!newName || !newEmail || isSubmitting}
                onClick={handleProvisionUser}
              >
                {isSubmitting ? 'Provisioning...' : 'Provision Account'}
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
              >
                {Object.values(roles).map(r => (
                  <option key={r.code} value={r.code}>
                    {r.name} {r.isSystemRole ? '(System Role)' : '(Custom Role)'}
                  </option>
                ))}
              </select>
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
