import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Shield,
  Mail,
  CheckCircle2,
  AlertCircle,
  XCircle,
  UserX,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SYSTEM_ROLES } from '../../constants/roles';
import { storageService } from '../../services/storageService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { User, RoleCode } from '../../types';
import './CompanyUsersPage.css';

export const CompanyUsersPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const [usersList, setUsersList] = useState<User[]>(() =>
    storageService.getUsers(tenant?.slug),
  );

  useEffect(() => {
    const handleUpdate = () => {
      setUsersList(storageService.getUsers(tenant?.slug));
    };
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.slug]);

  // ── Toast feedback ────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Assignable Tenant Roles ──────────────────────────────────────────────
  const assignableRoles = Object.values(SYSTEM_ROLES).filter(
    r => r.code !== 'super_admin' && r.code !== 'company_admin'
  );

  // ── Invite Modal State ────────────────────────────────────────────────────
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<RoleCode>('sales_executive');
  const [inviteError, setInviteError] = useState<string | null>(null);

  // ── Edit Role Modal State ─────────────────────────────────────────────────
  const [editingRoleUser, setEditingRoleUser] = useState<User | null>(null);
  const [newRoleCode, setNewRoleCode] = useState<RoleCode>('sales_executive');

  // ── Invite Handlers ───────────────────────────────────────────────────────
  const handleOpenInvite = () => {
    setInviteName('');
    setInviteEmail('');
    setInviteRole('sales_executive');
    setInviteError(null);
    setIsInviteModalOpen(true);
  };

  const handleInvite = (e: React.FormEvent) => {
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
      setInviteError(`A user or pending invitation with email "${trimmedEmail}" already exists.`);
      return;
    }

    const assignedRole = SYSTEM_ROLES[inviteRole] || SYSTEM_ROLES.sales_executive;
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: trimmedName,
      email: trimmedEmail,
      phone: '+91 98000 00000',
      role: assignedRole,
      companyId: tenant?.id,
      companySlug: tenant?.slug,
      companyName: tenant?.name,
      status: 'Invited',
      lastLogin: 'Never',
    };

    storageService.saveUser(newUser);

    // Audit log
    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Administrator',
      actorEmail: user?.email || 'admin@nexus.com',
      action: 'USER_INVITED',
      entityType: 'User',
      entityId: newUser.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Invited ${newUser.name} (${newUser.email}) as ${newUser.role.name}.`,
    });

    setIsInviteModalOpen(false);
    setInviteName('');
    setInviteEmail('');
    setInviteError(null);
    showToast('success', `Invitation sent to ${newUser.email}.`);
  };

  // ── Row Action Handlers ───────────────────────────────────────────────────
  const handleResendInvite = (u: User) => {
    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Administrator',
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

    storageService.deleteUser(u.id);

    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Administrator',
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
    if (
      !window.confirm(
        `Deactivate account for ${u.name}? They will no longer be able to access the system.`,
      )
    )
      return;

    storageService.saveUser({ ...u, status: 'Disabled' });

    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Administrator',
      actorEmail: user?.email || 'admin@nexus.com',
      action: 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: u.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Deactivated user account for ${u.name} (${u.email}).`,
    });
    showToast('success', `User account for ${u.name} deactivated.`);
  };

  const handleReactivateUser = (u: User) => {
    storageService.saveUser({ ...u, status: 'Active' });

    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Administrator',
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

  const openEditRoleModal = (u: User) => {
    setEditingRoleUser(u);
    setNewRoleCode(u.role.code);
  };

  const handleSaveRole = () => {
    if (!editingRoleUser) return;

    const newRole = SYSTEM_ROLES[newRoleCode] || SYSTEM_ROLES.sales_executive;
    const oldRole = editingRoleUser.role;

    storageService.saveUser({ ...editingRoleUser, role: newRole });

    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Administrator',
      actorEmail: user?.email || 'admin@nexus.com',
      action: 'USER_ROLE_CHANGED',
      entityType: 'User',
      entityId: editingRoleUser.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      beforeValue: { roleCode: oldRole.code, roleName: oldRole.name },
      afterValue: { roleCode: newRole.code, roleName: newRole.name },
      details: `Changed role for ${editingRoleUser.name} from ${oldRole.name} to ${newRole.name}.`,
    });

    showToast('success', `Updated role for ${editingRoleUser.name} to ${newRole.name}.`);
    setEditingRoleUser(null);
  };

  // ── Table Columns ─────────────────────────────────────────────────────────
  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'User Name & Email',
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
      key: 'phone',
      header: 'Contact',
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
    },
  ];

  // ── Row Actions ───────────────────────────────────────────────────────────
  const rowActions: RowAction<User>[] = [
    {
      label: 'Edit Role',
      icon: <Shield size={14} color="var(--primary-600)" style={{ marginRight: 6 }} />,
      onClick: u => openEditRoleModal(u),
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
      label: 'Deactivate',
      icon: <UserX size={14} color="#dc2626" style={{ marginRight: 6 }} />,
      hidden: u => u.status !== 'Active',
      onClick: u => handleDeactivateUser(u),
    },
    {
      label: 'Reactivate',
      icon: <UserCheck size={14} color="#059669" style={{ marginRight: 6 }} />,
      hidden: u => u.status !== 'Disabled',
      onClick: u => handleReactivateUser(u),
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="company-users-page">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Users size={24} color="var(--primary-600)" /> Organization Users & Agents
          </h1>
          <p className="page-subtitle">
            Manage agent accounts, RBAC roles, and invitation states for {tenant?.name}.
          </p>
        </div>

        <button
          id="btn-invite-member"
          className="btn btn-primary"
          onClick={handleOpenInvite}
        >
          <Plus size={15} /> Invite Team Member
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
                toast.type === 'success'
                  ? 'rgba(16,185,129,0.12)'
                  : 'rgba(239,68,68,0.12)',
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

      {/* ── Data Table ───────────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        data={usersList}
        keyExtractor={u => u.id}
        rowActions={rowActions}
        searchPlaceholder="Search users by name or email..."
      />

      {/* ── Invite Modal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite New Agent / Team Member"
        subtitle={`Send an email invitation link to join ${tenant?.name}`}
      >
        <form onSubmit={handleInvite} className="company-user-form">
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
              placeholder="sumanth@organization.com"
            />
            {inviteError && <div className="form-error">{inviteError}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Assign Role Privilege</label>
            <select
              id="invite-role"
              className="form-select"
              value={inviteRole}
              onChange={e =>
                setInviteRole(e.target.value as RoleCode)
              }
            >
              {assignableRoles.map(r => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="company-user-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsInviteModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Send Email Invitation
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Role Modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={!!editingRoleUser}
        onClose={() => setEditingRoleUser(null)}
        title="Edit Role Privilege"
        subtitle={
          editingRoleUser
            ? `Modify role and access permissions for ${editingRoleUser.name}`
            : ''
        }
        maxWidth={460}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditingRoleUser(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveRole}
            >
              Update Role
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Assigned Role</label>
          <select
            id="edit-user-role-select"
            className="form-select"
            value={newRoleCode}
            onChange={e =>
              setNewRoleCode(e.target.value as RoleCode)
            }
          >
            {assignableRoles.map(r => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
};
