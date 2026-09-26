import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Mail,
  CheckCircle2,
  AlertCircle,
  XCircle,
  UserX,
  UserCheck,
  KeyRound,
  Edit2,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SYSTEM_ROLES } from '../../constants/roles';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { User, RoleCode } from '../../types';
import './CompanyUsersPage.css';

const getStoredUsers = (tenantSlug?: string, tenantId?: string): User[] => {
  try {
    const raw = localStorage.getItem('nexus_users');
    const all: User[] = raw ? JSON.parse(raw) : [];
    return all.filter(u => {
      if (tenantId && u.companyId === tenantId) return true;
      if (tenantSlug && u.companySlug === tenantSlug) return true;
      return false;
    });
  } catch {
    return [];
  }
};

const saveStoredUser = (user: User) => {
  try {
    const raw = localStorage.getItem('nexus_users');
    const all: User[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(u => u.id === user.id);
    if (idx >= 0) all[idx] = user;
    else all.push(user);
    localStorage.setItem('nexus_users', JSON.stringify(all));
    window.dispatchEvent(new Event('nexus_storage_updated'));
    window.dispatchEvent(new Event('nexus_admin_updated'));
  } catch {}
};

const deleteStoredUser = (userId: string) => {
  try {
    const raw = localStorage.getItem('nexus_users');
    const all: User[] = raw ? JSON.parse(raw) : [];
    const filtered = all.filter(u => u.id !== userId);
    localStorage.setItem('nexus_users', JSON.stringify(filtered));
    window.dispatchEvent(new Event('nexus_storage_updated'));
    window.dispatchEvent(new Event('nexus_admin_updated'));
  } catch {}
};

const addStoredAuditLog = (log: any) => {
  try {
    const raw = localStorage.getItem('nexus_audit_logs');
    const all = raw ? JSON.parse(raw) : [];
    all.unshift(log);
    localStorage.setItem('nexus_audit_logs', JSON.stringify(all));
    window.dispatchEvent(new Event('nexus_storage_updated'));
    window.dispatchEvent(new Event('nexus_admin_updated'));
  } catch {}
};

export const CompanyUsersPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const [usersList, setUsersList] = useState<User[]>(() =>
    getStoredUsers(tenant?.slug, tenant?.id),
  );

  // ── Filters ───────────────────────────────────────────────────────────────
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadData = () => {
    setUsersList(getStoredUsers(tenant?.slug, tenant?.id));
  };

  useEffect(() => {
    loadData();
    window.addEventListener('nexus_storage_updated', loadData);
    window.addEventListener('nexus_admin_updated', loadData);
    return () => {
      window.removeEventListener('nexus_storage_updated', loadData);
      window.removeEventListener('nexus_admin_updated', loadData);
    };
  }, [tenant?.slug, tenant?.id]);

  // ── Toast feedback ────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Assignable Company Roles (Strictly Sales Executive & IRM) ──────────────
  const assignableRoles = [
    SYSTEM_ROLES.sales_executive,
    SYSTEM_ROLES.irm,
  ].filter(Boolean);

  // ── Add / Invite User Modal State ─────────────────────────────────────────
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('+91 98450 ');
  const [inviteDesignation, setInviteDesignation] = useState('Wealth Advisory Consultant');
  const [inviteRole, setInviteRole] = useState<RoleCode>('sales_executive');
  const [creationMode, setCreationMode] = useState<'invite' | 'instant_password'>('invite');
  const [generatedNewPassword, setGeneratedNewPassword] = useState<string | null>(null);
  const [hasCopiedNewPassword, setHasCopiedNewPassword] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // ── Edit User Modal State ─────────────────────────────────────────────────
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editRoleCode, setEditRoleCode] = useState<RoleCode>('sales_executive');

  // ── Reset Password Modal State ────────────────────────────────────────────
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [hasCopiedTempPassword, setHasCopiedTempPassword] = useState(false);

  // ── Invite / Add Handlers ─────────────────────────────────────────────────
  const handleOpenInvite = () => {
    setInviteName('');
    setInviteEmail('');
    setInvitePhone('+91 98450 ');
    setInviteDesignation('Wealth Advisory Consultant');
    setInviteRole('sales_executive');
    setCreationMode('invite');
    setGeneratedNewPassword(null);
    setHasCopiedNewPassword(false);
    setInviteError(null);
    setIsInviteModalOpen(true);
  };

  const handleCreateOrInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);

    const trimmedEmail = inviteEmail.trim();
    const trimmedName = inviteName.trim();
    if (!trimmedName || !trimmedEmail) return;

    // Check for duplicate email (case-insensitive)
    const isDuplicate = usersList.some(
      u => u.email.trim().toLowerCase() === trimmedEmail.toLowerCase(),
    );
    if (isDuplicate) {
      setInviteError(`A team member with email "${trimmedEmail}" already exists in ${tenant?.name}.`);
      return;
    }

    const assignedRole = SYSTEM_ROLES[inviteRole] || SYSTEM_ROLES.sales_executive;
    const isInstant = creationMode === 'instant_password';
    const tempPass = isInstant
      ? `Nexus#${Math.floor(1000 + Math.random() * 9000)}`
      : undefined;

    const newUser: User = {
      id: `usr-${tenant?.slug || 'ghl'}-${Date.now().toString(36)}`,
      name: trimmedName,
      email: trimmedEmail,
      phone: invitePhone.trim() || '+91 98000 00000',
      role: assignedRole,
      companyId: tenant?.id,
      companySlug: tenant?.slug,
      companyName: tenant?.name,
      designation: inviteDesignation.trim() || undefined,
      status: isInstant ? 'Active' : 'Invited',
      lastLogin: isInstant ? 'Pending First Login' : 'Never',
    };

    saveStoredUser(newUser);

    // Audit log
    addStoredAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Company Admin',
      actorEmail: user?.email || 'admin@nexus.com',
      action: isInstant ? 'USER_PROVISIONED' : 'USER_INVITED',
      entityType: 'User',
      entityId: newUser.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `${isInstant ? 'Provisioned' : 'Invited'} ${newUser.name} (${newUser.email}) as ${newUser.role.name} with designation [${newUser.designation || 'None'}].`,
    });

    if (isInstant && tempPass) {
      setGeneratedNewPassword(tempPass);
      showToast('success', `Team member ${newUser.name} provisioned successfully.`);
    } else {
      setIsInviteModalOpen(false);
      showToast('success', `Invitation sent to ${newUser.email}.`);
    }
  };

  // ── Edit Handlers ─────────────────────────────────────────────────────────
  const openEditModal = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditPhone(u.phone || '');
    setEditDesignation(u.designation || '');
    setEditRoleCode(u.role.code);
  };

  const handleSaveEditUser = () => {
    if (!editingUser) return;

    const updatedRole = SYSTEM_ROLES[editRoleCode] || editingUser.role;
    const oldRole = editingUser.role;

    const updated: User = {
      ...editingUser,
      name: editName.trim() || editingUser.name,
      phone: editPhone.trim() || editingUser.phone,
      designation: editDesignation.trim() || editingUser.designation,
      role: updatedRole,
    };

    saveStoredUser(updated);

    addStoredAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Company Admin',
      actorEmail: user?.email || 'admin@nexus.com',
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: updated.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      beforeValue: { roleCode: oldRole.code, roleName: oldRole.name, name: editingUser.name },
      afterValue: { roleCode: updatedRole.code, roleName: updatedRole.name, name: updated.name },
      details: `Company Admin updated team member profile for ${updated.name} (${updated.email}).`,
    });

    showToast('success', `Updated profile for ${updated.name}.`);
    setEditingUser(null);
  };

  // ── Password Reset Handlers ───────────────────────────────────────────────
  const handleOpenResetPassword = (u: User) => {
    const generated = `Nexus#${Math.floor(1000 + Math.random() * 9000)}`;
    setResettingUser(u);
    setTempPassword(generated);
    setHasCopiedTempPassword(false);

    addStoredAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Company Admin',
      actorEmail: user?.email || 'admin@nexus.com',
      action: 'USER_PASSWORD_RESET',
      entityType: 'User',
      entityId: u.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Generated temporary login password for ${u.name} (${u.email}).`,
    });
  };

  const handleCopyPassword = (textToCopy: string, setCopiedState: (v: boolean) => void) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2500);
  };

  // ── Lifecycle Handlers ────────────────────────────────────────────────────
  const handleResendInvite = (u: User) => {
    addStoredAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Company Admin',
      actorEmail: user?.email || 'admin@nexus.com',
      action: 'INVITATION_RESENT',
      entityType: 'User',
      entityId: u.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Resent invitation email to ${u.name} (${u.email}).`,
    });
    showToast('success', `Invitation email resent to ${u.email}.`);
  };

  const handleRevokeInvite = (u: User) => {
    if (!window.confirm(`Revoke pending invitation for ${u.name} (${u.email})?`)) return;

    deleteStoredUser(u.id);

    addStoredAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Company Admin',
      actorEmail: user?.email || 'admin@nexus.com',
      action: 'INVITATION_REVOKED',
      entityType: 'User',
      entityId: u.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Revoked pending invitation for ${u.name} (${u.email}).`,
    });
    showToast('success', `Invitation for ${u.name} has been revoked.`);
  };

  const handleDeactivateUser = (u: User) => {
    if (!window.confirm(`Deactivate account for ${u.name}? They will lose active system access.`)) return;

    saveStoredUser({ ...u, status: 'Disabled' });

    addStoredAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Company Admin',
      actorEmail: user?.email || 'admin@nexus.com',
      action: 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: u.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Deactivated user account for ${u.name} (${u.email}).`,
    });
    showToast('success', `User account for ${u.name} has been deactivated.`);
  };

  const handleReactivateUser = (u: User) => {
    saveStoredUser({ ...u, status: 'Active' });

    addStoredAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Company Admin',
      actorEmail: user?.email || 'admin@nexus.com',
      action: 'USER_REACTIVATED',
      entityType: 'User',
      entityId: u.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Reactivated user account for ${u.name} (${u.email}).`,
    });
    showToast('success', `User account for ${u.name} reactivated.`);
  };

  const handleDeleteUser = (u: User) => {
    if (!window.confirm(`Permanently remove ${u.name} (${u.email}) from ${tenant?.name}? This cannot be undone.`)) return;

    deleteStoredUser(u.id);

    addStoredAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Company Admin',
      actorEmail: user?.email || 'admin@nexus.com',
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: u.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Deleted team member record for ${u.name} (${u.email}).`,
    });
    showToast('success', `User ${u.name} permanently removed.`);
  };

  // ── Filtered Dataset ──────────────────────────────────────────────────────
  const filteredUsersList = usersList.filter(u => {
    if (roleFilter !== 'all' && u.role.code !== roleFilter) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    return true;
  });

  // ── Table Columns ─────────────────────────────────────────────────────────
  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Team Member',
      sortable: true,
      render: u => (
        <div>
          <div className="company-user-name">{u.name}</div>
          <div className="company-user-email">{u.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Assigned Role',
      sortable: true,
      render: u => (
        <span className="company-user-role">{u.role.name}</span>
      ),
    },
    {
      key: 'designation',
      header: 'Designation / Title',
      render: u => (
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {u.designation || '—'}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Contact Phone',
      render: u => (
        <span style={{ fontSize: '13px' }}>{u.phone || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Account Status',
      sortable: true,
      render: u => <StatusChip status={u.status} size="sm" />,
    },
    {
      key: 'lastLogin',
      header: 'Last Active',
      sortable: true,
      render: u => (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {u.lastLogin || 'Never'}
        </span>
      ),
    },
  ];

  // ── Row Actions ───────────────────────────────────────────────────────────
  const rowActions: RowAction<User>[] = [
    {
      label: 'Edit Details',
      icon: <Edit2 size={14} color="var(--primary-600)" style={{ marginRight: 6 }} />,
      onClick: u => openEditModal(u),
    },
    {
      label: 'Reset Password',
      icon: <KeyRound size={14} color="#f59e0b" style={{ marginRight: 6 }} />,
      hidden: u => u.status === 'Invited',
      onClick: u => handleOpenResetPassword(u),
    },
    {
      label: 'Resend Invitation',
      icon: <Mail size={14} color="var(--primary-600)" style={{ marginRight: 6 }} />,
      hidden: u => u.status !== 'Invited',
      onClick: u => handleResendInvite(u),
    },
    {
      label: 'Revoke Invitation',
      icon: <XCircle size={14} color="#dc2626" style={{ marginRight: 6 }} />,
      hidden: u => u.status !== 'Invited',
      onClick: u => handleRevokeInvite(u),
    },
    {
      label: 'Deactivate User',
      icon: <UserX size={14} color="#dc2626" style={{ marginRight: 6 }} />,
      hidden: u => u.status !== 'Active',
      onClick: u => handleDeactivateUser(u),
    },
    {
      label: 'Reactivate User',
      icon: <UserCheck size={14} color="#059669" style={{ marginRight: 6 }} />,
      hidden: u => u.status !== 'Disabled',
      onClick: u => handleReactivateUser(u),
    },
    {
      label: 'Delete User',
      icon: <Trash2 size={14} color="#dc2626" style={{ marginRight: 6 }} />,
      hidden: u => u.id === user?.id || u.role.code === 'company_admin',
      onClick: u => handleDeleteUser(u),
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="company-users-page">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Users size={24} color="var(--primary-600)" /> Organization Users & Agents
          </h1>
          <p className="page-subtitle">
            Manage operational team accounts, roles (Sales Executives & IRMs), and security credentials for {tenant?.name}.
          </p>
        </div>

        <button
          id="btn-invite-member"
          className="btn btn-primary"
          onClick={handleOpenInvite}
        >
          <Plus size={15} /> Add Team Member
        </button>
      </div>

      {/* ── Fixed-position Toast (top-center) ────────────────────────────── */}
      {toast && (
        <>
          <style>{`
            @keyframes _cu-toast-in {
              from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
          <div
            style={{
              position: 'fixed',
              top: 'calc(var(--topbar-height, 64px) + 24px)',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1100,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${
                toast.type === 'success' ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'
              }`,
              backgroundColor:
                toast.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
              fontSize: 13,
              color: toast.type === 'success' ? '#047857' : '#b91c1c',
              fontWeight: 500,
              animation: '_cu-toast-in 0.2s ease both',
              width: 'fit-content',
              maxWidth: 480,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {toast.message}
          </div>
        </>
      )}

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <div className="company-users-filter-bar">
        <div className="company-users-filter-item">
          <label className="company-users-filter-label">Filter by Role:</label>
          <select
            className="form-select company-users-filter-select"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="sales_executive">Sales Executive</option>
            <option value="irm">Institutional Relationship Manager (IRM)</option>
            <option value="company_admin">Company Admin</option>
          </select>
        </div>

        <div className="company-users-filter-item">
          <label className="company-users-filter-label">Filter by Status:</label>
          <select
            className="form-select company-users-filter-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Invited">Invited</option>
            <option value="Disabled">Disabled</option>
          </select>
        </div>

        {(roleFilter !== 'all' || statusFilter !== 'all') && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setRoleFilter('all');
              setStatusFilter('all');
            }}
            style={{ alignSelf: 'flex-end', height: '36px' }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* ── Data Table ───────────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        data={filteredUsersList}
        keyExtractor={u => u.id}
        rowActions={rowActions}
        searchPlaceholder="Search team members by name, email, or designation..."
      />

      {/* ── Add / Invite Member Modal ────────────────────────────────────── */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title={generatedNewPassword ? 'Credentials Generated' : 'Add Team Member'}
        subtitle={
          generatedNewPassword
            ? `Share these temporary login credentials with ${inviteName}`
            : `Provision a new user account for ${tenant?.name}`
        }
      >
        {generatedNewPassword ? (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              The account for <strong>{inviteName}</strong> ({inviteEmail}) has been created with role{' '}
              <strong>{SYSTEM_ROLES[inviteRole]?.name}</strong>.
            </p>

            <div className="company-temp-password-box">
              <span className="company-temp-password-text">{generatedNewPassword}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleCopyPassword(generatedNewPassword, setHasCopiedNewPassword)}
              >
                {hasCopiedNewPassword ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                {hasCopiedNewPassword ? 'Copied!' : 'Copy Password'}
              </button>
            </div>

            <div className="company-user-modal-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsInviteModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateOrInvite} className="company-user-form">
            <div className="company-user-form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  id="invite-name"
                  type="text"
                  className="form-input"
                  required
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="e.g. Sumanth Hegde"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Corporate Email Address *</label>
                <input
                  id="invite-email"
                  type="email"
                  className={`form-input${inviteError ? ' is-invalid' : ''}`}
                  required
                  value={inviteEmail}
                  onChange={e => {
                    setInviteEmail(e.target.value);
                    if (inviteError) setInviteError(null);
                  }}
                  placeholder="sumanth@ghlindiatrust.com"
                />
              </div>
            </div>
            {inviteError && <div className="form-error">{inviteError}</div>}

            <div className="company-user-form-row">
              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={invitePhone}
                  onChange={e => setInvitePhone(e.target.value)}
                  placeholder="+91 98450 00000"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Designation / Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={inviteDesignation}
                  onChange={e => setInviteDesignation(e.target.value)}
                  placeholder="e.g. Senior Wealth Partner"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Assign Operational Role *</label>
              <select
                id="invite-role"
                className="form-select"
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as RoleCode)}
              >
                {assignableRoles.map(r => (
                  <option key={r.code} value={r.code}>
                    {r.name} {r.code === 'irm' ? '(Advisory & HNW)' : '(Field Rep / Telecaller)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Onboarding & Credential Mode</label>
              <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="creationMode"
                    value="invite"
                    checked={creationMode === 'invite'}
                    onChange={() => setCreationMode('invite')}
                  />
                  Send Email Invitation Link
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="creationMode"
                    value="instant_password"
                    checked={creationMode === 'instant_password'}
                    onChange={() => setCreationMode('instant_password')}
                  />
                  Generate Instant Temporary Password
                </label>
              </div>
            </div>

            <div className="company-user-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setIsInviteModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {creationMode === 'instant_password' ? 'Create & View Credentials' : 'Send Email Invitation'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Edit User Modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Edit Team Member Profile"
        subtitle={editingUser ? `Update profile details and role for ${editingUser.name}` : ''}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditingUser(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveEditUser}
            >
              Save Changes
            </button>
          </>
        }
      >
        {editingUser && (
          <div className="company-user-form">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Corporate Email (Read Only)</label>
              <input
                type="email"
                className="form-input"
                value={editingUser.email}
                disabled
                style={{ opacity: 0.7 }}
              />
            </div>

            <div className="company-user-form-row">
              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Designation / Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={editDesignation}
                  onChange={e => setEditDesignation(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Assigned Role</label>
              <select
                id="edit-user-role-select"
                className="form-select"
                value={editRoleCode}
                onChange={e => setEditRoleCode(e.target.value as RoleCode)}
              >
                {assignableRoles.map(r => (
                  <option key={r.code} value={r.code}>
                    {r.name} {r.code === 'irm' ? '(Advisory & HNW)' : '(Field Rep / Telecaller)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Reset Password Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={!!resettingUser}
        onClose={() => setResettingUser(null)}
        title="Reset Temporary Password"
        subtitle={
          resettingUser
            ? `New temporary credential generated for ${resettingUser.name} (${resettingUser.email})`
            : ''
        }
        footer={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setResettingUser(null)}
          >
            Done
          </button>
        }
      >
        {resettingUser && (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Provide this temporary password to <strong>{resettingUser.name}</strong>. They will be prompted to
              create a permanent password upon first login.
            </p>

            <div className="company-temp-password-box">
              <span className="company-temp-password-text">{tempPassword}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleCopyPassword(tempPassword, setHasCopiedTempPassword)}
              >
                {hasCopiedTempPassword ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                {hasCopiedTempPassword ? 'Copied!' : 'Copy Password'}
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
              This action has been securely recorded in the platform audit log.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};
