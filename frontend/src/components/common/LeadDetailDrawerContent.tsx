import React, { useState, useEffect, useMemo } from 'react';
import {
  Phone,
  FileText,
  Volume2,
  ChevronDown,
  ChevronUp,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  Activity,
  History,
  ShieldAlert,
  User,
  MapPin,
} from 'lucide-react';
import { CallDisposition, Consultation, SiteVisit } from '../../types';
import { storageService } from '../../services/storageService';
import { jaminApiService } from '../../services/jaminApiService';
import { useAuth } from '../../context/AuthContext';
import { StatusChip } from './StatusChip';

interface LeadDetailDrawerContentProps {
  /** The contact's display name */
  contactName: string;
  /** The contact's phone number (used for phone-based call matching) */
  contactPhone: string;
  /** Lead/contact record ID (used for id-based call matching) */
  contactId?: string;
  /** 'lead' | 'customer' — passed through to initiateCall */
  contactType?: string;
  /** Tenant/company ID for scoped storage lookups */
  tenantId?: string;
  /** Tenant name shown in the activity badge */
  tenantName?: string;
  /** Called when the "Call Now" button is pressed */
  onCall: () => void;
  /**
   * Optional whitelist of dispositions to include in call history.
   * When undefined or empty, ALL dispositions are shown (suitable for
   * Junk / Not Interested pages that need the full history).
   * Follow-up page passes ['Follow-up Required', 'Call Back'].
   */
  callDispositionFilter?: CallDisposition[];
  /** Optional — shown as the last row in the Lead/Investor Details card when provided */
  consultationReason?: string;
  /** Optional — past consultations for this investor when viewing from ConsultationsPage */
  consultationHistory?: Consultation[];
  /** Optional — when true, strips system-generated disposition lines from Notes & Requirements */
  hideAutoNotes?: boolean;
  /** Optional — when provided, renders only the specified sections */
  sectionsOnly?: ('callRecordings' | 'summary' | 'details' | 'consultations')[];
}

