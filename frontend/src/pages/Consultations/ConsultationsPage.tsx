import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Phone,
  Clock,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Consultation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { consultationsApi, customersApi } from '../../services/crmApi';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import './ConsultationsPage.css';

// ─── Status Options ─────────────────────────────────────────────────────────
const STATUS_OPTIONS: { value: Consultation['status']; label: string }[] = [
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Rescheduled', label: 'Rescheduled' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'No-show', label: 'No-show' },
];

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

interface InvestorOption {
  id: string;
  name: string;
  phone: string;
}

export const ConsultationsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [investorOptions, setInvestorOptions] = useState<InvestorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drawerConsultation, setDrawerConsultation] = useState<Consultation | null>(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [consultantFilter, setConsultantFilter] = useState('All');

  // ── Create / Edit / Reschedule Modal ──────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<Consultation | null>(null);
  const [isRescheduleMode, setIsRescheduleMode] = useState(false);
  const [form, setForm] = useState<ConsultationForm>(BLANK_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ConsultationForm, string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cnsRes, custRes] = await Promise.all([
        consultationsApi.getConsultations(),
        customersApi.getCustomers({ pageSize: 100 }),
      ]);

      if (cnsRes?.items) {
        const raw = cnsRes.items;
        const mapped: Consultation[] = raw.map((c: any) => ({
          id: String(c.id),
          companyId: String(tenant?.id || ''),
          investorId: String(c.investorId || ''),
          investorName: c.investorName || 'Investor',
          investorPhone: c.investorPhone || '',
          consultantId: String(c.consultantId || ''),
          consultantName: c.consultantName || 'Consultant',
          scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toLocaleString('en-IN') : 'Scheduled',
          status: (c.status as any) || 'Scheduled',
          agenda: c.agenda || '',
          outcomeNotes: c.outcomeNotes || '',
        }));
        setConsultations(mapped);
      }

      if (custRes?.items) {
        const rawCusts = custRes.items;
        setInvestorOptions(
          rawCusts.map((c: any) => ({
            id: String(c.id),
            name: c.name || 'Client',
            phone: c.phone || '',
          }))
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load consultations from backend API');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Consultant Filter options ─────────────────────────────────────────────
  const consultantOptions = Array.from(
    new Set(consultations.map(c => c.consultantName))
  )
    .filter(Boolean)
    .map(name => ({ value: name, label: name }));

  const filteredConsultations = consultations.filter(c => {
    if (consultantFilter !== 'All' && c.consultantName !== consultantFilter) return false;
    return true;
  });

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingConsultation(null);
    setIsRescheduleMode(false);
    setForm({
      ...BLANK_FORM,
      scheduledAt: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
      agenda: 'Commercial asset class yield analysis & investment mandate review.',
      consultantId: String(user?.id || ''),
      consultantName: user?.name || 'Advisor',
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
      scheduledAt: '',
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

  const handleSaveConsultation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const errors: Partial<Record<keyof ConsultationForm, string>> = {};
    if (!form.investorId) errors.investorId = 'Please select an investor.';
    if (!form.scheduledAt.trim()) errors.scheduledAt = 'Consultation slot is required.';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      const parsedDate = new Date(form.scheduledAt);
      const isoDate = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

      if (editingConsultation) {
        await consultationsApi.updateConsultation(editingConsultation.id, {
          scheduledAt: isoDate,
          status: form.status,
          agenda: form.agenda.trim(),
          outcomeNotes: form.outcomeNotes.trim() || undefined,
        });
      } else {
        await consultationsApi.scheduleConsultation({
          investorId: form.investorId,
          investorName: form.investorName,
          investorPhone: form.investorPhone,
          scheduledAt: isoDate,
          agenda: form.agenda.trim(),
        });
      }

      closeModal();
      await loadData();
    } catch (err: any) {
      alert(`Failed to save consultation: ${err.message || 'Please check inputs'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: Column<Consultation>[] = [
    {
      key: 'scheduledAt',
      header: 'Session Slot',
      sortable: true,
      width: '20%',
      render: c => (
        <div>
          <div className="consultation-slot-title">{c.scheduledAt}</div>
          <div className="consultation-slot-id">ID: #{c.id}</div>
        </div>
      ),
    },
    {
      key: 'investorName',
      header: 'Investor Profile',
      sortable: true,
      width: '20%',
      render: c => (
        <div>
          <div className="consultation-client-name">{c.investorName}</div>
          <div className="consultation-client-phone">{c.investorPhone}</div>
        </div>
      ),
    },
    {
      key: 'agenda',
      header: 'Reason for Consultation',
      width: '35%',
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
      header: 'Consultant / Advisor',
      width: '15%',
      render: c => <span className="consultation-advisor-name">{c.consultantName}</span>,
    },
  ];

  // ── Row actions ───────────────────────────────────────────────────────────
  const rowActions: RowAction<Consultation>[] = [
    {
      label: 'Call Customer',
      icon: <Phone size={14} color="#059669" style={{ marginRight: 6 }} />,
      onClick: c => initiateCall(c.investorName, c.investorPhone, 'customer', c.investorId),
    },
    {
      label: 'Reschedule',
      icon: <Clock size={14} color="#d97706" style={{ marginRight: 6 }} />,
      hidden: c => c.status === 'Completed' || c.status === 'Cancelled',
      onClick: c => openRescheduleModal(c),
    },
  ];

  return (
    <div className="consultations-page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Calendar size={24} color="#0284c7" /> Wealth Advisory Consultations
          </h1>
          <p className="page-subtitle">
            1-on-1 private advisory sessions, term sheet reviews, and mandate agreements in Neon database.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={loadData}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh DB Data
          </button>
          <button
            id="consultations-schedule-btn"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            onClick={openCreateModal}
          >
            <Plus size={15} /> Schedule Consultation
          </button>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Data table */}
      <DataTable
        columns={columns}
        data={filteredConsultations}
        keyExtractor={c => c.id}
        rowActions={rowActions}
        onRowClick={c => setDrawerConsultation(c)}
        searchPlaceholder="Search consultations by investor or agenda..."
        filtersNode={
          <FilterBar
            filters={[
              {
                key: 'consultant',
                label: 'Consultant',
                value: consultantFilter,
                onChange: setConsultantFilter,
                options: consultantOptions,
              },
            ]}
            onClearAll={() => {
              setConsultantFilter('All');
            }}
          />
        }
      />

      {/* Schedule / Edit / Reschedule Consultation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          isRescheduleMode
            ? 'Reschedule Consultation'
            : 'Schedule Private Wealth Advisory Consultation'
        }
        subtitle={
          isRescheduleMode
            ? `Reschedule advisory slot for ${form.investorName || 'client'}`
            : 'Book an advisory slot with a high-net-worth client'
        }
        maxWidth={620}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={isSaving}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSaveConsultation()}
              disabled={isSaving}
            >
              {isSaving
                ? 'Saving...'
                : isRescheduleMode
                ? 'Save Reschedule'
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
                const inv = investorOptions.find(i => i.id === e.target.value);
                setField('investorId', e.target.value);
                setField('investorName', inv?.name ?? '');
                setField('investorPhone', inv?.phone ?? '');
              }}
              disabled={isRescheduleMode}
            >
              <option value="">— Select Investor —</option>
              {form.investorId && !investorOptions.some(i => i.id === form.investorId) && (
                <option value={form.investorId}>
                  {form.investorName || form.investorId} (Current)
                </option>
              )}
              {investorOptions.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.name} {inv.phone ? `(${inv.phone})` : ''}
                </option>
              ))}
            </select>
            {formErrors.investorId && (
              <div className="form-error">{formErrors.investorId}</div>
            )}
          </div>

          {/* Scheduled At */}
          <div className="form-group">
            <label className="form-label">Date & Time *</label>
            <input
              type="datetime-local"
              className={`form-input${formErrors.scheduledAt ? ' is-invalid' : ''}`}
              value={form.scheduledAt}
              onChange={e => setField('scheduledAt', e.target.value)}
            />
            {formErrors.scheduledAt && (
              <div className="form-error">{formErrors.scheduledAt}</div>
            )}
          </div>

          {/* Agenda */}
          <div className="form-group">
            <label className="form-label">Reason / Agenda for Consultation</label>
            <textarea
              className="form-input"
              rows={3}
              value={form.agenda}
              onChange={e => setField('agenda', e.target.value)}
              placeholder="e.g. Discuss yield targets and commercial tax strategy"
            />
          </div>

          {/* Status if editing */}
          {editingConsultation && (
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={form.status}
                onChange={e => setField('status', e.target.value as Consultation['status'])}
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Outcome Notes if editing */}
          {editingConsultation && (
            <div className="form-group">
              <label className="form-label">Outcome Notes</label>
              <textarea
                className="form-input"
                rows={2}
                value={form.outcomeNotes}
                onChange={e => setField('outcomeNotes', e.target.value)}
                placeholder="Key decisions or commitments reached during this session"
              />
            </div>
          )}
        </form>
      </Modal>

      {/* Drawer */}
      <Drawer
        isOpen={!!drawerConsultation}
        onClose={() => setDrawerConsultation(null)}
        title={drawerConsultation?.investorName || 'Investor Profile'}
        subtitle={`Session: ${drawerConsultation?.scheduledAt || '—'} • ${tenant?.name || 'CRM'}`}
        width={600}
      >
        {drawerConsultation && (
          <LeadDetailDrawerContent
            contactName={drawerConsultation.investorName}
            contactPhone={drawerConsultation.investorPhone}
            contactId={drawerConsultation.investorId}
            contactType="customer"
            tenantId={tenant?.id}
            tenantName={tenant?.name}
            onCall={() =>
              initiateCall(
                drawerConsultation.investorName,
                drawerConsultation.investorPhone,
                'customer',
                drawerConsultation.investorId
              )
            }
            consultationReason={drawerConsultation.agenda}
          />
        )}
      </Drawer>
    </div>
  );
};
