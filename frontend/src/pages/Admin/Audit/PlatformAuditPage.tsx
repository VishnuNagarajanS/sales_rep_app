import React, { useState, useEffect } from 'react';
import { FileCheck, Shield } from 'lucide-react';
import { AuditLog } from '../../../types';
import { storageService } from '../../../services/storageService';
import { DataTable, Column } from '../../../components/common/DataTable';
import './PlatformAuditPage.css';

export const PlatformAuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    setLogs(storageService.getAuditLogs());
    const handleUpdate = () => setLogs(storageService.getAuditLogs());
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, []);

  const columns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      sortable: true,
      render: l => <span className="platform-audit-timestamp">{l.timestamp}</span>,
    },
    {
      key: 'companyName',
      header: 'Tenant Namespace',
      sortable: true,
      render: l => (
        <span className="platform-audit-tenant-name">
          {l.companyName || 'GLOBAL PLATFORM'}
        </span>
      ),
    },
    {
      key: 'actorName',
      header: 'Actor Identity',
      sortable: true,
      render: l => (
        <div>
          <div className="platform-audit-actor-name">{l.actorName}</div>
          <div className="platform-audit-actor-email">{l.actorEmail}</div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action Key',
      sortable: true,
      render: l => (
        <span className="platform-audit-action-tag">
          {l.action}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Event Description',
      render: l => <span className="platform-audit-desc">{l.details}</span>,
    },
  ];

  return (
    <div className="platform-audit-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FileCheck size={24} color="#8b5cf6" /> System-Wide Security Audit Logs
          </h1>
          <p className="page-subtitle">
            Cross-tenant immutable audit trail across tenant activations, calling dispositions, and plot reservations.
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        keyExtractor={l => l.id}
        searchPlaceholder="Filter cross-tenant audit events..."
      />
    </div>
  );
};