export const LeadDetailDrawerContent: React.FC<LeadDetailDrawerContentProps> = ({
  contactName,
  contactPhone,
  contactId,
  tenantId,
  onCall,
  callDispositionFilter,
  consultationReason,
  consultationHistory,
  hideAutoNotes = false,
  sectionsOnly,
}) => {
  const { user, tenant } = useAuth();
  const isGhl = tenant?.slug === 'ghl' || tenantId === 't-ghl-01';
  const isSalesExecutive = user?.role?.code === 'sales_executive';

  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({});
  const [callTab, setCallTab] = useState<'agent' | 'irm'>('agent');
  const [isPreviousConsultationsOpen, setIsPreviousConsultationsOpen] = useState(true);
  const [isSiteVisitsOpen, setIsSiteVisitsOpen] = useState(true);
  const [isActivityOpen, setIsActivityOpen] = useState(true);
  const [, setSiteVisitsVersion] = useState(0);
  const [apiSiteVisits, setApiSiteVisits] = useState<SiteVisit[]>([]);

  useEffect(() => {
    setCallTab('agent');
  }, [contactPhone, contactId]);

  useEffect(() => {
    let isMounted = true;
    jaminApiService.getSiteVisits(true).then(visits => {
      if (isMounted && visits && visits.length > 0) {
        setApiSiteVisits(visits);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [contactPhone, contactId]);

  // ── Lead record lookup ───────────────────────────────────────────────────────
  const selectedLead = (() => {
    const leads = storageService.getLeads(tenantId) || [];
    return leads.find(l => {
      if (contactId && contactId !== 'contact-new' && l.id === contactId) return true;
      const lPhone = (l.phone || '').replace(/\D/g, '').slice(-10);
      const fPhone = (contactPhone || '').replace(/\D/g, '').slice(-10);
      return lPhone && fPhone && lPhone === fPhone;
    }) || null;
  })();

  // ── Lead Activity & Audit History Lookup ──────────────────────────────────
  const leadAuditLogs = (() => {
    const allLogs = storageService.getAuditLogs(tenantId) || [];
    const targetLeadId = selectedLead?.id || contactId;
    const phoneDigits = (selectedLead?.phone || contactPhone || '').replace(/\D/g, '').slice(-10);
    const targetName = (selectedLead?.name || contactName || '').toLowerCase();

    return allLogs.filter(l => {
      if (targetLeadId && (l.entityId === targetLeadId || l.entityId === String(targetLeadId))) return true;
      if (l.details && phoneDigits && l.details.includes(phoneDigits)) return true;
      if (l.details && targetName && l.details.toLowerCase().includes(targetName)) return true;
      return false;
    });
  })();

  // ── Site Visits lookup (Jamin Bazaar) ──────────────────────────────────────
  const leadSiteVisits = (() => {
    if (!selectedLead && !contactPhone && !contactName) return [];
    const localVisits = storageService.getSiteVisits() || [];
    const visitMap = new Map<string, SiteVisit>();
    localVisits.forEach(v => visitMap.set(String(v.id), v));
    apiSiteVisits.forEach(v => visitMap.set(String(v.id), v));
    const allVisits = Array.from(visitMap.values());

    const phoneDigits = (selectedLead?.phone || contactPhone || '').replace(/\D/g, '').slice(-10);
    const targetLeadId = String(selectedLead?.id || contactId || '').replace('db-', '').replace('lead-', '').trim();
    const targetName = (selectedLead?.name || contactName || '').trim().toLowerCase();

    return allVisits.filter(v => {
      // 1. Phone match
      const vPhone = (v.customerPhone || '').replace(/\D/g, '').slice(-10);
      if (phoneDigits && vPhone && phoneDigits === vPhone) return true;

      // 2. ID match
      const vLeadId = v.leadId ? String(v.leadId).replace('db-', '').replace('lead-', '').trim() : '';
      const vCustId = v.customerId ? String(v.customerId).replace('db-', '').replace('lead-', '').trim() : '';
      if (targetLeadId && (vLeadId === targetLeadId || vCustId === targetLeadId || String(v.leadId) === String(selectedLead?.id))) return true;

      // 3. Name match
      const vName = (v.customerName || '').trim().toLowerCase();
      if (targetName && vName && targetName === vName) return true;

      return false;
    });
  })();

  const handleConfirmLeadSiteVisit = (sv: SiteVisit) => {
    storageService.saveSiteVisit({ ...sv, status: 'Scheduled' });
    setSiteVisitsVersion(v => v + 1);
  };

  // ── Call history lookup ──────────────────────────────────────────────────────
  const allCalls = storageService.getCalls(tenantId) || [];
  const fPhoneDigits = (contactPhone || '').replace(/\D/g, '').slice(-10);

  const selectedCalls = allCalls.filter(c => {
    const isMatch =
      (contactId && contactId !== 'contact-new' &&
        (c.leadId === contactId || (c as any).contactId === contactId || (c as any).investorId === contactId)) ||
      ((c.contactPhone || '').replace(/\D/g, '').slice(-10) === fPhoneDigits &&
        fPhoneDigits.length > 0);

    if (!isMatch) return false;

    // When a filter is specified, only include matching dispositions
    if (callDispositionFilter && callDispositionFilter.length > 0) {
      return callDispositionFilter.includes(c.disposition as CallDisposition);
    }
    return true;
  });

  const isIrmCall = (c: any) =>
    (c.notes || '').startsWith('Connected to IRM:') ||
    (c.agentId || '').toLowerCase().includes('irm') ||
    (c.agentName || '').toLowerCase().includes('irm');

  const agentCalls = selectedCalls.filter(c => !isIrmCall(c));
  const irmCalls = selectedCalls.filter(c => isIrmCall(c));
  const tabCalls = isGhl ? (callTab === 'agent' ? agentCalls : irmCalls) : selectedCalls;

  // ── Active follow-up count ───────────────────────────────────────────────────
  const followups = storageService.getFollowups(tenantId) || [];
  const activeFollowupCount = followups.filter(f => {
    if (f.status !== 'Pending') return false;
    if (contactId && contactId !== 'contact-new' && f.contactId === contactId) return true;
    const fwPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
    return fwPhone && fPhoneDigits && fwPhone === fPhoneDigits;
  }).length;

  const toggleTranscript = (callId: string) => {
    setExpandedTranscripts(prev => ({ ...prev, [callId]: !prev[callId] }));
  };

  const formatDuration = (sec: number) => {
    if (!sec || sec <= 0) return '0s';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // ── Unified Activity & Audit Timeline ──────────────────────────────────────
  const unifiedTimelineEvents = useMemo(() => {
    const events: Array<{
      id: string;
      timestamp: string;
      action: string;
      actor: string;
      details: string;
      type: 'intake' | 'assignment' | 'call' | 'site_visit' | 'followup' | 'audit';
      badgeColor: string;
      badgeBg: string;
      dotColor: string;
    }> = [];

    // 1. Lead Intake / Creation
    if (selectedLead?.createdAt) {
      events.push({
        id: `intake-${selectedLead.id}`,
        timestamp: selectedLead.createdAt,
        action: 'LEAD_INTAKE',
        actor: selectedLead.source || 'Website Inbound',
        details: `Lead registered via ${selectedLead.source || 'Inbound'}${selectedLead.targetDevelopment ? ` for project ${selectedLead.targetDevelopment}` : ''}${selectedLead.location ? ` in ${selectedLead.location}` : ''}. Status: ${selectedLead.status || 'New'}, Priority: ${selectedLead.priority || 'Medium'}.`,
        type: 'intake',
        badgeColor: '#0284c7',
        badgeBg: '#e0f2fe',
        dotColor: '#0284c7',
      });
    }

    // 2. Initial / Current Agent Assignment
    if (selectedLead?.assignedAgentName && selectedLead.assignedAgentName !== 'Unassigned') {
      events.push({
        id: `assign-${selectedLead.id}`,
        timestamp: (selectedLead as any).assignedAt || selectedLead.createdAt || new Date().toISOString(),
        action: 'LEAD_ASSIGNED',
        actor: selectedLead.assignedAgentName,
        details: `Assigned to ${selectedLead.assignedAgentName} for follow-up and communication.`,
        type: 'assignment',
        badgeColor: '#7c3aed',
        badgeBg: '#ede9fe',
        dotColor: '#7c3aed',
      });
    }

    // 3. Logged Calls
    selectedCalls.forEach(c => {
      events.push({
        id: `call-${c.id}`,
        timestamp: c.timestamp,
        action: `${c.direction.toUpperCase()}_CALL`,
        actor: c.agentName || 'Agent',
        details: `${c.direction === 'inbound' ? 'Inbound' : 'Outbound'} call (${formatDuration(c.duration)}) • Outcome: ${c.disposition}${c.notes ? ` • Note: ${c.notes}` : ''}`,
        type: 'call',
        badgeColor: '#059669',
        badgeBg: '#d1fae5',
        dotColor: '#10b981',
      });
    });

    // 4. Site Visits
    leadSiteVisits.forEach(sv => {
      events.push({
        id: `visit-${sv.id}`,
        timestamp: sv.scheduledAt || (sv as any).createdAt || selectedLead?.createdAt || new Date().toISOString(),
        action: `SITE_VISIT_${(sv.status || 'SCHEDULED').toUpperCase()}`,
        actor: sv.assignedAgentName || 'Host Agent',
        details: `Site visit for ${sv.projectName || 'Project Layout'}${sv.plotNumber ? ` (${sv.plotNumber})` : ''} • Status: ${sv.status}${sv.visitorNote ? ` • Visitor Note: "${sv.visitorNote}"` : ''}${sv.outcomeNotes ? ` • Outcome: "${sv.outcomeNotes}"` : ''}`,
        type: 'site_visit',
        badgeColor: '#d97706',
        badgeBg: '#fef3c7',
        dotColor: '#f59e0b',
      });
    });

    // 5. Follow-ups
    const fPhoneDigits = (selectedLead?.phone || contactPhone || '').replace(/\D/g, '').slice(-10);
    const leadFollowups = (storageService.getFollowups(tenantId) || []).filter(f => {
      if (contactId && contactId !== 'contact-new' && f.contactId === contactId) return true;
      const fwPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
      return Boolean(fwPhone && fPhoneDigits && fwPhone === fPhoneDigits);
    });

    leadFollowups.forEach(f => {
      events.push({
        id: `fu-${f.id}`,
        timestamp: f.scheduledAt || (f as any).createdAt || selectedLead?.createdAt || new Date().toISOString(),
        action: `FOLLOWUP_${(f.status || 'SCHEDULED').toUpperCase()}`,
        actor: f.assignedToName || f.assignedAgentName || 'Agent',
        details: `Follow-up (${f.priority || 'Medium'} priority) • Status: ${f.status}${f.notes ? ` • Notes: "${f.notes}"` : ''}${f.completedAt ? ` • Completed at: ${new Date(f.completedAt).toLocaleString()}` : ''}`,
        type: 'followup',
        badgeColor: f.status === 'Completed' ? '#059669' : '#2563eb',
        badgeBg: f.status === 'Completed' ? '#d1fae5' : '#dbeafe',
        dotColor: f.status === 'Completed' ? '#10b981' : '#3b82f6',
      });
    });

    // 6. Audit Logs
    leadAuditLogs.forEach(l => {
      events.push({
        id: `audit-${l.id}`,
        timestamp: l.timestamp,
        action: l.action,
        actor: l.actorName || l.actorEmail || 'Admin',
        details: l.details || `Action recorded for this lead.`,
        type: 'audit',
        badgeColor: l.action.includes('DELETE') ? '#b91c1c' : l.action.includes('CREATE') ? '#15803d' : '#4338ca',
        badgeBg: l.action.includes('DELETE') ? '#fee2e2' : l.action.includes('CREATE') ? '#dcfce7' : '#e0e7ff',
        dotColor: l.action.includes('DELETE') ? '#ef4444' : l.action.includes('CREATE') ? '#10b981' : '#6366f1',
      });
    });

    // Deduplicate by ID and sort descending by timestamp
    const seen = new Set<string>();
    const unique = events.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    return unique.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
    });
  }, [selectedLead, selectedCalls, leadSiteVisits, leadAuditLogs, contactPhone, contactId, tenantId]);

  // ── Customer Notes (from form/source) vs Agent Reason (from disposition) ───
  const customerNotes = (() => {
    if (!selectedLead) return '';
    if (selectedLead.customFields?.customerNotes && typeof selectedLead.customFields.customerNotes === 'string' && selectedLead.customFields.customerNotes.trim()) {
      return selectedLead.customFields.customerNotes.trim();
    }
    if (!selectedLead.notes) return '';
    const cleaned = selectedLead.notes
      .split(/\n\n?\[\d{1,2}\/\d{1,2}\/\d{4}[^\]]*\]\s*Not Interested Reason:?/i)[0]
      .replace(/(?:\[.*?\]\s*)?Not Interested Reason:[\s\S]*$/i, '')
      .trim();
    return cleaned;
  })();

  const agentReason = (() => {
    if (!selectedLead) return '';
    if (selectedLead.customFields?.dispositionReason && typeof selectedLead.customFields.dispositionReason === 'string' && selectedLead.customFields.dispositionReason.trim()) {
      return selectedLead.customFields.dispositionReason.trim();
    }
    if (selectedLead.notes) {
      const match = selectedLead.notes.match(/Not Interested Reason:\s*([^\n\r]+)/i);
      if (match && match[1]?.trim()) {
        return match[1].trim();
      }
    }
    const niCall = selectedCalls.find(c => c.disposition === 'Not Interested');
    if (niCall?.notes) {
      const match = niCall.notes.match(/Reason:\s*([^\n\r]+)/i);
      if (match && match[1]?.trim()) {
        return match[1].trim();
      }
      return niCall.notes.trim();
    }
    return '';
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Activity Summary Badge ───────────────────────────────────────────── */}
      {(!sectionsOnly || sectionsOnly.includes('summary')) && (
        <div
          style={{
            backgroundColor: 'var(--bg-surface-hover)',
            border: '1px solid var(--border-base)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
              Total Activity Summary
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2, color: 'var(--primary-600)' }}>
              {selectedCalls.length} {selectedCalls.length === 1 ? 'Call Recorded' : 'Calls Recorded'}
              {activeFollowupCount > 0 && ` • ${activeFollowupCount} Active Follow-up${activeFollowupCount > 1 ? 's' : ''}`}
            </div>
          </div>
          <button className="btn btn-call btn-sm" onClick={onCall}>
            <Phone size={13} /> Call Now
          </button>
        </div>
      )}

      {/* ── Lead / Investor Details ──────────────────────────────────────────── */}
      {(!sectionsOnly || sectionsOnly.includes('details')) && (
        <div className="card">
          <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={16} color="var(--primary-600)" /> {isGhl ? 'Lead / Investor Details' : 'Lead Details'}
          </h4>

          {selectedLead ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
              {selectedLead.name && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>FULL NAME</span>
                  <div style={{ fontWeight: 600 }}>{selectedLead.name}</div>
                </div>
              )}
              {selectedLead.phone && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>PHONE NUMBER</span>
                  <div style={{ fontWeight: 600 }}>{selectedLead.phone}</div>
                </div>
              )}
              {selectedLead.email && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>EMAIL</span>
                  <div style={{ fontWeight: 600 }}>{selectedLead.email}</div>
                </div>
              )}
              {selectedLead.location && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>LOCATION</span>
                  <div style={{ fontWeight: 600 }}>{selectedLead.location}</div>
                </div>
              )}
              {selectedLead.source && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>SOURCE</span>
                  <div style={{ fontWeight: 600 }}>{selectedLead.source}</div>
                </div>
              )}
              {selectedLead.status && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>STATUS</span>
                  <div><StatusChip status={selectedLead.status} size="sm" /></div>
                </div>
              )}
              {selectedLead.priority && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>PRIORITY</span>
                  <div><StatusChip status={selectedLead.priority} size="sm" /></div>
                </div>
              )}
              {selectedLead.createdAt && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>INTAKE DATE</span>
                  <div style={{ fontWeight: 600 }}>{selectedLead.createdAt}</div>
                </div>
              )}
              {selectedLead.targetDevelopment && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>TARGET DEVELOPMENT</span>
                  <div style={{ fontWeight: 600, color: '#059669' }}>{selectedLead.targetDevelopment}</div>
                </div>
              )}
              {(selectedLead.customFields?.budgetRange || (selectedLead as any).budgetRange) && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>BUDGET RANGE</span>
                  <div style={{ fontWeight: 600 }}>{selectedLead.customFields?.budgetRange || (selectedLead as any).budgetRange}</div>
                </div>
              )}
              {(selectedLead.customFields?.readyToRegister || (selectedLead as any).readyToRegister) && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>READY TO REGISTER</span>
                  <div style={{ fontWeight: 600, color: '#059669' }}>
                    {selectedLead.customFields?.readyToRegister || (selectedLead as any).readyToRegister}
                  </div>
                </div>
              )}
              {((selectedLead as any).preferredVisitDate || (selectedLead as any).preferredTimeSlot) && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>PREFERRED VISIT</span>
                  <div style={{ fontWeight: 600 }}>
                    {[(selectedLead as any).preferredVisitDate, (selectedLead as any).preferredTimeSlot].filter(Boolean).join(' • ')}
                  </div>
                </div>
              )}
              {(selectedLead as any).preferredLanguage && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>PREFERRED LANGUAGE</span>
                  <div style={{ fontWeight: 600 }}>{(selectedLead as any).preferredLanguage}</div>
                </div>
              )}
              {(selectedLead as any).preferredContactTime && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>PREFERRED CONTACT TIME</span>
                  <div style={{ fontWeight: 600 }}>{(selectedLead as any).preferredContactTime}</div>
                </div>
              )}
              {(() => {
                // Strip legacy "[date] ... Reason: ..." lines that were previously
                // appended to notes before reason was stored separately.
                const reasonLinePattern = /^\[[\d/]+\]\s.*(Reason|Wrong Number|Not Interested).*/i;

                let notesContent = '';
                if (hideAutoNotes) {
                  if (
                    selectedLead.customFields?.customerNotes &&
                    typeof selectedLead.customFields.customerNotes === 'string' &&
                    selectedLead.customFields.customerNotes.trim()
                  ) {
                    notesContent = selectedLead.customFields.customerNotes.trim();
                  } else {
                    const autoNotePattern1 =
                      /^\[\d{1,2}\/\d{1,2}\/\d{4}\]\s*(Interested|Follow-up Required|Call Back|No Response|Converted|Not Interested|Wrong Number)/i;
                    const autoNotePattern2 = /^\[Call Disposition\s*-.*?\]:/i;

                    notesContent = (selectedLead.notes || '')
                      .split('\n')
                      .filter(line => {
                        const trimmed = line.trim();
                        if (reasonLinePattern.test(trimmed)) return false;
                        if (autoNotePattern1.test(trimmed)) return false;
                        if (autoNotePattern2.test(trimmed)) return false;
                        return true;
                      })
                      .join('\n')
                      .trim();
                  }
                } else {
                  notesContent = (selectedLead.notes || '')
                    .split('\n')
                    .filter(line => !reasonLinePattern.test(line.trim()))
                    .join('\n')
                    .trim();
                }

                if (!notesContent) return null;

                let cleanNotes = notesContent;
                if (cleanNotes.includes('Visitor Note:')) {
                  const match = cleanNotes.match(/Visitor Note:\s*"?([^"]*)"?/i);
                  if (match && match[1]) {
                    cleanNotes = match[1].trim();
                  } else {
                    cleanNotes = cleanNotes.replace(/^Direct from [^:]+:\s*/i, '').replace(/^Visitor Note:\s*/i, '').replace(/^"|"$/g, '').trim();
                  }
                } else if (cleanNotes.startsWith('Direct from')) {
                  cleanNotes = cleanNotes.replace(/^Direct from [^.]*\.\s*/i, '').trim();
                }

                const srcLower = (selectedLead.source || '').toLowerCase();
                const isSiteVisitSource = srcLower.includes('site visit');
                const isCallbackSource = srcLower.includes('callback') || srcLower.includes('call back');

                const label = isSiteVisitSource
                  ? 'MESSAGE FROM VISITOR (Anything we should know?)'
                  : isCallbackSource
                  ? 'MESSAGE FROM VISITOR (What are you looking for?)'
                  : 'NOTES & REQUIREMENTS';

                return (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>{label}</span>
                    <div style={{ backgroundColor: 'var(--bg-surface-hover)', padding: '8px 12px', borderRadius: 6, marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {cleanNotes}
                    </div>
                  </div>
                );
              })()}

              {selectedLead.customFields?.dispositionReason && (
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>REASON</span>
                  <div style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '8px 12px', borderRadius: 6, marginTop: 4, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {selectedLead.customFields.dispositionReason as string}
                  </div>
                </div>
              )}
              {consultationReason && (
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>REASON FOR CONSULTATION</span>
                  <div style={{ backgroundColor: 'var(--bg-surface-hover)', padding: '8px 12px', borderRadius: 6, marginTop: 4 }}>
                    {consultationReason}
                  </div>
                </div>
              )}

              {/* Custom Fields - Only show distinct non-empty custom attributes not already displayed in standard fields */}
              {(() => {
                const knownStandardKeys = new Set([
                  'name',
                  'phone',
                  'email',
                  'location',
                  'preferredLocation',
                  'source',
                  'status',
                  'priority',
                  'targetDevelopment',
                  'project',
                  'preferredProject',
                  'budgetRange',
                  'budget',
                  'plotBudgetRange',
                  'readyToRegister',
                  'preferredVisitDate',
                  'preferredTimeSlot',
                  'preferredLanguage',
                  'preferredContactTime',
                  'dispositionReason',
                  'customerNotes',
                  'notes',
                  'leadScore',
                  'message',
                  'userMessage',
                ]);

                const activeDefs = storageService
                  .getCustomFieldDefinitions(tenantId)
                  .filter(d => d.active !== false && (d.module === 'leads' || !d.module))
                  .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

                const rows: Array<{ id: string; label: string; value: string }> = [];

                activeDefs.forEach(def => {
                  const key = def.fieldKey || def.id;
                  if (knownStandardKeys.has(key)) return;
                  if (isSalesExecutive && key === 'preferredAssetClass') return;

                  const rawVal = selectedLead.customFields?.[key] ?? (selectedLead as any)[key];
                  if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '' && String(rawVal).trim() !== '—') {
                    rows.push({
                      id: def.id,
                      label: def.label || key.replace(/([A-Z])/g, ' $1'),
                      value: String(rawVal),
                    });
                  }
                });

                if (rows.length === 0) return null;

                return (
                  <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>CUSTOM ATTRIBUTES</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                      {rows.map(item => (
                        <div key={item.id} style={{ backgroundColor: 'var(--bg-surface-hover)', padding: '6px 10px', borderRadius: 6 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{item.label}</span>
                          <div style={{ fontWeight: 600 }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                Lead details unavailable
              </div>
              {consultationReason && (
                <div style={{ marginTop: 12 }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>REASON FOR CONSULTATION</span>
                  <div style={{ backgroundColor: 'var(--bg-surface-hover)', padding: '8px 12px', borderRadius: 6, marginTop: 4 }}>
                    {consultationReason}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Previous Consultations ─────────────────────────────────────── */}
      {(!sectionsOnly || sectionsOnly.includes('consultations')) && consultationHistory && consultationHistory.length > 0 && (
        <div className="card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              marginBottom: isPreviousConsultationsOpen ? 12 : 0,
            }}
            onClick={() => setIsPreviousConsultationsOpen(prev => !prev)}
          >
            <h4
              style={{
                fontSize: 15,
                fontWeight: 700,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Calendar size={16} color="var(--primary-600)" /> Previous Consultations ({consultationHistory.length})
            </h4>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 6px' }}
              onClick={e => {
                e.stopPropagation();
                setIsPreviousConsultationsOpen(prev => !prev);
              }}
            >
              {isPreviousConsultationsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {isPreviousConsultationsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {consultationHistory.map(item => (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid var(--border-base)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  {/* Header row: slot (scheduledAt) and StatusChip */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 10,
                          backgroundColor: 'var(--bg-surface-hover)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Clock size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
                        {item.scheduledAt}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Consultant: <strong>{item.consultantName}</strong>
                      </span>
                    </div>
                    <StatusChip status={item.status} size="sm" />
                  </div>

                  {/* Agenda / Reason */}
                  {item.agenda && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                      <strong>Reason / Agenda:</strong> {item.agenda}
                    </div>
                  )}

                  {/* Outcome Notes (if any) */}
                  {item.outcomeNotes && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      <strong>Outcome Notes:</strong> {item.outcomeNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Site Visits (Jamin Bazaar only - never GHL) ─────────────────────────────────── */}
      {(!sectionsOnly || sectionsOnly.includes('details')) && !isGhl && leadSiteVisits.length > 0 && (
        <div className="card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              marginBottom: isSiteVisitsOpen ? 12 : 0,
            }}
            onClick={() => setIsSiteVisitsOpen(prev => !prev)}
          >
            <h4
              style={{
                fontSize: 15,
                fontWeight: 700,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Calendar size={16} color="#dc2626" /> Site Visits ({leadSiteVisits.length})
            </h4>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 6px' }}
              onClick={e => {
                e.stopPropagation();
                setIsSiteVisitsOpen(prev => !prev);
              }}
            >
              {isSiteVisitsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {isSiteVisitsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {leadSiteVisits.map(sv => (
                <div
                  key={sv.id}
                  style={{
                    border: '1px solid var(--border-base)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 10,
                          backgroundColor: 'var(--bg-surface-hover)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Clock size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
                        {sv.scheduledAt}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {sv.projectName} {sv.plotNumber && sv.plotNumber !== '—' ? `• ${sv.plotNumber}` : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusChip status={sv.status} size="sm" />
                      {(sv.status === 'Pending' || sv.status === 'Requested') && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          style={{
                            fontSize: '11px',
                            padding: '3px 9px',
                            backgroundColor: '#059669',
                            borderColor: '#059669',
                          }}
                          onClick={() => handleConfirmLeadSiteVisit(sv)}
                        >
                          <CheckCircle2 size={12} style={{ marginRight: 4 }} /> Confirm Visit
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                    Host Agent: <strong>{sv.assignedAgentName || 'Agent'}</strong>
                  </div>
                  {(sv.outcomeNotes || sv.visitorNote) && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                      "{sv.outcomeNotes || sv.visitorNote}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Call Recordings ────────────────────────────────────────────── */}
      {(!sectionsOnly || sectionsOnly.includes('callRecordings')) && (
        <div className="card">
          <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Phone size={16} color="var(--primary-600)" /> Call Recordings
          </h4>

          {isGhl && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                className={`btn btn-sm ${callTab === 'agent' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setCallTab('agent')}
              >
                Connect via Agent ({agentCalls.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${callTab === 'irm' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setCallTab('irm')}
              >
                Connect via IRM ({irmCalls.length})
              </button>
            </div>
          )}

          {tabCalls.length === 0 ? (
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
              No calls in this category yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tabCalls.map(c => {
                const isExpanded = !!expandedTranscripts[c.id];
                return (
                  <div
                    key={c.id}
                    style={{
                      border: '1px solid var(--border-base)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      backgroundColor: 'var(--bg-surface)',
                    }}
                  >
                    {/* Call header row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 10,
                            backgroundColor: c.direction === 'inbound' ? '#dcfce7' : '#e0f2fe',
                            color: c.direction === 'inbound' ? '#15803d' : '#0369a1',
                          }}
                        >
                          {c.direction === 'inbound' ? '↙ Inbound' : '↗ Outbound'}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{c.timestamp}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>• {formatDuration(c.duration)}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>• Agent: <strong>{c.agentName || 'Unknown'}</strong></span>
                      </div>
                      <StatusChip status={c.disposition} size="sm" />
                    </div>

                    {/* Notes */}
                    {c.notes && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                        <strong>Notes:</strong> {c.notes}
                      </div>
                    )}

                    {/* Reason (from Call Wrap-up & Disposition) */}
                    {(c as any).reason && (
                      <div style={{ fontSize: 12, marginTop: 6, backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '5px 10px', borderRadius: 5 }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Reason:</strong>{' '}
                        <span style={{ color: 'var(--text-primary)' }}>{(c as any).reason}</span>
                      </div>
                    )}

                    {/* Audio Player */}
                    {c.recordingUrl && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <Volume2 size={12} /> Call Recording Audio
                        </div>
                        <audio controls src={c.recordingUrl} style={{ width: '100%', height: 36 }} />
                      </div>
                    )}

                    {/* Collapsible Transcription */}
                    {c.transcription && (
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 6px', fontSize: 11, gap: 4, color: 'var(--primary-600)' }}
                          onClick={() => toggleTranscript(c.id)}
                        >
                          <FileText size={12} />
                          {isExpanded ? 'Hide Transcription' : 'View Automated Transcription'}
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>

                        {isExpanded && (
                          <div
                            style={{
                              marginTop: 6,
                              padding: '10px 12px',
                              backgroundColor: 'var(--bg-surface-hover)',
                              borderRadius: 6,
                              fontSize: 12,
                              lineHeight: 1.5,
                              color: 'var(--text-primary)',
                              borderLeft: '3px solid var(--primary-600)',
                            }}
                          >
                            {c.transcription}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Activity & Audit History Timeline (Jamin Only) ───────────────────────────── */}
      {(!sectionsOnly || sectionsOnly.includes('details')) && !isGhl && (
        <div className="card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              marginBottom: isActivityOpen ? 12 : 0,
            }}
            onClick={() => setIsActivityOpen(prev => !prev)}
          >
            <h4
              style={{
                fontSize: 15,
                fontWeight: 700,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <History size={16} color="var(--primary-600)" /> Activity & Audit Timeline ({unifiedTimelineEvents.length})
            </h4>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 6px' }}
              onClick={e => {
                e.stopPropagation();
                setIsActivityOpen(prev => !prev);
              }}
            >
              {isActivityOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {isActivityOpen && (
            <div>
              {unifiedTimelineEvents.length === 0 ? (
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--bg-surface-hover)',
                    borderRadius: 8,
                    color: 'var(--text-muted)',
                    fontSize: 13,
                    textAlign: 'center',
                  }}
                >
                  No activities or audits recorded for this lead yet.
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    paddingLeft: 18,
                    borderLeft: '2px solid var(--border-base)',
                    gap: 14,
                    marginLeft: 6,
                  }}
                >
                  {unifiedTimelineEvents.map((ev, idx) => {
                    let formattedTime = ev.timestamp || '';
                    if (formattedTime) {
                      const d = new Date(formattedTime);
                      if (!isNaN(d.getTime())) {
                        formattedTime = d.toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        });
                      }
                    }

                    return (
                      <div
                        key={ev.id || idx}
                        style={{
                          position: 'relative',
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-base)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 14px',
                        }}
                      >
                        {/* Timeline dot */}
                        <div
                          style={{
                            position: 'absolute',
                            left: -25,
                            top: 14,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            backgroundColor: ev.dotColor || 'var(--primary-600)',
                            border: '2px solid #ffffff',
                            boxShadow: '0 0 0 2px var(--border-base)',
                          }}
                        />

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                backgroundColor: ev.badgeBg || '#e0e7ff',
                                color: ev.badgeColor || '#4338ca',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {ev.action.replace(/_/g, ' ')}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <User size={11} /> <strong>{ev.actor || 'System'}</strong>
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                            {formattedTime}
                          </span>
                        </div>

                        {ev.details && (
                          <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 6, lineHeight: 1.45 }}>
                            {ev.details}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
