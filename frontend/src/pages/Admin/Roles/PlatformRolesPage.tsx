import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Check,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Trash2,
  Power,
  Users,
  Key,
  Layers,
  Sparkles,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Role, PermissionGroup } from '../../../types';
import { superAdminService } from '../../../services/superAdminService';
import { useUnsavedChanges } from '../../../context/NavigationGuardContext';
import { Modal } from '../../../components/common/Modal';
import './PlatformRolesPage.css';

type RoleFilterType = 'all' | 'system' | 'custom' | 'active' | 'inactive';
type PageTabType = 'directory' | 'matrix';

export const PlatformRolesPage: React.FC = () => {
  // Navigation / View state
  const [activeTab, setActiveTab] = useState<PageTabType>('directory');

  // Core Data
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<RoleFilterType>('all');
  const [matrixGroupFilter, setMatrixGroupFilter] = useState('all');
  const [matrixSearchQuery, setMatrixSearchQuery] = useState('');
  const [hasUnsavedMatrixChanges, setHasUnsavedMatrixChanges] = useState(false);

  // Modal in-permissions search
  const [permModalSearch, setPermModalSearch] = useState('');

  // Create Role Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createIsActive, setCreateIsActive] = useState(true);
  const [createSelectedPermissions, setCreateSelectedPermissions] = useState<string[]>([]);
  const [createError, setCreateError] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [expandedCreateModules, setExpandedCreateModules] = useState<Record<string, boolean>>({});

  // Edit Role Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSelectedPermissions, setEditSelectedPermissions] = useState<string[]>([]);
  const [editError, setEditError] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [expandedEditModules, setExpandedEditModules] = useState<Record<string, boolean>>({});

  // Deactivate / Delete Confirmation Modals
  const [confirmToggleRole, setConfirmToggleRole] = useState<Role | null>(null);
  const [confirmDeleteRole, setConfirmDeleteRole] = useState<Role | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('');
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  // Unsaved changes check
  const isCreateDirty = isCreateModalOpen && (createName.trim() !== '' || createCode.trim() !== '');
  const isEditDirty = isEditModalOpen && !!editingRole && (
    editName !== editingRole.name ||
    editDescription !== (editingRole.description || '') ||
    editIsActive !== (editingRole.isActive !== false) ||
    JSON.stringify(editSelectedPermissions) !== JSON.stringify(editingRole.permissions || [])
  );

  useUnsavedChanges(
    hasUnsavedMatrixChanges || isCreateDirty || isEditDirty,
    'You have unsaved changes in role configurations or matrix permissions. Are you sure you want to leave?',
    'platform-roles-page'
  );

  // Auto-clear feedback
  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4500);
  };

  // Load roles & canonical permissions
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rolesMap, permGroups] = await Promise.all([
        superAdminService.fetchRolesFromApi(),
        superAdminService.getAvailablePermissionsApi(),
      ]);
      setRoles(rolesMap);
      setPermissionGroups(permGroups);

      // Default expand all modules
      const initialExpanded: Record<string, boolean> = {};
      permGroups.forEach(g => {
        initialExpanded[g.group] = true;
      });
      setExpandedCreateModules(initialExpanded);
      setExpandedEditModules(initialExpanded);
    } catch (err) {
      console.error('Failed to load roles or permissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleStorageChange = () => {
      loadData();
    };
    window.addEventListener('nexus_admin_updated', handleStorageChange);
    window.addEventListener('nexus_storage_updated', handleStorageChange);
    return () => {
      window.removeEventListener('nexus_admin_updated', handleStorageChange);
      window.removeEventListener('nexus_storage_updated', handleStorageChange);
    };
  }, []);

  // Compute dynamic roles list with live user counts
  const roleList: Role[] = useMemo(() => {
    return superAdminService.getRolesList();
  }, [roles]);

  // Filtered Roles for Table
  const filteredRoles = useMemo(() => {
    return roleList.filter(role => {
      if (typeFilter === 'system' && !role.isSystemRole) return false;
      if (typeFilter === 'custom' && role.isSystemRole) return false;
      if (typeFilter === 'active' && role.isActive === false) return false;
      if (typeFilter === 'inactive' && role.isActive !== false) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = role.name.toLowerCase().includes(q);
        const matchesCode = role.code.toLowerCase().includes(q);
        const matchesDesc = (role.description || '').toLowerCase().includes(q);
        return matchesName || matchesCode || matchesDesc;
      }
      return true;
    });
  }, [roleList, typeFilter, searchQuery]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = roleList.length;
    const system = roleList.filter(r => r.isSystemRole).length;
    const custom = roleList.filter(r => !r.isSystemRole).length;
    const totalUsers = roleList.reduce((acc, r) => acc + (r.usersCount || 0), 0);
    return { total, system, custom, totalUsers };
  }, [roleList]);

  // All distinct canonical permission keys
  const allPermissionKeys = useMemo(() => {
    const keys = new Set<string>();
    permissionGroups.forEach(g => {
      g.items.forEach(item => {
        keys.add(item.key);
      });
    });
    return Array.from(keys);
  }, [permissionGroups]);

  // Filtered groups based on search in modal
  const filteredGroupsForModal = useMemo(() => {
    if (!permModalSearch.trim()) return permissionGroups;
    const q = permModalSearch.toLowerCase().trim();
    return permissionGroups
      .map(g => ({
        ...g,
        items: g.items.filter(
          item =>
            item.label.toLowerCase().includes(q) ||
            item.key.toLowerCase().includes(q) ||
            (item.description && item.description.toLowerCase().includes(q))
        ),
      }))
      .filter(g => g.items.length > 0);
  }, [permissionGroups, permModalSearch]);

  // --------------------------------------------------------------------------
  // CREATE ROLE HANDLERS
  // --------------------------------------------------------------------------
  const openCreateModal = () => {
    setCreateName('');
    setCreateCode('');
    setCreateDescription('');
    setCreateIsActive(true);
    setCreateSelectedPermissions([
      'leads.view',
      'leads.create',
      'leads.edit',
      'calls.view',
      'reports.view',
      'dashboard.view',
    ]);
    setPermModalSearch('');
    setCreateError('');
    setIsCreateModalOpen(true);
  };

  const handleCreateNameChange = (name: string) => {
    setCreateName(name);
    const suggestedCode = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_');
    setCreateCode(suggestedCode);
  };

  const handleToggleCreatePermission = (permKey: string) => {
    setCreateSelectedPermissions(prev =>
      prev.includes(permKey) ? prev.filter(k => k !== permKey) : [...prev, permKey]
    );
  };

  const handleToggleModulePermissionsCreate = (group: PermissionGroup) => {
    const moduleKeys = group.items.map(item => item.key);
    const allSelected = moduleKeys.every(k => createSelectedPermissions.includes(k));

    if (allSelected) {
      setCreateSelectedPermissions(prev => prev.filter(k => !moduleKeys.includes(k)));
    } else {
      setCreateSelectedPermissions(prev => Array.from(new Set([...prev, ...moduleKeys])));
    }
  };

  const handleToggleSelectAllCreate = () => {
    if (createSelectedPermissions.length >= allPermissionKeys.length) {
      setCreateSelectedPermissions([]);
    } else {
      setCreateSelectedPermissions([...allPermissionKeys]);
    }
  };

  const handleToggleExpandAllCreate = () => {
    const anyCollapsed = permissionGroups.some(g => !expandedCreateModules[g.group]);
    const next: Record<string, boolean> = {};
    permissionGroups.forEach(g => {
      next[g.group] = anyCollapsed;
    });
    setExpandedCreateModules(next);
  };

  const handleSaveCreateRole = async () => {
    if (!createName.trim()) {
      setCreateError('Role Name is required.');
      return;
    }
    const cleanCode = createCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!cleanCode) {
      setCreateError('Role Code is required.');
      return;
    }

    const existing = roleList.find(
      r => r.code.toUpperCase() === cleanCode || r.name.toLowerCase() === createName.trim().toLowerCase()
    );
    if (existing) {
      setCreateError(`A role with name "${existing.name}" or code "${cleanCode}" already exists.`);
      return;
    }

    setIsSubmittingCreate(true);
    setCreateError('');
    try {
      const created = await superAdminService.createRoleApi({
        name: createName.trim(),
        code: cleanCode,
        description: createDescription.trim(),
        isActive: createIsActive,
        permissions: createSelectedPermissions,
      });

      setRoles(superAdminService.getRoles());
      setIsCreateModalOpen(false);
      showFeedback(`Role "${created.name}" created successfully. It is now active and assignable across the app.`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create role. Please verify inputs.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // --------------------------------------------------------------------------
  // EDIT ROLE HANDLERS
  // --------------------------------------------------------------------------
  const openEditModal = (role: Role) => {
    setEditingRole(role);
    setEditName(role.name);
    setEditDescription(role.description || '');
    setEditIsActive(role.isActive !== false);
    setEditSelectedPermissions([...(role.permissions || [])]);
    setPermModalSearch('');
    setEditError('');
    setIsEditModalOpen(true);
  };

  const handleToggleEditPermission = (permKey: string) => {
    setEditSelectedPermissions(prev =>
      prev.includes(permKey) ? prev.filter(k => k !== permKey) : [...prev, permKey]
    );
  };

  const handleToggleModulePermissionsEdit = (group: PermissionGroup) => {
    const moduleKeys = group.items.map(item => item.key);
    const allSelected = moduleKeys.every(k => editSelectedPermissions.includes(k));

    if (allSelected) {
      setEditSelectedPermissions(prev => prev.filter(k => !moduleKeys.includes(k)));
    } else {
      setEditSelectedPermissions(prev => Array.from(new Set([...prev, ...moduleKeys])));
    }
  };

  const handleToggleSelectAllEdit = () => {
    if (editSelectedPermissions.length >= allPermissionKeys.length) {
      setEditSelectedPermissions([]);
    } else {
      setEditSelectedPermissions([...allPermissionKeys]);
    }
  };

  const handleToggleExpandAllEdit = () => {
    const anyCollapsed = permissionGroups.some(g => !expandedEditModules[g.group]);
    const next: Record<string, boolean> = {};
    permissionGroups.forEach(g => {
      next[g.group] = anyCollapsed;
    });
    setExpandedEditModules(next);
  };

  const handleSaveEditRole = async () => {
    if (!editingRole) return;
    if (!editName.trim()) {
      setEditError('Role Name is required.');
      return;
    }

    setIsSubmittingEdit(true);
    setEditError('');
    try {
      const updated = await superAdminService.updateRoleApi(editingRole.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        isActive: editIsActive,
        permissions: editSelectedPermissions,
      });

      setRoles(superAdminService.getRoles());
      setIsEditModalOpen(false);
      showFeedback(`Role "${updated.name}" updated successfully. Permissions updated for assigned users.`);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update role.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // --------------------------------------------------------------------------
  // ACTIVATE / DEACTIVATE HANDLERS
  // --------------------------------------------------------------------------
  const requestToggleStatus = (role: Role) => {
    if (role.isSystemRole) {
      showFeedback('System roles are essential platform foundations and cannot be deactivated.', 'error');
      return;
    }
    setConfirmToggleRole(role);
  };

  const handleExecuteToggleStatus = async () => {
    if (!confirmToggleRole || isActionInProgress) return;
    setIsActionInProgress(true);
    const newStatus = !(confirmToggleRole.isActive !== false);
    try {
      await superAdminService.toggleRoleStatusApi(confirmToggleRole.id, newStatus);
      setRoles(superAdminService.getRoles());
      setConfirmToggleRole(null);
      showFeedback(`Role "${confirmToggleRole.name}" ${newStatus ? 'activated' : 'deactivated'} successfully.`);
    } catch (err: any) {
      showFeedback(err.message || 'Failed to toggle role status.', 'error');
    } finally {
      setIsActionInProgress(false);
    }
  };

  // --------------------------------------------------------------------------
  // DELETE HANDLERS
  // --------------------------------------------------------------------------
  const requestDeleteRole = (role: Role) => {
    if (role.isSystemRole) {
      showFeedback('Protected system roles cannot be deleted.', 'error');
      return;
    }
    if ((role.usersCount || 0) > 0) {
      setDeleteErrorMessage(
        `Cannot delete role "${role.name}". It currently has ${role.usersCount} active user(s) assigned. Please reassign those users to another role first.`
      );
    } else {
      setDeleteErrorMessage('');
    }
    setConfirmDeleteRole(role);
  };

  const handleExecuteDeleteRole = async () => {
    if (!confirmDeleteRole || deleteErrorMessage || isActionInProgress) return;
    setIsActionInProgress(true);
    try {
      await superAdminService.deleteRoleApi(confirmDeleteRole.id);
      setRoles(superAdminService.getRoles());
      setConfirmDeleteRole(null);
      showFeedback(`Custom role "${confirmDeleteRole.name}" removed successfully.`);
    } catch (err: any) {
      showFeedback(err.message || 'Failed to delete role.', 'error');
    } finally {
      setIsActionInProgress(false);
    }
  };

  // --------------------------------------------------------------------------
  // PERMISSION MATRIX TOGGLES
  // --------------------------------------------------------------------------
  const handleMatrixToggle = (roleCode: string, permKey: string) => {
    if (roleCode === 'super_admin') return;
    const current = roles[roleCode];
    if (!current) return;

    const perms = current.permissions || [];
    const updatedPerms = perms.includes(permKey)
      ? perms.filter(p => p !== permKey)
      : [...perms, permKey];

    const updatedRoles = {
      ...roles,
      [roleCode]: {
        ...current,
        permissions: updatedPerms,
      },
    };
    setRoles(updatedRoles);
    setHasUnsavedMatrixChanges(true);
  };

  const [isSavingMatrix, setIsSavingMatrix] = useState(false);

  const handleSaveMatrix = async () => {
    setIsSavingMatrix(true);
    try {
      const updates = Object.values(roles)
        .filter(r => r.code !== 'super_admin')
        .map(r => superAdminService.updateRoleApi(r.id, { permissions: r.permissions }));
      await Promise.all(updates);
      setHasUnsavedMatrixChanges(false);
      showFeedback('Matrix permissions committed and synchronized successfully.');
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to persist matrix permissions.', 'error');
    } finally {
      setIsSavingMatrix(false);
    }
  };

  // Filtered permission groups for Matrix
  const filteredMatrixGroups = useMemo(() => {
    return permissionGroups
      .filter(g => matrixGroupFilter === 'all' || g.group === matrixGroupFilter)
      .map(g => {
        if (!matrixSearchQuery.trim()) return g;
        const q = matrixSearchQuery.toLowerCase().trim();
        const filteredItems = g.items.filter(
          item =>
            item.label.toLowerCase().includes(q) ||
            item.key.toLowerCase().includes(q) ||
            (item.description && item.description.toLowerCase().includes(q))
        );
        return { ...g, items: filteredItems };
      })
      .filter(g => g.items.length > 0);
  }, [permissionGroups, matrixGroupFilter, matrixSearchQuery]);

  // Granted count calculations (safe against out-of-canonical bounds)
  const createGrantedCount = useMemo(() => {
    return createSelectedPermissions.filter(k => allPermissionKeys.includes(k)).length;
  }, [createSelectedPermissions, allPermissionKeys]);

  const editGrantedCount = useMemo(() => {
    return editSelectedPermissions.filter(k => allPermissionKeys.includes(k)).length;
  }, [editSelectedPermissions, allPermissionKeys]);

  const isAllCreateExpanded = permissionGroups.every(g => expandedCreateModules[g.group] !== false);
  const isAllEditExpanded = permissionGroups.every(g => expandedEditModules[g.group] !== false);

  return (
    <div className="platform-roles-page-container">
      {/* Page Header */}
      <div className="roles-page-header">
        <div>
          <h1 className="roles-page-title">Role Management</h1>
          <p className="roles-page-subtitle">
            Create and manage system roles, custom roles, and their permissions.
          </p>
        </div>

        <div className="roles-header-actions">
          {/* View Tab Switcher */}
          <div className="roles-tab-switcher">
            <button
              className={`roles-tab-btn ${activeTab === 'directory' ? 'active' : ''}`}
              onClick={() => setActiveTab('directory')}
            >
              <Users size={15} />
              Role Management
            </button>
            <button
              className={`roles-tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
              onClick={() => setActiveTab('matrix')}
            >
              <Layers size={15} />
              Permission Matrix
            </button>
          </div>

          {activeTab === 'directory' && (
            <button className="btn btn-primary btn-create-role" onClick={openCreateModal}>
              <Plus size={16} />
              Create Role
            </button>
          )}

          {activeTab === 'matrix' && (
            <button
              className={`btn btn-save-matrix ${hasUnsavedMatrixChanges ? 'dirty-pulse' : ''}`}
              disabled={isSavingMatrix || !hasUnsavedMatrixChanges}
              onClick={handleSaveMatrix}
            >
              <Check size={16} />
              {isSavingMatrix ? 'Saving Matrix...' : 'Save Matrix Changes'}
            </button>
          )}

          <button className="btn btn-secondary btn-icon-only" onClick={loadData} title="Refresh">
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div className={`roles-feedback-alert ${feedbackMsg.type} animate-fade-in`}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="roles-stats-grid">
        <div className="card roles-stat-card">
          <div className="stat-label">Total Platform Roles</div>
          <div className="stat-value text-blue">{stats.total}</div>
          <div className="stat-footnote">Active Roles</div>
        </div>

        <div className="card roles-stat-card">
          <div className="stat-label">System Roles</div>
          <div className="stat-value text-purple">{stats.system}</div>
          <div className="stat-footnote">Core protected roles</div>
        </div>

        <div className="card roles-stat-card">
          <div className="stat-label">Custom Roles</div>
          <div className="stat-value text-emerald">{stats.custom}</div>
          <div className="stat-footnote">Created by Super Admin</div>
        </div>

        <div className="card roles-stat-card">
          <div className="stat-label">Total Users Assigned</div>
          <div className="stat-value text-amber">{stats.totalUsers}</div>
          <div className="stat-footnote">Across all tenants</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ROLE MANAGEMENT DIRECTORY TABLE */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <div className="roles-directory-view animate-fade-in">
          {/* Filter & Search Bar */}
          <div className="card roles-filter-card">
            <div className="roles-search-box">
              <Search size={16} className="search-icon" />
              <input
                id="roles-search-input"
                name="searchQuery"
                type="text"
                className="roles-search-input"
                aria-label="Search roles by name, code, or description"
                placeholder="Search roles by name, code, or description..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="roles-filter-pills">
              <button
                className={`filter-pill ${typeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTypeFilter('all')}
              >
                All Roles ({roleList.length})
              </button>
              <button
                className={`filter-pill ${typeFilter === 'system' ? 'active' : ''}`}
                onClick={() => setTypeFilter('system')}
              >
                <Lock size={12} /> System Roles ({stats.system})
              </button>
              <button
                className={`filter-pill ${typeFilter === 'custom' ? 'active' : ''}`}
                onClick={() => setTypeFilter('custom')}
              >
                <Sparkles size={12} /> Custom Roles ({stats.custom})
              </button>
              <button
                className={`filter-pill ${typeFilter === 'active' ? 'active' : ''}`}
                onClick={() => setTypeFilter('active')}
              >
                Active
              </button>
              <button
                className={`filter-pill ${typeFilter === 'inactive' ? 'active' : ''}`}
                onClick={() => setTypeFilter('inactive')}
              >
                Inactive
              </button>
            </div>
          </div>

          {/* Role Management Table */}
          <div className="card roles-table-card">
            <div className="table-responsive">
              <table className="roles-management-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Role Code</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Users Assigned</th>
                    <th>Permissions</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && roleList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="table-empty-td">
                        <RefreshCw size={18} className="animate-spin" /> Loading roles...
                      </td>
                    </tr>
                  ) : filteredRoles.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="table-empty-td">
                        No roles match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRoles.map(role => {
                      const isSystem = role.isSystemRole;
                      const isActive = role.isActive !== false;

                      return (
                        <tr key={role.code} className="role-table-row">
                          {/* Role Name & Description */}
                          <td>
                            <div className="role-identity-cell">
                              <div className={`role-avatar-badge ${isSystem ? 'system' : 'custom'}`}>
                                {isSystem ? <Shield size={16} /> : <Sparkles size={16} />}
                              </div>
                              <div>
                                <div className="role-primary-name">
                                  {role.name}
                                  {isSystem && <span className="system-pill">System</span>}
                                </div>
                                <div className="role-secondary-desc">
                                  {role.description || (isSystem ? 'Canonical core system role' : 'Custom defined role')}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role Code */}
                          <td>
                            <code className="role-code-chip">{role.code}</code>
                          </td>

                          {/* Type */}
                          <td>
                            <span className={`role-type-badge ${isSystem ? 'system' : 'custom'}`}>
                              {isSystem ? 'System Role' : 'Custom Role'}
                            </span>
                          </td>

                          {/* Status */}
                          <td>
                            <span className={`role-status-badge ${isActive ? 'active' : 'inactive'}`}>
                              <span className="status-dot"></span>
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Users Assigned */}
                          <td>
                            <div className="role-users-count">
                              <Users size={14} className="text-muted" />
                              <span className="count-number">{role.usersCount ?? 0}</span>
                              <span className="count-label">Users</span>
                            </div>
                          </td>

                          {/* Permissions Count */}
                          <td>
                            <span className="role-perms-badge">
                              <Key size={13} />
                              {role.permissions?.length ?? 0} Permissions
                            </span>
                          </td>

                          {/* Created Date */}
                          <td>
                            <span className="role-created-date">
                              {role.createdAt
                                ? new Date(role.createdAt).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })
                                : 'System Default'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td>
                            <div className="role-actions-cell">
                              <button
                                className="action-btn edit"
                                title="Edit Role Details & Permissions"
                                onClick={() => openEditModal(role)}
                              >
                                <Edit2 size={14} />
                                <span>Edit</span>
                              </button>

                              {!isSystem && (
                                <button
                                  className={`action-btn toggle ${isActive ? 'deactivate' : 'activate'}`}
                                  title={isActive ? 'Deactivate Role' : 'Activate Role'}
                                  onClick={() => requestToggleStatus(role)}
                                >
                                  <Power size={14} />
                                </button>
                              )}

                              {!isSystem ? (
                                <button
                                  className="action-btn delete"
                                  title="Delete Custom Role"
                                  onClick={() => requestDeleteRole(role)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : (
                                <span className="action-btn-locked" title="Protected System Role">
                                  <Lock size={14} />
                                </span>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INTERACTIVE PERMISSION MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div className="roles-matrix-view animate-fade-in">
          <div className="card roles-filter-card">
            <div className="roles-search-box">
              <Search size={16} className="search-icon" />
              <input
                id="roles-matrix-search"
                name="matrixSearchQuery"
                type="text"
                className="roles-search-input"
                aria-label="Search permissions by name, key, or description"
                placeholder="Search permissions by name, key, or description..."
                value={matrixSearchQuery}
                onChange={e => setMatrixSearchQuery(e.target.value)}
              />
            </div>

            <select
              id="roles-matrix-group-filter"
              name="matrixGroupFilter"
              className="roles-group-select"
              aria-label="Filter by functional module"
              value={matrixGroupFilter}
              onChange={e => setMatrixGroupFilter(e.target.value)}
            >
              <option value="all">All Functional Modules ({permissionGroups.length})</option>
              {permissionGroups.map(g => (
                <option key={g.group} value={g.group}>
                  {g.group}
                </option>
              ))}
            </select>
          </div>

          <div className="card matrix-table-card">
            <div className="table-responsive">
              <table className="interactive-matrix-table">
                <thead>
                  <tr className="matrix-thead-tr">
                    <th className="matrix-th-perm">Functional Privilege & Scope</th>
                    {roleList.map(r => (
                      <th key={r.code} className="matrix-th-role">
                        <div className="th-role-name">{r.name}</div>
                        <div className="th-role-code">
                          <code>{r.code}</code>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMatrixGroups.map(group => (
                    <React.Fragment key={group.group}>
                      <tr className="matrix-group-row">
                        <td colSpan={roleList.length + 1} className="matrix-group-td">
                          ● {group.group.toUpperCase()}
                        </td>
                      </tr>

                      {group.items.map(item => (
                        <tr key={item.key} className="matrix-item-row">
                          <td className="matrix-item-name-col">
                            <div className="perm-label">{item.label}</div>
                            {item.description && <div className="perm-desc">{item.description}</div>}
                            <code className="perm-key">{item.key}</code>
                          </td>

                          {roleList.map(r => {
                            const isGranted = (r.permissions || []).includes(item.key);
                            const isSuperAdmin = r.code === 'super_admin';

                            return (
                              <td key={r.code} className="matrix-checkbox-cell">
                                <label htmlFor={`perm-matrix-${r.code}-${item.key}`} className={`matrix-toggle-label ${isSuperAdmin ? 'locked' : ''}`}>
                                  <input
                                    id={`perm-matrix-${r.code}-${item.key}`}
                                    name={`perm_${r.code}_${item.key}`}
                                    aria-label={`Permission ${item.label} for role ${r.name}`}
                                    type="checkbox"
                                    checked={isGranted || isSuperAdmin}
                                    disabled={isSuperAdmin}
                                    onChange={() => handleMatrixToggle(r.code, item.key)}
                                  />
                                  <span className={`toggle-check-box ${isGranted || isSuperAdmin ? 'checked' : ''}`}>
                                    {(isGranted || isSuperAdmin) && <Check size={12} />}
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE ROLE */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="⚡ Create New Role"
          size="xl"
          className="role-editor-modal"
          footer={
            <div className="role-modal-footer-dock">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isSubmittingCreate}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveCreateRole}
                disabled={isSubmittingCreate || !createName.trim() || !createCode.trim()}
              >
                {isSubmittingCreate ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" /> Saving Role...
                  </>
                ) : (
                  <>
                    <Plus size={15} /> Create Role
                  </>
                )}
              </button>
            </div>
          }
        >
          <div className="role-modal-container">
            <p className="modal-description-sub">
              Define a dynamic role and configure granular permissions. The role will immediately be available
              for user assignment and system access.
            </p>

            {createError && (
              <div className="role-modal-error animate-shake">
                <AlertCircle size={16} />
                <span>{createError}</span>
              </div>
            )}

            {/* General Info Grid */}
            <div className="role-form-grid">
              <div className="form-group">
                <label htmlFor="role-create-name" className="form-label required">Role Name</label>
                <input
                  id="role-create-name"
                  name="name"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Sales Team Lead"
                  value={createName}
                  onChange={e => handleCreateNameChange(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="role-create-code" className="form-label required">Role Code (Stable Identifier)</label>
                <input
                  id="role-create-code"
                  name="code"
                  type="text"
                  className="form-control font-mono"
                  placeholder="SALES_TEAM_LEAD"
                  value={createCode}
                  onChange={e => setCreateCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                />
                <span className="form-field-hint">
                  Auto-formatted uppercase identifier used for authorization.
                </span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="role-create-description" className="form-label">Role Description</label>
              <textarea
                id="role-create-description"
                name="description"
                className="form-control"
                rows={2}
                placeholder="Team lead responsible for managing sales representatives and assigned leads."
                value={createDescription}
                onChange={e => setCreateDescription(e.target.value)}
              />
            </div>

            <div className="form-group">
              <div className="form-label">Status</div>
              <div className="role-status-radio-group">
                <label htmlFor="role-create-status-active" className="radio-option">
                  <input
                    id="role-create-status-active"
                    type="radio"
                    name="createStatus"
                    checked={createIsActive}
                    onChange={() => setCreateIsActive(true)}
                  />
                  <span>Active (Assignable to users)</span>
                </label>
                <label htmlFor="role-create-status-inactive" className="radio-option">
                  <input
                    id="role-create-status-inactive"
                    type="radio"
                    name="createStatus"
                    checked={!createIsActive}
                    onChange={() => setCreateIsActive(false)}
                  />
                  <span>Inactive (Draft / Suspended)</span>
                </label>
              </div>
            </div>

            {/* Permissions Module Selector */}
            <div className="role-permissions-section">
              <div className="permissions-section-header">
                <div>
                  <h3 className="section-title">Role Permissions</h3>
                  <p className="section-sub">
                    {createGrantedCount} of {allPermissionKeys.length} permissions granted
                  </p>
                </div>

                <div className="permissions-header-controls">
                  <div className="permissions-filter-input-wrap">
                    <Search size={14} className="text-muted" />
                    <input
                      id="role-create-perm-filter"
                      name="permFilter"
                      type="text"
                      className="permissions-filter-input"
                      aria-label="Filter permissions"
                      placeholder="Filter permissions..."
                      value={permModalSearch}
                      onChange={e => setPermModalSearch(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleToggleExpandAllCreate}
                  >
                    {isAllCreateExpanded ? 'Collapse All' : 'Expand All'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleToggleSelectAllCreate}
                  >
                    {createSelectedPermissions.length >= allPermissionKeys.length
                      ? 'Deselect All'
                      : 'Select All Permissions'}
                  </button>
                </div>
              </div>

              {/* Grouped Permission Accordions (Fully Scrollable, Zero-Clipping) */}
              <div className="permission-modules-accordion">
                {filteredGroupsForModal.map(group => {
                  const moduleKeys = group.items.map(i => i.key);
                  const selectedInModule = moduleKeys.filter(k => createSelectedPermissions.includes(k));
                  const isAllModuleSelected =
                    moduleKeys.length > 0 && selectedInModule.length === moduleKeys.length;
                  const isExpanded = expandedCreateModules[group.group] !== false;

                  return (
                    <div key={group.group} className="module-group-card">
                      <div
                        className="module-group-header"
                        onClick={() =>
                          setExpandedCreateModules(prev => ({
                            ...prev,
                            [group.group]: !isExpanded,
                          }))
                        }
                      >
                        <div className="module-header-left">
                          <button
                            type="button"
                            className="module-expand-btn"
                            onClick={e => {
                              e.stopPropagation();
                              setExpandedCreateModules(prev => ({
                                ...prev,
                                [group.group]: !isExpanded,
                              }));
                            }}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <span className="module-group-name">{group.group}</span>
                          <span className="module-count-badge">
                            {selectedInModule.length}/{moduleKeys.length}
                          </span>
                        </div>

                        <div className="module-header-right" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => handleToggleModulePermissionsCreate(group)}
                          >
                            {isAllModuleSelected ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="module-permissions-grid animate-fade-in">
                          {group.items.map(item => {
                            const isChecked = createSelectedPermissions.includes(item.key);
                            return (
                              <label key={item.key} htmlFor={`role-create-perm-${item.key}`} className={`perm-checkbox-item ${isChecked ? 'checked' : ''}`}>
                                <input
                                  id={`role-create-perm-${item.key}`}
                                  name={`perm_${item.key}`}
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleCreatePermission(item.key)}
                                />
                                <div className="perm-item-content">
                                  <div className="perm-item-title">{item.label}</div>
                                  {item.description && (
                                    <div className="perm-item-desc">{item.description}</div>
                                  )}
                                  <code className="perm-item-code">{item.key}</code>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT ROLE */}
      {/* ========================================================================= */}
      {isEditModalOpen && editingRole && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Edit Role: ${editingRole.name}`}
          size="xl"
          className="role-editor-modal"
          footer={
            <div className="role-modal-footer-dock">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmittingEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-save-role"
                onClick={handleSaveEditRole}
                disabled={isSubmittingEdit || !editName.trim()}
              >
                {isSubmittingEdit ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" /> Saving Changes...
                  </>
                ) : (
                  <>
                    <Check size={16} /> Save Role Changes
                  </>
                )}
              </button>
            </div>
          }
        >
          <div className="role-modal-container">
            <p className="modal-description-sub">
              Update role display name, operational description, and granular permission rights.
              {editingRole.isSystemRole && (
                <span className="system-role-notice">
                  {' '}(This is a protected system role. Identity code and system status are locked.)
                </span>
              )}
            </p>

            {editError && (
              <div className="role-modal-error animate-shake">
                <AlertCircle size={16} />
                <span>{editError}</span>
              </div>
            )}

            {/* General Info Grid */}
            <div className="role-form-grid">
              <div className="form-group">
                <label htmlFor="role-edit-name" className="form-label required">Role Name</label>
                <input
                  id="role-edit-name"
                  name="name"
                  type="text"
                  className="form-control"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  disabled={editingRole.isSystemRole}
                />
              </div>

              <div className="form-group">
                <label htmlFor="role-edit-code" className="form-label">Role Code (Immutable)</label>
                <div className="input-locked-group">
                  <input
                    id="role-edit-code"
                    name="code"
                    type="text"
                    className="form-control font-mono"
                    value={editingRole.code}
                    disabled
                  />
                  <Lock size={14} className="lock-icon" />
                </div>
                <span className="form-field-hint">Role codes are immutable stable identifiers.</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="role-edit-description" className="form-label">Role Description</label>
              <textarea
                id="role-edit-description"
                name="description"
                className="form-control"
                rows={2}
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
              />
            </div>

            {!editingRole.isSystemRole && (
              <div className="form-group">
                <div className="form-label">Status</div>
                <div className="role-status-radio-group">
                  <label htmlFor="role-edit-status-active" className="radio-option">
                    <input
                      id="role-edit-status-active"
                      type="radio"
                      name="editStatus"
                      checked={editIsActive}
                      onChange={() => setEditIsActive(true)}
                    />
                    <span>Active (Assignable to users)</span>
                  </label>
                  <label htmlFor="role-edit-status-inactive" className="radio-option">
                    <input
                      id="role-edit-status-inactive"
                      type="radio"
                      name="editStatus"
                      checked={!editIsActive}
                      onChange={() => setEditIsActive(false)}
                    />
                    <span>Inactive (Draft / Suspended)</span>
                  </label>
                </div>
              </div>
            )}

            {/* Permissions Module Selector */}
            <div className="role-permissions-section">
              <div className="permissions-section-header">
                <div>
                  <h3 className="section-title">Role Permissions</h3>
                  <p className="section-sub">
                    {editGrantedCount} of {allPermissionKeys.length} permissions granted
                  </p>
                </div>

                <div className="permissions-header-controls">
                  <div className="permissions-filter-input-wrap">
                    <Search size={14} className="text-muted" />
                    <input
                      id="role-edit-perm-filter"
                      name="permFilter"
                      type="text"
                      className="permissions-filter-input"
                      aria-label="Filter permissions"
                      placeholder="Filter permissions..."
                      value={permModalSearch}
                      onChange={e => setPermModalSearch(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleToggleExpandAllEdit}
                  >
                    {isAllEditExpanded ? 'Collapse All' : 'Expand All'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleToggleSelectAllEdit}
                  >
                    {editSelectedPermissions.length >= allPermissionKeys.length
                      ? 'Deselect All'
                      : 'Select All Permissions'}
                  </button>
                </div>
              </div>

              {/* Grouped Permission Accordions */}
              <div className="permission-modules-accordion">
                {filteredGroupsForModal.map(group => {
                  const moduleKeys = group.items.map(i => i.key);
                  const selectedInModule = moduleKeys.filter(k => editSelectedPermissions.includes(k));
                  const isAllModuleSelected =
                    moduleKeys.length > 0 && selectedInModule.length === moduleKeys.length;
                  const isExpanded = expandedEditModules[group.group] !== false;

                  return (
                    <div key={group.group} className="module-group-card">
                      <div
                        className="module-group-header"
                        onClick={() =>
                          setExpandedEditModules(prev => ({
                            ...prev,
                            [group.group]: !isExpanded,
                          }))
                        }
                      >
                        <div className="module-header-left">
                          <button
                            type="button"
                            className="module-expand-btn"
                            onClick={e => {
                              e.stopPropagation();
                              setExpandedEditModules(prev => ({
                                ...prev,
                                [group.group]: !isExpanded,
                              }));
                            }}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <span className="module-group-name">{group.group}</span>
                          <span className="module-count-badge">
                            {selectedInModule.length}/{moduleKeys.length}
                          </span>
                        </div>

                        <div className="module-header-right" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => handleToggleModulePermissionsEdit(group)}
                          >
                            {isAllModuleSelected ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="module-permissions-grid animate-fade-in">
                          {group.items.map(item => {
                            const isChecked = editSelectedPermissions.includes(item.key);
                            return (
                              <label key={item.key} htmlFor={`role-edit-perm-${item.key}`} className={`perm-checkbox-item ${isChecked ? 'checked' : ''}`}>
                                <input
                                  id={`role-edit-perm-${item.key}`}
                                  name={`edit_perm_${item.key}`}
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleEditPermission(item.key)}
                                />
                                <div className="perm-item-content">
                                  <div className="perm-item-title">{item.label}</div>
                                  {item.description && (
                                    <div className="perm-item-desc">{item.description}</div>
                                  )}
                                  <code className="perm-item-code">{item.key}</code>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TOGGLE STATUS CONFIRMATION */}
      {/* ========================================================================= */}
      {confirmToggleRole && (
        <Modal
          isOpen={!!confirmToggleRole}
          onClose={() => setConfirmToggleRole(null)}
          title={
            confirmToggleRole.isActive !== false
              ? `Deactivate Role "${confirmToggleRole.name}"?`
              : `Activate Role "${confirmToggleRole.name}"?`
          }
          size="sm"
        >
          <div className="confirm-modal-body">
            <p>
              {confirmToggleRole.isActive !== false ? (
                <>
                  Are you sure you want to <strong>deactivate</strong> this role? Deactivated roles cannot be
                  assigned to new users. Existing assigned users will retain safe access until reassigned.
                </>
              ) : (
                <>
                  Are you sure you want to <strong>activate</strong> this role? It will immediately become
                  assignable in user creation and editing forms.
                </>
              )}
            </p>
            <div className="confirm-modal-footer">
              <button className="btn btn-ghost" disabled={isActionInProgress} onClick={() => setConfirmToggleRole(null)}>
                Cancel
              </button>
              <button
                className={`btn ${confirmToggleRole.isActive !== false ? 'btn-danger' : 'btn-primary'}`}
                disabled={isActionInProgress}
                onClick={handleExecuteToggleStatus}
              >
                {isActionInProgress
                  ? 'Updating...'
                  : (confirmToggleRole.isActive !== false ? 'Deactivate Role' : 'Activate Role')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE ROLE CONFIRMATION */}
      {/* ========================================================================= */}
      {confirmDeleteRole && (
        <Modal
          isOpen={!!confirmDeleteRole}
          onClose={() => setConfirmDeleteRole(null)}
          title={`Delete Role: ${confirmDeleteRole.name}`}
          size="sm"
        >
          <div className="confirm-modal-body">
            {deleteErrorMessage ? (
              <div className="role-modal-error" style={{ marginBottom: 16 }}>
                <AlertTriangle size={18} />
                <span>{deleteErrorMessage}</span>
              </div>
            ) : (
              <p>
                Are you sure you want to permanently delete custom role{' '}
                <strong>"{confirmDeleteRole.name}"</strong> (<code>{confirmDeleteRole.code}</code>)?
                This action is irreversible.
              </p>
            )}

            <div className="confirm-modal-footer">
              <button className="btn btn-ghost" disabled={isActionInProgress} onClick={() => setConfirmDeleteRole(null)}>
                {deleteErrorMessage ? 'Close' : 'Cancel'}
              </button>
              {!deleteErrorMessage && (
                <button className="btn btn-danger" disabled={isActionInProgress} onClick={handleExecuteDeleteRole}>
                  <Trash2 size={14} /> {isActionInProgress ? 'Deleting...' : 'Delete Role'}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
