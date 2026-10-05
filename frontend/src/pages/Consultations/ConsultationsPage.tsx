import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Phone,
  Clock,
} from 'lucide-react';
import { Consultation, Investor } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import {
  getConsultations,
  saveConsultation as apiSaveConsultation,
  getInvestors,
} from '../../services/ghlApiService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import './ConsultationsPage.css';

// ─── Status Options (kept for the create/reschedule form only) ───────────────
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
  scheduledDate: string;
  scheduledTime: string;
  scheduledAt: string;
  consultantId: string;
  consultantName: string;
  status: Consultation['status'];
  agenda: string;
  outcomeNotes: string;
  referredByAgentName: string;
}

const BLANK_FORM: ConsultationForm = {
  investorId: '',
  investorName: '',
  investorPhone: '',
  scheduledDate: '',
  scheduledTime: '15:00',
  scheduledAt: '',
  consultantId: '',
  consultantName: '',
  status: 'Scheduled',
  agenda: '',
  outcomeNotes: '',
  referredByAgentName: '',
};

const formatSlotDateTime = (dateStr: string, timeStr: string): string => {
  if (!dateStr) return '';
  const time = timeStr || '15:00';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return `${dateStr} ${time}`;
  const [year, month, day] = parts.map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const dt = new Date(year, month - 1, day, hour || 0, minute || 0);
  if (isNaN(dt.getTime())) return `${dateStr} ${time}`;
  return (
    dt.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }) +
    ', ' +
    dt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  );
};

