import React, { useState, useEffect } from 'react';
import { FileCheck, Download, Filter, Shield } from 'lucide-react';
import { AuditLog } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';
import { DataTable, Column } from '../../components/common/DataTable';
import './CompanyAuditPage.css';

export const CompanyAuditPage: React.FC = () => {
  const { tenant } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    setLogs(storageService.getAuditLogs(tenant?.id));
    const handleUpdate = () => setLogs(storageService.getAuditLogs(tenant?.id));
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  const columns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      sortable: true,
      render: l => <span className="company-audit-cell-timestamp">{l.timestamp}</span>,
    },
    {
      key: 'actorName',
      header: 'Actor',
      sortable: true,
      render: l => (
        <div>
          <div className="company-audit-actor-name">{l.actorName}</div>
          <div className="company-audit-actor-email">{l.actorEmail}</div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Event Action',
      sortable: true,
      render: l => (
        <span className="company-audit-action-tag">
          {l.action}
        </span>
      ),
    },
    {
      key: 'entityType',
      header: 'Target Entity',
      render: l => (
        <span className="company-audit-entity-text">
          {l.entityType} ({l.entityId})
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Audit Trail Details',
      render: l => <span className="company-audit-details-text">{l.details}</span>,
    },
  ];

  return (
    <div className="company-audit-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FileCheck size={24} color="var(--primary-600)" /> Security & Audit Log
          </h1>
          <p className="page-subtitle">
            Immutable traceability ledger for data mutations, call dispositions, and plot reservations for {tenant?.name}.
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        keyExtractor={l => l.id}
        searchPlaceholder="Search audit events by actor or action..."
      />
    </div>
  );
};
