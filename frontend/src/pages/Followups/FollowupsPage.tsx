import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Phone,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { Followup } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { salesApi } from '../../services/salesApi';
import { IS_MOCK_ENV } from '../../config/runtime';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import './FollowupsPage.css';


export const FollowupsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [followups, setFollowups] = useState<Followup[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'due' | 'overdue' | 'completed'>('all');
  const [rescheduleItem, setRescheduleItem] = useState<Followup | null>(null);
  const [newDate, setNewDate] = useState('');

  // Profile Drawer state for GHL Sales Exec
  const [drawerFollowup, setDrawerFollowup] = useState<Followup | null>(null);

  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';
  const isGhlSalesExec = tenant?.slug === 'ghl' && isExec;

  const scopedFollowups = isExec
    ? followups.filter(f =>
        (f.assignedAgentId && f.assignedAgentId === user?.id) ||
        (f.assignedAgentName && f.assignedAgentName === user?.name)
      )
    : followups;

  const loadData = async () => {
    if (IS_MOCK_ENV && tenant?.slug === 'ghl') {
      storageService.cleanupGhlPendingFollowups(tenant?.id);
    }
    setFollowups(IS_MOCK_ENV ? storageService.getFollowups(tenant?.id) || [] : await salesApi.getFollowups());
  };

  useEffect(() => {
    void loadData().catch(error => console.error('Failed to load follow-ups', error));
    const handleUpdate = () => void loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  const handleComplete = async (f: Followup) => {
    const updated = {
      ...f,
      status: f.status === 'Completed' ? 'Pending' : 'Completed',
    } as Followup;
    if (IS_MOCK_ENV) storageService.saveFollowup(updated);
    else await salesApi.saveFollowup(updated);
    await loadData();
  };

  const handleSaveReschedule = async () => {
    if (rescheduleItem && newDate) {
      const updated = {
        ...rescheduleItem,
        scheduledAt: newDate,
        status: 'Pending',
      } as Followup;
      if (IS_MOCK_ENV) storageService.saveFollowup(updated);
      else await salesApi.saveFollowup(updated);
      setRescheduleItem(null);
      setNewDate('');
      await loadData();
    }
  };

  // Safely deduplicate display rows for GHL Sales Exec (try/catch protected)
  let processedFollowups = scopedFollowups;
  if (isGhlSalesExec) {
    try {
      const seen = new Map<string, Followup>();
      const deduped: Followup[] = [];

      for (const f of scopedFollowups) {
        if (f.status !== 'Pending') {
          deduped.push(f);
          continue;
        }
        const phoneDigits = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
        const key = (f.contactId && f.contactId !== 'contact-new')
          ? `id:${f.contactId}`
          : phoneDigits ? `phone:${phoneDigits}` : `raw:${f.id}`;

        if (!seen.has(key)) {
          seen.set(key, f);
          deduped.push(f);
        }
      }
      processedFollowups = deduped;
    } catch (err) {
      console.error('Error deduping followups list:', err);
      processedFollowups = scopedFollowups;
    }
  }

  const callsList = storageService.getCalls(tenant?.id) || [];

  const getCallCountForFollowup = (f: Followup): number => {
    if (!isGhlSalesExec) return 0;
    const fPhoneDigits = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
    return callsList.filter(c => {
      if (f.contactId && f.contactId !== 'contact-new' && (c.leadId === f.contactId || c.contactId === f.contactId)) {
        return true;
      }
      const cPhoneDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
      return cPhoneDigits && fPhoneDigits && cPhoneDigits === fPhoneDigits;
    }).length;
  };

  // ── GHL Sales Exec: cross-reference safety filter ────────────────────────
  // Strips any followup whose matched lead is currently in Not Interested or
  // Junk — guaranteeing mutual exclusivity at the display layer even if a
  // Pending record somehow survived a routing transition.
  if (isGhlSalesExec) {
    try {
      const allLeads = storageService.getLeads(tenant?.id) || [];
      const niJunkLeadIds = new Set<string>(
        allLeads
          .filter(l => l.status === 'Not Interested' || l.status === 'Junk')
          .map(l => l.id)
      );
      const niJunkPhones = new Set<string>(
        allLeads
          .filter(l => l.status === 'Not Interested' || l.status === 'Junk')
          .map(l => (l.phone || '').replace(/\D/g, '').slice(-10))
          .filter(Boolean)
      );

      processedFollowups = processedFollowups.filter(f => {
        // Non-pending items are not subject to this mutual-exclusivity rule
        if (f.status !== 'Pending') return true;
        // Exclude if lead is now NI/Junk (by id)
        if (f.contactId && f.contactId !== 'contact-new' && niJunkLeadIds.has(f.contactId)) return false;
        // Exclude if lead is now NI/Junk (by phone)
        const fPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (fPhone && niJunkPhones.has(fPhone)) return false;
        return true;
      });
    } catch (err) {
      console.error('Error in GHL NI/Junk cross-reference filter:', err);
    }
  }

  // Count badges — for GHL exec, 'All Tasks' means active (Pending) tasks only
  const activePendingFollowups = isGhlSalesExec
    ? processedFollowups.filter(f => f.status === 'Pending')
    : processedFollowups;

  const filteredFollowups = processedFollowups.filter(f => {
    if (activeTab === 'due') {
      return f.status === 'Pending' && (f.scheduledAt || '').toLowerCase().includes('today');
    }
    if (activeTab === 'overdue') {
      return f.status === 'Pending' && (f.scheduledAt || '').toLowerCase().includes('yesterday');
    }
    if (activeTab === 'completed') {
      return f.status === 'Completed';
    }
    // 'all' tab: for GHL exec show only Pending tasks (Completed are in Completed tab)
    if (isGhlSalesExec) return f.status === 'Pending';
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
            Keep commitments, maintain pipeline velocity, and log outcomes seamlessly.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="followups-tabs-container">
        {[
          { id: 'all', label: `All Tasks (${activePendingFollowups.length})` },
          { id: 'due', label: `Due Today (${activePendingFollowups.filter(f => (f.scheduledAt || '').toLowerCase().includes('today')).length})` },
          { id: 'overdue', label: `Overdue (${activePendingFollowups.filter(f => (f.scheduledAt || '').toLowerCase().includes('yesterday')).length})`, danger: true },
          { id: 'completed', label: `Completed (${processedFollowups.filter(f => f.status === 'Completed').length})` },
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
        {filteredFollowups.length === 0 ? (
          <div className="card text-center followups-empty-card">
            No tasks in this category. You're all caught up!
          </div>
        ) : (
          filteredFollowups.map(f => {
            const isOverdue = f.status === 'Pending' && (f.scheduledAt || '').toLowerCase().includes('yesterday');
            const callCount = getCallCountForFollowup(f);

            return (
              <div
                key={f.id}
                className={`card card-hover followup-item-card ${isOverdue ? 'overdue' : ''} ${f.status === 'Completed' ? 'completed' : ''}`}
                onClick={isGhlSalesExec ? () => setDrawerFollowup(f) : undefined}
                style={isGhlSalesExec ? { cursor: 'pointer' } : undefined}
              >
                <div className="followup-item-left">
                  <button
                    className="btn btn-ghost btn-icon btn-sm followup-check-btn"
                    title={f.status === 'Completed' ? 'Completed' : 'Mark Completed'}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleComplete(f);
                    }}
                  >
                    {f.status === 'Completed' ? (
                      <CheckCircle size={16} color="#059669" />
                    ) : (
                      <span className="followup-check-empty" />
                    )}
                  </button>

                  <div>
                    <div className="followup-contact-header" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        className={`followup-contact-name ${f.status === 'Completed' ? 'completed' : ''}`}
                        style={isGhlSalesExec ? { color: 'var(--primary-600)', fontWeight: 700 } : undefined}
                      >
                        {f.contactName}
                      </span>

                      <StatusChip status={f.priority} size="sm" />

                      {isGhlSalesExec && (
                        <span
                          style={{
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          📞 {callCount} {callCount === 1 ? 'call' : 'calls'}
                        </span>
                      )}

                      <span className="followup-contact-phone">
                        Phone: {f.contactPhone}
                      </span>
                    </div>
                    <p className="followup-notes">
                      {f.notes}
                    </p>
                    <div className="followup-meta-row">
                      <span className={`followup-schedule-time ${isOverdue ? 'overdue' : ''}`}>
                        ⏰ {f.scheduledAt}
                      </span>
                      <span className="followup-assignee">• Assignee: {f.assignedAgentName}</span>
                    </div>
                  </div>
                </div>

                <div className="followup-actions-right">
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
            <button className="btn btn-secondary" onClick={() => setRescheduleItem(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveReschedule}>
              Save New Slot
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">New Date & Time</label>
          <input
            type="text"
            className="form-input"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            placeholder="e.g. Next Monday, 10:00 AM"
          />
        </div>
      </Modal>

      {/* Contact Profile Drawer (GHL Sales Exec only) */}
      {isGhlSalesExec && (
        <Drawer
          isOpen={!!drawerFollowup}
          onClose={() => setDrawerFollowup(null)}
          title={drawerFollowup?.contactName || 'Contact Profile'}
          subtitle={`Phone: ${drawerFollowup?.contactPhone || '—'} • ${tenant?.name}`}
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
      )}
    </div>
  );
};
