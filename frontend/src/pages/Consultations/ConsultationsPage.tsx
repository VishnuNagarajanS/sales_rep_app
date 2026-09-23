import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Phone,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  UserX,
  XCircle,
} from 'lucide-react';
import { Consultation, Investor } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { FilterBar } from '../../components/common/FilterBar';
import { Modal } from '../../components/common/Modal';
import './ConsultationsPage.css';

// ─── Status Options ─────────────────────────────────────────────────────────
const STATUS_OPTIONS: { value: Consultation['status']; label: string }[] = [
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Rescheduled', label: 'Rescheduled' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'No-show', label: 'No-show' },
];

const filterStatusOptions = STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label }));

// ─── Form State Shape ───────────────────────────────────────────────────────
interface ConsultationForm {
  investorId: string;
  investorName: string;
  investorPhone: string;
  scheduledAt: string;
  consultantId: string;
  consultantName: string;
  status: Consultation['status'];
  agenda: string;
  outcomeNotes: string;
}

const BLANK_FORM: ConsultationForm = {
  investorId: '',
  investorName: '',
  investorPhone: '',
  scheduledAt: '',
  consultantId: '',
  consultantName: '',
  status: 'Scheduled',
  agenda: '',
  outcomeNotes: '',
};

// ─── Component ───────────────────────────────────────────────────────────────
export const ConsultationsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  // ── Role scoping ──────────────────────────────────────────────────────────
  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';

  // ── Core data ─────────────────────────────────────────────────────────────
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('All');
  const [consultantFilter, setConsultantFilter] = useState('All');

  // ── Create / Edit / Reschedule Modal ──────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<Consultation | null>(null);
  const [isRescheduleMode, setIsRescheduleMode] = useState(false);
  const [form, setForm] = useState<ConsultationForm>(BLANK_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ConsultationForm, string>>>({});

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = () => {
    setConsultations(storageService.getConsultations(tenant?.id));
    setInvestors(storageService.getInvestors(tenant?.id));
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  // ── Role-based scoping ────────────────────────────────────────────────────
  const scopedConsultations = isExec
    ? consultations.filter(
      c =>
        (c.consultantId && c.consultantId === user?.id) ||
        (c.consultantName && c.consultantName === user?.name),
    )
    : consultations;

  // ── Filter options ────────────────────────────────────────────────────────
  const consultantOptions = Array.from(
    new Set(scopedConsultations.map(c => c.consultantName)),
  )
    .filter(Boolean)
    .map(name => ({ value: name, label: name }));

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredConsultations = scopedConsultations.filter(c => {
    if (statusFilter !== 'All' && c.status !== statusFilter) return false;
    if (consultantFilter !== 'All' && c.consultantName !== consultantFilter) return false;
    return true;
  });

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingConsultation(null);
    setIsRescheduleMode(false);
    setForm({
      ...BLANK_FORM,
      scheduledAt: 'This Friday, 03:00 PM',
      agenda: 'Commercial REIT yield analysis & pass-through taxation discussion.',
      consultantId: user?.id ?? '',
      consultantName: user?.name ?? 'Advisor',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (c: Consultation) => {
    setEditingConsultation(c);
    setIsRescheduleMode(false);
    setForm({
      investorId: c.investorId,
      investorName: c.investorName,
      investorPhone: c.investorPhone,
      scheduledAt: c.scheduledAt,
      consultantId: c.consultantId,
      consultantName: c.consultantName,
      status: c.status,
      agenda: c.agenda || '',
      outcomeNotes: c.outcomeNotes || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openRescheduleModal = (c: Consultation) => {
    setEditingConsultation(c);
    setIsRescheduleMode(true);
    setForm({
      investorId: c.investorId,
      investorName: c.investorName,
      investorPhone: c.investorPhone,
      scheduledAt: c.scheduledAt,
      consultantId: c.consultantId,
      consultantName: c.consultantName,
      status: 'Rescheduled',
      agenda: c.agenda || '',
      outcomeNotes: c.outcomeNotes || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingConsultation(null);
    setIsRescheduleMode(false);
    setForm(BLANK_FORM);
    setFormErrors({});
  };

  const setField = <K extends keyof ConsultationForm>(key: K, value: ConsultationForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (formErrors[key]) setFormErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleSaveConsultation = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const errors: Partial<Record<keyof ConsultationForm, string>> = {};
    if (!form.investorId) errors.investorId = 'Please select an investor.';
    if (!form.scheduledAt.trim()) errors.scheduledAt = 'Consultation slot is required.';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const isEdit = !!editingConsultation;
    const cons: Consultation = {
      id: editingConsultation ? editingConsultation.id : `cns-${Date.now()}`,
      companyId: tenant?.id || 't-ghl-01',
      investorId: form.investorId,
      investorName: form.investorName,
      investorPhone: form.investorPhone,
      scheduledAt: form.scheduledAt.trim(),
      consultantId: form.consultantId.trim() || (user?.id ?? 'usr-admin'),
      consultantName: form.consultantName.trim() || (user?.name ?? 'Advisor'),
      status: form.status,
      agenda: form.agenda.trim(),
      outcomeNotes: form.outcomeNotes.trim() || undefined,
    };

    storageService.saveConsultation(cons);

    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Advisor',
      actorEmail: user?.email || 'advisor@ghl.com',
      action: isEdit
        ? isRescheduleMode
          ? 'CONSULTATION_RESCHEDULED'
          : 'CONSULTATION_UPDATED'
        : 'CONSULTATION_SCHEDULED',
      entityType: 'Consultation',
      entityId: cons.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: isEdit
        ? isRescheduleMode
          ? `Rescheduled consultation with ${cons.investorName} to ${cons.scheduledAt}.`
          : `Updated consultation with ${cons.investorName} (Status: ${cons.status}).`
        : `Scheduled wealth advisory consultation with ${cons.investorName}.`,
    });

    closeModal();
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: Column<Consultation>[] = [
    {
      key: 'scheduledAt',
      header: 'Session Slot',
      sortable: true,
      render: c => (
        <div>
          <div className="consultation-slot-title">{c.scheduledAt}</div>
          <div className="consultation-slot-id">ID: {c.id}</div>
        </div>
      ),
    },
    {
      key: 'investorName',
      header: 'Investor Profile',
      sortable: true,
      render: c => (
        <div>
          <div className="consultation-client-name">{c.investorName}</div>
          <div className="consultation-client-phone">{c.investorPhone}</div>
        </div>
      ),
    },
    {
      key: 'agenda',
      header: 'Advisory Agenda & Scope',
      render: c => (
        <div>
          <span className="consultation-agenda-text">{c.agenda}</span>
          {c.outcomeNotes && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                marginTop: 4,
              }}
            >
              <strong>Outcome:</strong> {c.outcomeNotes}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'consultantName',
      header: 'Private Wealth Advisor',
      render: c => <span className="consultation-advisor-name">{c.consultantName}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: c => <StatusChip status={c.status} size="sm" />,
    },
  ];

  // ── Row actions ───────────────────────────────────────────────────────────
  const rowActions: RowAction<Consultation>[] = [
    {
      label: 'Call Investor',
      icon: <Phone size={14} color="#059669" style={{ marginRight: 6 }} />,
      onClick: c => initiateCall(c.investorName, c.investorPhone, 'customer', c.investorId),
    },
    {
      label: 'Edit',
      icon: <Edit2 size={14} color="var(--primary-600)" style={{ marginRight: 6 }} />,
      onClick: c => openEditModal(c),
    },
    {
      label: 'Reschedule',
      icon: <Clock size={14} color="#d97706" style={{ marginRight: 6 }} />,
      hidden: c => c.status === 'Completed' || c.status === 'Cancelled',
      onClick: c => openRescheduleModal(c),
    },
    {
      label: 'Mark Completed',
      icon: <CheckCircle size={14} color="#2563eb" style={{ marginRight: 6 }} />,
      hidden: c => c.status === 'Completed' || c.status === 'Cancelled',
      onClick: c => {
        storageService.saveConsultation({ ...c, status: 'Completed' });
        storageService.addAuditLog({
          id: `aud-${Date.now()}`,
          timestamp: 'Just now',
          actorName: user?.name || 'Advisor',
          actorEmail: user?.email || 'advisor@ghl.com',
          action: 'CONSULTATION_COMPLETED',
          entityType: 'Consultation',
          entityId: c.id,
          companyId: tenant?.id,
          companyName: tenant?.name,
          details: `Marked consultation with ${c.investorName} as Completed.`,
        });
      },
    },
    {
      label: 'Mark No-show',
      icon: <UserX size={14} color="#ea580c" style={{ marginRight: 6 }} />,
      hidden: c =>
        c.status === 'Completed' || c.status === 'Cancelled' || c.status === 'No-show',
      onClick: c => {
        storageService.saveConsultation({ ...c, status: 'No-show' });
        storageService.addAuditLog({
          id: `aud-${Date.now()}`,
          timestamp: 'Just now',
          actorName: user?.name || 'Advisor',
          actorEmail: user?.email || 'advisor@ghl.com',
          action: 'CONSULTATION_NO_SHOW',
          entityType: 'Consultation',
          entityId: c.id,
          companyId: tenant?.id,
          companyName: tenant?.name,
          details: `Marked consultation with ${c.investorName} as No-show.`,
        });
      },
    },
    {
      label: 'Cancel',
      icon: <XCircle size={14} color="#dc2626" style={{ marginRight: 6 }} />,
      hidden: c => c.status === 'Completed' || c.status === 'Cancelled',
      onClick: c => {
        if (window.confirm(`Cancel consultation with ${c.investorName}?`)) {
          storageService.saveConsultation({ ...c, status: 'Cancelled' });
          storageService.addAuditLog({
            id: `aud-${Date.now()}`,
            timestamp: 'Just now',
            actorName: user?.name || 'Advisor',
            actorEmail: user?.email || 'advisor@ghl.com',
            action: 'CONSULTATION_CANCELLED',
            entityType: 'Consultation',
            entityId: c.id,
            companyId: tenant?.id,
            companyName: tenant?.name,
            details: `Cancelled consultation with ${c.investorName}.`,
          });
        }
      },
    },
    {
      label: 'Delete',
      icon: <Trash2 size={14} color="#dc2626" style={{ marginRight: 6 }} />,
      onClick: c => {
        if (
          window.confirm(
            `Delete consultation with ${c.investorName}? This cannot be undone.`,
          )
        ) {
          storageService.deleteConsultation(c.id);
          storageService.addAuditLog({
            id: `aud-${Date.now()}`,
            timestamp: 'Just now',
            actorName: user?.name || 'Advisor',
            actorEmail: user?.email || 'advisor@ghl.com',
            action: 'CONSULTATION_DELETED',
            entityType: 'Consultation',
            entityId: c.id,
            companyId: tenant?.id,
            companyName: tenant?.name,
            details: `Deleted consultation record with ${c.investorName}.`,
          });
        }
      },
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="consultations-page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Calendar size={24} color="#0284c7" /> Wealth Advisory Consultations
          </h1>
          <p className="page-subtitle">
            1-on-1 private advisory sessions, term sheet reviews, and mandate agreements for{' '}
            {tenant?.name}.
          </p>
        </div>

        <button
          id="consultations-schedule-btn"
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          onClick={openCreateModal}
        >
          <Plus size={15} /> Schedule Consultation
        </button>
      </div>

      {/* ── Data table ───────────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        data={filteredConsultations}
        keyExtractor={c => c.id}
        rowActions={rowActions}
        onRowClick={c => openEditModal(c)}
        searchPlaceholder="Search consultations by investor or agenda..."
        filtersNode={
          <FilterBar
            filters={[
              {
                key: 'status',
                label: 'Status',
                value: statusFilter,
                onChange: setStatusFilter,
                options: filterStatusOptions,
              },
              {
                key: 'consultant',
                label: 'Consultant',
                value: consultantFilter,
                onChange: setConsultantFilter,
                options: consultantOptions,
              },
            ]}
            onClearAll={() => {
              setStatusFilter('All');
              setConsultantFilter('All');
            }}
          />
        }
      />

      {/* ── Schedule / Edit / Reschedule Consultation Modal ──────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          isRescheduleMode
            ? 'Reschedule Consultation'
            : editingConsultation
              ? 'Edit Consultation'
              : 'Schedule Private Wealth Advisory Consultation'
        }
        subtitle={
          isRescheduleMode
            ? `Reschedule advisory slot for ${form.investorName || 'client'}`
            : editingConsultation
              ? `Update advisory session details for ${form.investorName || 'client'}`
              : 'Book an advisory slot with a high-net-worth client'
        }
        maxWidth={620}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSaveConsultation()}
            >
              {isRescheduleMode
                ? 'Save Reschedule'
                : editingConsultation
                  ? 'Update Consultation'
                  : 'Confirm Advisory Slot'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveConsultation} className="consultation-form">
          {/* Investor Dropdown */}
          <div className="form-group">
            <label className="form-label">Investor *</label>
            <select
              id="consultation-form-investor"
              className={`form-select${formErrors.investorId ? ' is-invalid' : ''}`}
              value={form.investorId}
              onChange={e => {
                const inv = investors.find(i => i.id === e.target.value);
                setField('investorId', e.target.value);
                setField('investorName', inv?.name ?? '');
                setField('investorPhone', inv?.phone ?? '');
              }}
            >
              <option value="">— Select Investor —</option>
              {form.investorId && !investors.some(i => i.id === form.investorId) && (
                <option value={form.investorId}>
                  {form.investorName || form.investorId} (Current)
                </option>
              )}
              {investors.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.name} {inv.phone ? `(${inv.phone})` : ''}
                </option>
              ))}
            </select>
            {formErrors.investorId && (
              <div className="form-error">{formErrors.investorId}</div>
            )}
          </div>

          <div className="consultation-form-grid-2">
            <div className="form-group">
              <label className="form-label">Investor Phone</label>
              <input
                id="consultation-form-phone"
                type="text"
                className="form-input"
                placeholder="+91 98800 00000"
                value={form.investorPhone}
                onChange={e => setField('investorPhone', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Consultation Slot *</label>
              <input
                id="consultation-form-slot"
                type="text"
                className={`form-input${formErrors.scheduledAt ? ' is-invalid' : ''}`}
                placeholder="e.g. Thursday, 04:00 PM"
                value={form.scheduledAt}
                onChange={e => setField('scheduledAt', e.target.value)}
              />
              {formErrors.scheduledAt && (
                <div className="form-error">{formErrors.scheduledAt}</div>
              )}
            </div>
          </div>

          {/* Row: Advisor / Consultant & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">
                Private Wealth Advisor
                {isExec && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      fontWeight: 400,
                    }}
                  >
                    (auto-assigned to you)
                  </span>
                )}
              </label>
              {isExec ? (
                <input
                  className="form-input"
                  value={form.consultantName}
                  readOnly
                  style={{
                    backgroundColor: 'var(--bg-surface-hover)',
                    cursor: 'not-allowed',
                    color: 'var(--text-secondary)',
                  }}
                />
              ) : (
                <input
                  id="consultation-form-consultant"
                  className="form-input"
                  placeholder="e.g. Vikram Malhotra"
                  value={form.consultantName}
                  onChange={e => {
                    setField('consultantName', e.target.value);
                    setField('consultantId', '');
                  }}
                />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                id="consultation-form-status"
                className="form-select"
                value={form.status}
                onChange={e =>
                  setField('status', e.target.value as Consultation['status'])
                }
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Discussion Agenda */}
          <div className="form-group">
            <label className="form-label">Discussion Agenda & Objectives</label>
            <textarea
              id="consultation-form-agenda"
              className="form-textarea"
              rows={3}
              placeholder="e.g. Commercial REIT yield analysis & pass-through taxation discussion."
              value={form.agenda}
              onChange={e => setField('agenda', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Outcome Notes */}
          <div className="form-group">
            <label className="form-label">
              Outcome Notes & Recommendations
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontWeight: 400,
                }}
              >
                (advisory notes, mandate agreements, next steps)
              </span>
            </label>
            <textarea
              id="consultation-form-outcome"
              className="form-textarea"
              rows={3}
              placeholder="Record key takeaways, investor interest level, follow-up requirements..."
              value={form.outcomeNotes}
              onChange={e => setField('outcomeNotes', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