const parseScheduledSlot = (val: string): { date: string; time: string } => {
  let date = '';
  let time = '15:00';
  if (val) {
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return { date: `${year}-${month}-${day}`, time: `${hours}:${mins}` };
    }
    const tMatch = val.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (tMatch) {
      let h = parseInt(tMatch[1], 10);
      const m = tMatch[2];
      const ap = tMatch[3].toUpperCase();
      if (ap === 'PM' && h < 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      time = `${String(h).padStart(2, '0')}:${m}`;
    }
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  date = `${year}-${month}-${day}`;
  return { date, time };
};

// ─── Component ───────────────────────────────────────────────────────────────
export const ConsultationsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  // ── Role scoping ──────────────────────────────────────────────────────────
  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [drawerConsultation, setDrawerConsultation] = useState<Consultation | null>(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [consultantFilter, setConsultantFilter] = useState('All');
  const [agentFilter, setAgentFilter] = useState('All');

  // ── Create / Edit / Reschedule Modal ──────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<Consultation | null>(null);
  const [isRescheduleMode, setIsRescheduleMode] = useState(false);
  const [form, setForm] = useState<ConsultationForm>(BLANK_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ConsultationForm, string>>>({});

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      const [consList, invList] = await Promise.all([
        getConsultations(tenant?.id),
        getInvestors(tenant?.id),
      ]);
      setConsultations(consList);
      setInvestors(invList);
    } catch (err) {
      console.error('Failed to load consultations data', err);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  // ── Helper to parse timestamp for newest-first sorting / deduplication ────
  const getConsultationTimestamp = (c: Consultation): number => {
    // 1. Parse scheduledAt ISO date/time
    if (c.scheduledAt) {
      const parsed = Date.parse(c.scheduledAt);
      if (!isNaN(parsed)) return parsed;
    }
    // 2. Timestamp parsed from cns-<timestamp> id
    const match = (c.id || '').match(/^cns-(\d+)$/);
    if (match) {
      const ts = parseInt(match[1], 10);
      if (!isNaN(ts) && ts > 10000000000) return ts;
    }
    // 3. Fall back to any numeric value from id
    const numMatch = (c.id || '').match(/\d+/);
    if (numMatch) {
      const ts = parseInt(numMatch[0], 10);
      if (!isNaN(ts)) return ts;
    }
    return 0;
  };

  // ── Role-based scoping ────────────────────────────────────────────────────
  const scopedConsultations = consultations;

  // ── Group by investor & derive latestByInvestor (at most ONE row per investor) ──
  const latestByInvestor = (() => {
    // Pre-pass: map normalized phone digits to investorId if any consultation for that phone has one
    const phoneToInvestorId = new Map<string, string>();
    for (const c of scopedConsultations) {
      if (c.investorId && c.investorId.trim()) {
        const phone = (c.investorPhone || '').replace(/\D/g, '').slice(-10);
        if (phone) phoneToInvestorId.set(phone, c.investorId.trim());
      }
    }

    const getInvestorKey = (c: Consultation): string => {
      if (c.investorId && c.investorId.trim()) {
        return `id:${c.investorId.trim()}`;
      }
      const phone = (c.investorPhone || '').replace(/\D/g, '').slice(-10);
      if (phone && phoneToInvestorId.has(phone)) {
        return `id:${phoneToInvestorId.get(phone)}`;
      }
      if (phone) {
        return `phone:${phone}`;
      }
      return `cns:${c.id}`;
    };

    const map = new Map<string, Consultation>();
    for (const c of scopedConsultations) {
      const key = getInvestorKey(c);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, c);
      } else {
        if (getConsultationTimestamp(c) > getConsultationTimestamp(existing)) {
          map.set(key, c);
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => getConsultationTimestamp(b) - getConsultationTimestamp(a)
    );
  })();

  // ── Filter options (operates on deduplicated latestByInvestor) ────────────
  const consultantOptions = Array.from(
    new Set(latestByInvestor.map(c => c.consultantName)),
  )
    .filter((name): name is string => Boolean(name))
    .map(name => ({ value: name, label: name }));

  const agentOptions = Array.from(
    new Set(latestByInvestor.map(c => c.referredByAgentName)),
  )
    .filter((name): name is string => Boolean(name))
    .map(name => ({ value: name, label: name }));

  // ── Filtered list (operates on deduplicated latestByInvestor) ─────────────
  const filteredConsultations = latestByInvestor.filter(c => {
    if (consultantFilter !== 'All' && c.consultantName !== consultantFilter) return false;
    if (agentFilter !== 'All' && c.referredByAgentName !== agentFilter) return false;
    return true;
  });

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingConsultation(null);
    setIsRescheduleMode(false);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const initDate = `${yyyy}-${mm}-${dd}`;
    const initTime = '15:00';
    setForm({
      ...BLANK_FORM,
      scheduledDate: initDate,
      scheduledTime: initTime,
      scheduledAt: formatSlotDateTime(initDate, initTime),
      agenda: 'Commercial REIT yield analysis & pass-through taxation discussion.',
      consultantId: user?.id ?? '',
      consultantName: user?.name ?? 'Advisor',
      referredByAgentName: user?.role?.code === 'sales_executive' ? (user?.name ?? '') : '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openRescheduleModal = (c: Consultation) => {
    setEditingConsultation(c);
    setIsRescheduleMode(true);
    const { date, time } = parseScheduledSlot(c.scheduledAt);
    setForm({
      investorId: c.investorId,
      investorName: c.investorName,
      investorPhone: c.investorPhone,
      scheduledDate: date,
      scheduledTime: time,
      scheduledAt: c.scheduledAt || formatSlotDateTime(date, time),
      consultantId: c.consultantId,
      consultantName: c.consultantName,
      status: 'Rescheduled',
      agenda: c.agenda || '',
      outcomeNotes: c.outcomeNotes || '',
      referredByAgentName: c.referredByAgentName || '',
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
    if (!form.investorName.trim()) errors.investorName = 'Please enter an investor name.';
    if (!form.scheduledDate && !form.scheduledAt.trim()) {
      errors.scheduledAt = 'Consultation date slot is required.';
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    let resolvedInvestorId = form.investorId;
    if (!resolvedInvestorId) {
      const matched = investors.find(
        i => i.name.toLowerCase() === form.investorName.trim().toLowerCase()
      );
      resolvedInvestorId = matched?.id || `inv-${Date.now()}`;
    }

    const slotValue = form.scheduledAt.trim() || formatSlotDateTime(form.scheduledDate, form.scheduledTime);

    const isEdit = !!editingConsultation;
    const cons: Consultation = {
      id: editingConsultation ? editingConsultation.id : `cns-${Date.now()}`,
      companyId: tenant?.id || 't-ghl-01',
      investorId: resolvedInvestorId,
      investorName: form.investorName.trim(),
      investorPhone: form.investorPhone.trim(),
      scheduledAt: slotValue,
      consultantId: form.consultantId.trim() || (user?.id ?? 'usr-admin'),
      consultantName: form.consultantName.trim() || (user?.name ?? 'Advisor'),
      status: form.status,
      agenda: form.agenda.trim(),
      outcomeNotes: editingConsultation?.outcomeNotes || undefined,
      referredByAgentName: form.referredByAgentName.trim() || undefined,
    };

    apiSaveConsultation(cons).then(loadData).catch(console.error);

    try {
      const raw = localStorage.getItem('nexus_audit_logs');
      const logs = raw ? JSON.parse(raw) : [];
      logs.unshift({
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
      localStorage.setItem('nexus_audit_logs', JSON.stringify(logs));
      window.dispatchEvent(new Event('nexus_storage_updated'));
    } catch {}

    closeModal();
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: Column<Consultation>[] = [
    {
      key: 'scheduledAt',
      header: 'Session Slot',
      sortable: true,
      width: '16%',
      render: c => (
        <div>
          <div className="consultation-slot-title">{c.scheduledAt}</div>
          <div className="consultation-slot-id">ID: {c.id}</div>
        </div>
      ),
    },
    {
      key: 'investorName',
      header: 'Customer Profile',
      sortable: true,
      width: '18%',
      render: c => (
        <div>
          <div className="consultation-client-name">{c.investorName}</div>
          <div className="consultation-client-phone">{c.investorPhone}</div>
        </div>
      ),
    },
    {
      key: 'referredByAgentName',
      header: 'Referred By (Sales Agent)',
      width: '18%',
      render: c => (
        <span className="consultation-advisor-name">
          {c.referredByAgentName || '—'}
        </span>
      ),
    },
    {
      key: 'agenda',
      header: 'Reason for Consultation',
      width: '26%',
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
      header: 'IRM Profile',
      width: '16%',
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
              {
                key: 'agent',
                label: 'Sales Agent',
                value: agentFilter,
                onChange: setAgentFilter,
                options: agentOptions,
              },
            ]}
            onClearAll={() => {
              setConsultantFilter('All');
              setAgentFilter('All');
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
                : 'Confirm Advisory Slot'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveConsultation} className="consultation-form">
          {/* Investor Name Entering Option */}
          <div className="form-group">
            <label className="form-label">Investor Name *</label>
            <input
              id="consultation-form-investor"
              type="text"
              className={`form-input${formErrors.investorName ? ' is-invalid' : ''}`}
              placeholder="Enter investor name"
              value={form.investorName}
              onChange={e => {
                const val = e.target.value;
                setField('investorName', val);
                const matched = investors.find(
                  i => i.name.toLowerCase() === val.trim().toLowerCase()
                );
                if (matched) {
                  setField('investorId', matched.id);
                  if (matched.phone && !form.investorPhone) {
                    setField('investorPhone', matched.phone);
                  }
                } else if (!editingConsultation) {
                  setField('investorId', '');
                }
              }}
              list="investors-datalist"
            />
            <datalist id="investors-datalist">
              {investors.map(inv => (
                <option key={inv.id} value={inv.name}>
                  {inv.phone ? `${inv.name} (${inv.phone})` : inv.name}
                </option>
              ))}
            </datalist>
            {formErrors.investorName && (
              <div className="form-error">{formErrors.investorName}</div>
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
              <div className="consultation-calendar-slot-inputs">
                <input
                  id="consultation-form-date"
                  type="date"
                  className={`form-input${formErrors.scheduledAt ? ' is-invalid' : ''}`}
                  value={form.scheduledDate}
                  onChange={e => {
                    const newDate = e.target.value;
                    setField('scheduledDate', newDate);
                    setField('scheduledAt', formatSlotDateTime(newDate, form.scheduledTime));
                  }}
                  title="Select consultation date from calendar"
                />
                <input
                  id="consultation-form-time"
                  type="time"
                  className="form-input"
                  value={form.scheduledTime}
                  onChange={e => {
                    const newTime = e.target.value;
                    setField('scheduledTime', newTime);
                    setField('scheduledAt', formatSlotDateTime(form.scheduledDate, newTime));
                  }}
                  title="Select consultation time"
                />
              </div>
              {form.scheduledAt && (
                <div className="consultation-slot-preview">
                  📅 {form.scheduledAt}
                </div>
              )}
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

          {/* Referred By */}
          <div className="form-group">
            <label className="form-label">Referred By (Sales Agent)</label>
            <input
              id="consultation-form-referredby"
              className="form-input"
              placeholder="e.g. Suresh Kumar"
              value={form.referredByAgentName || ''}
              onChange={e => setField('referredByAgentName', e.target.value)}
            />
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
        </form>
      </Modal>

      <Drawer
        isOpen={!!drawerConsultation}
        onClose={() => setDrawerConsultation(null)}
        title={drawerConsultation?.investorName || 'Investor Profile'}
        subtitle={`Phone: ${drawerConsultation?.investorPhone || '—'} • ${tenant?.name}`}
        width={600}
      >
        {drawerConsultation && (() => {
          const dPhone = (drawerConsultation.investorPhone || '').replace(/\D/g, '').slice(-10);
          const matchingConsultations = consultations.filter(c => {
            if (drawerConsultation.investorId && c.investorId === drawerConsultation.investorId) {
              return true;
            }
            const cPhone = (c.investorPhone || '').replace(/\D/g, '').slice(-10);
            return !!(dPhone && cPhone && dPhone === cPhone);
          });

          const sortedConsultations = [...matchingConsultations].sort(
            (a, b) => getConsultationTimestamp(b) - getConsultationTimestamp(a)
          );

          const consultationHistory = sortedConsultations.filter(c => c.id !== drawerConsultation.id);

          return (
            <LeadDetailDrawerContent
              contactName={drawerConsultation.investorName}
              contactPhone={drawerConsultation.investorPhone}
              contactId={drawerConsultation.investorId}
              tenantId={tenant?.id}
              tenantName={tenant?.name}
              consultationReason={drawerConsultation.agenda}
              consultationHistory={consultationHistory}
              onCall={() =>
                initiateCall(
                  drawerConsultation.investorName,
                  drawerConsultation.investorPhone,
                  'customer',
                  drawerConsultation.investorId
                )
              }
            />
          );
        })()}
      </Drawer>
    </div>
  );
};
