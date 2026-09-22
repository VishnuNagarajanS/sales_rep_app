import React, { useState, useEffect } from 'react';
import { Users, Shield } from 'lucide-react';
import { userStore } from '../../../services/secondaryStores';
import { DataTable, Column } from '../../../components/common/DataTable';
import { StatusChip } from '../../../components/common/StatusChip';
import { User } from '../../../types';
import './PlatformUsersPage.css';

export const PlatformUsersPage: React.FC = () => {
  const [usersList, setUsersList] = useState<User[]>(() => userStore.getUsers());

  useEffect(() => {
    const handleUpdate = () => setUsersList(userStore.getUsers());
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, []);
  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'User Name',
      sortable: true,
      render: u => (
        <div>
          <div className="platform-users-name">{u.name}</div>
          <div className="platform-users-email">{u.email}</div>
        </div>
      ),
    },
    {
      key: 'companyName',
      header: 'Tenant Organization',
      sortable: true,
      render: u => (
        <span className="platform-users-tenant">
          {u.companyName || 'Platform Console (Global)'}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role Code',
      render: u => (
        <span className="platform-users-role">{u.role.name}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: u => <StatusChip status={u.status} size="sm" />,
    },
    {
      key: 'lastLogin',
      header: 'Last Active',
    },
  ];

  return (
    <div className="platform-users-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Users size={24} color="#8b5cf6" /> Cross-Tenant Users & Agents
          </h1>
          <p className="page-subtitle">
            Platform-wide identity directory covering all tenant company organizations.
          </p>
        </div>
      </div>

      <div className="platform-users-table-container">
        <DataTable
          columns={columns}
          data={usersList}
          keyExtractor={u => u.id}
          searchPlaceholder="Search all platform users..."
        />
      </div>
    </div>
  );
};
