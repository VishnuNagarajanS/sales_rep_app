import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  Phone,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Followup } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { followupsApi } from '../../services/crmApi';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import './FollowupsPage.css';

export const FollowupsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'due' | 'overdue'>('all');
  const [rescheduleItem, setRescheduleItem] = useState<Followup | null>(null);
  const [newDate, setNewDate] = useState('');
  const [savingReschedule, setSavingReschedule] = useState(false);

  // Profile Drawer state
  const [drawerFollowup, setDrawerFollowup] = useState<Followup | null>(null);

  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await followupsApi.getFollowups({
        status: 'Pending',
        scope: isExec ? undefined : 'all',
      });

      if (res?.items) {
        const rawItems = res.items;
        const mapped: Followup[] = rawItems.map((f: any) => ({
          id: String(f.id),
          tenantId: String(tenant?.id || ''),
          companyId: String(tenant?.id || ''),
          contactName: f.contactName || 'Unknown Contact',
          contactPhone: f.contactPhone || '',
          contactType: (f.contactType as any) || 'lead',
          contactId: f.contactId ? String(f.contactId) : '',
          assignedAgentId: String(f.assignedAgentId || ''),
          assignedAgentName: f.assignedAgentName || 'Agent',
          scheduledAt: f.scheduledAt ? new Date(f.scheduledAt).toLocaleString('en-IN') : 'Scheduled',
          notes: f.notes || '',
          priority: (f.priority as any) || 'Medium',
          status: (f.status as any) || 'Pending',
          completedAt: f.completedAt ? new Date(f.completedAt).toLocaleString('en-IN') : undefined,
        }));
        setFollowups(mapped);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load follow-ups from backend API');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, isExec]);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  const handleSaveReschedule = async () => {
    if (!rescheduleItem || !newDate.trim()) return;

    setSavingReschedule(true);
    try {
      // Parse ISO string if user input valid date, or send ISO string
      const parsedDate = new Date(newDate);
      const isoDate = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

      await followupsApi.updateFollowup(rescheduleItem.id, {
        scheduledAt: isoDate,
        status: 'Pending',
      });

      setRescheduleItem(null);
      setNewDate('');
      await fetchFollowups();
    } catch (err: any) {
      alert(`Failed to reschedule follow-up: ${err.message || 'Please check the date format'}`);
    } finally {
      setSavingReschedule(false);
    }
  };

  const handleComplete = async (f: Followup) => {
    try {
      await followupsApi.completeFollowup(f.id);
      await fetchFollowups();
    } catch (err: any) {
      alert(`Failed to mark follow-up as complete: ${err.message}`);
    }
  };

  // Determine overdue & due today based on date timestamps
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 24 * 60 * 60 * 1000;

  const isDueToday = (scheduledAt: string) => {
    const time = Date.parse(scheduledAt);
    return !isNaN(time) && time >= startOfToday && time < endOfToday;
  };

  const isOverdue = (scheduledAt: string) => {
    const time = Date.parse(scheduledAt);
    return !isNaN(time) && time < startOfToday;
  };

  const dueTodayCount = followups.filter(f => isDueToday(f.scheduledAt)).length;
  const overdueCount = followups.filter(f => isOverdue(f.scheduledAt)).length;

  const filteredFollowups = followups.filter(f => {
    if (activeTab === 'due') {
      return isDueToday(f.scheduledAt);
    }
    if (activeTab === 'overdue') {
      return isOverdue(f.scheduledAt);
    }
    return true;
  });

  return (
    <div className="followups-page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <CalendarCheck size={24} color="var(--primary-600)" /> Follow-ups & Reminders
          </h1>
          <p className="page-subtitle">
            Keep commitments, maintain pipeline velocity, and log outcomes seamlessly via Neon database.
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={fetchFollowups}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh DB Data
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="followups-tabs-container">
        {[
          { id: 'all', label: `All Tasks (${followups.length})` },
          { id: 'due', label: `Due Today (${dueTodayCount})` },
          { id: 'overdue', label: `Overdue (${overdueCount})`, danger: overdueCount > 0 },
        ].map(tab => (
          <button
            key={tab.id}
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'} ${tab.danger && activeTab === tab.id ? 'followups-tab-danger-active' : tab.danger ? 'followups-tab-danger-inactive' : ''}`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            {tab.danger && <AlertTriangle size={13} color={activeTab === tab.id ? '#ffffff' : '#dc2626'} />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Follow-ups List Cards */}
      <div className="followups-list">
        {loading && followups.length === 0 ? (
          <div className="card text-center followups-empty-card">
            Loading follow-ups from PostgreSQL database...
          </div>
        ) : filteredFollowups.length === 0 ? (
          <div className="card text-center followups-empty-card">
            No tasks in this category. You're all caught up!
          </div>
        ) : (
          filteredFollowups.map(f => {
            const overdue = isOverdue(f.scheduledAt);

            return (
              <div
                key={f.id}
                className={`card card-hover followup-item-card ${overdue ? 'overdue' : ''}`}
                onClick={() => setDrawerFollowup(f)}
                style={{ cursor: 'pointer' }}
              >
                <div className="followup-item-left">
                  <div>
                    <div className="followup-contact-header" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        className="followup-contact-name"
                        style={{ color: 'var(--primary-600)', fontWeight: 700 }}
                      >
                        {f.contactName}
                      </span>

                      <StatusChip status={f.priority} size="sm" />

                      <span className="followup-contact-phone">
                        Phone: {f.contactPhone}
                      </span>
                    </div>
                    {f.notes && (
                      <p className="followup-notes">
                        {f.notes}
                      </p>
                    )}
                    <div className="followup-meta-row">
                      <span className={`followup-schedule-time ${overdue ? 'overdue' : ''}`}>
                        ⏰ {f.scheduledAt}
                      </span>
                      <span className="followup-assignee">• Assignee: {f.assignedAgentName}</span>
                    </div>
                  </div>
                </div>

                <div className="followup-actions-right">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleComplete(f);
                    }}
                    title="Mark Done"
                  >
                    <CheckCircle2 size={15} color="#16a34a" /> Done
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRescheduleItem(f);
                    }}
                  >
                    Reschedule
                  </button>
                  <button
                    className="btn btn-call btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      initiateCall(f.contactName, f.contactPhone, f.contactType as any, f.contactId, f.id);
                    }}
                  >
                    <Phone size={13} /> Call
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reschedule Modal */}
      <Modal
        isOpen={!!rescheduleItem}
        onClose={() => setRescheduleItem(null)}
        title="Reschedule Follow-up"
        subtitle={`Adjust scheduled reminder date for ${rescheduleItem?.contactName}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRescheduleItem(null)} disabled={savingReschedule}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveReschedule} disabled={savingReschedule}>
              {savingReschedule ? 'Saving...' : 'Save New Slot'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">New Date & Time</label>
          <input
            type="datetime-local"
            className="form-input"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
          />
        </div>
      </Modal>

      {/* Contact Profile Drawer */}
      <Drawer
        isOpen={!!drawerFollowup}
        onClose={() => setDrawerFollowup(null)}
        title={drawerFollowup?.contactName || 'Contact Profile'}
        subtitle={`Phone: ${drawerFollowup?.contactPhone || '—'} • ${tenant?.name || 'CRM'}`}
        width={600}
      >
        {drawerFollowup && (
          <LeadDetailDrawerContent
            contactName={drawerFollowup.contactName}
            contactPhone={drawerFollowup.contactPhone}
            contactId={drawerFollowup.contactId}
            contactType={drawerFollowup.contactType}
            tenantId={tenant?.id}
            tenantName={tenant?.name}
            onCall={() =>
              initiateCall(
                drawerFollowup.contactName,
                drawerFollowup.contactPhone,
                drawerFollowup.contactType as any,
                drawerFollowup.contactId,
                drawerFollowup.id
              )
            }
            callDispositionFilter={['Follow-up Required', 'Call Back']}
          />
        )}
      </Drawer>
    </div>
  );
};
