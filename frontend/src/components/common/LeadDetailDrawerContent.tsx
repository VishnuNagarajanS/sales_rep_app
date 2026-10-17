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
import { AuditLog, CallDisposition, CallRecord, Consultation, SiteVisit, Followup, Lead } from '../../types';
import { storageService } from '../../services/storageService';
import { jaminApiService } from '../../services/jaminApiService';
import { getAuditLogs, getFollowups, getCalls, saveLead as apiSaveLead } from '../../services/ghlApiService';
import { useAuth } from '../../context/AuthContext';
import { StatusChip } from './StatusChip';

export type Lead360Tab = 'overview' | 'followups' | 'siteVisits' | 'callRecordings' | 'timeline';

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
   * When undefined or empty, ALL dispositions are shown.
   */
  callDispositionFilter?: CallDisposition[];
  /** Optional — shown as the last row in the Lead/Investor Details card when provided */
  consultationReason?: string;
  /** Optional — past consultations for this investor when viewing from ConsultationsPage */
  consultationHistory?: Consultation[];
  /** Optional — when true, strips system-generated disposition lines from Notes & Requirements */
  hideAutoNotes?: boolean;
  /** Optional — when provided, renders only the specified sections without tab navigation */
  sectionsOnly?: ('callRecordings' | 'summary' | 'details' | 'consultations' | 'followups' | 'siteVisits' | 'timeline')[];
  /** Optional — explicitly provided call records */
  calls?: CallRecord[];
  /** Optional — explicitly provided lead entity */
  lead?: Lead | null;
  /** Optional — custom overview content provided by parent page */
  overviewContent?: React.ReactNode;
  /** Optional — initial active tab */
  initialTab?: Lead360Tab;
  /** Optional callback to open the conversion modal from within the drawer */
  onConvertToCustomer?: (lead: Lead) => void;
}

export const LeadDetailDrawerContent: React.FC<LeadDetailDrawerContentProps> = ({
  contactName,
  contactPhone,
  contactId,
  contactType = 'lead',
  tenantId,
  onCall,
  callDispositionFilter,
  consultationReason,
  consultationHistory,
  hideAutoNotes = false,
  sectionsOnly,
  calls,
  lead,
  overviewContent,
  initialTab = 'overview',
  onConvertToCustomer,
}) => {
  const { user, tenant } = useAuth();
  const isGhl = tenant?.slug === 'ghl' || tenantId === 't-ghl-01';
  const isSalesExecutive = user?.role?.code === 'sales_executive';

  const [activeTab, setActiveTab] = useState<Lead360Tab>(initialTab);
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({});
  const [callTab, setCallTab] = useState<'agent' | 'irm'>('agent');
  const [isPreviousConsultationsOpen, setIsPreviousConsultationsOpen] = useState(true);
  const [, setSiteVisitsVersion] = useState(0);
  const [apiSiteVisits, setApiSiteVisits] = useState<SiteVisit[]>([]);
  const [apiFollowups, setApiFollowups] = useState<Followup[]>([]);
  const [apiAuditLogs, setApiAuditLogs] = useState<AuditLog[]>([]);
  const [apiCalls, setApiCalls] = useState<CallRecord[]>([]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [contactId, initialTab]);

  useEffect(() => {
    setCallTab('agent');
  }, [contactPhone, contactId, contactType]);

  // ── Canonical Primary Key Resolution ────────────────────────────────────
  const rawIdStr = String(lead?.id || contactId || '').trim();
  const primaryKeyNum = Number(rawIdStr.replace(/^(db-|lead-|customer-)/i, ''));
  const hasValidPrimaryKey = Boolean(
    rawIdStr &&
    rawIdStr !== 'contact-new' &&
    (!isNaN(primaryKeyNum) ? primaryKeyNum > 0 : rawIdStr.length > 0)
  );
  const primaryKeyStr = hasValidPrimaryKey
    ? (Number.isInteger(primaryKeyNum) && primaryKeyNum > 0 ? String(primaryKeyNum) : rawIdStr)
    : '';

  useEffect(() => {
    let isMounted = true;
    if (!hasValidPrimaryKey || primaryKeyNum <= 0) {
      if (isMounted) {
        setApiSiteVisits([]);
        setApiFollowups([]);
        setApiCalls([]);
      }
      return;
    }

    const lId = contactType !== 'customer' ? primaryKeyNum : undefined;
    const cId = contactType === 'customer' ? primaryKeyNum : undefined;

    const fetchSiteVisits = () => {
      jaminApiService.getSiteVisits(true, undefined, undefined, lId, cId).then(visits => {
        if (isMounted) setApiSiteVisits(visits || []);
      }).catch(() => { if (isMounted) setApiSiteVisits([]); });
    };

    fetchSiteVisits();
    window.addEventListener('nexus_storage_updated', fetchSiteVisits);

    const fetchFollowups = () => {
      const p = !isGhl
        ? jaminApiService.getFollowups(true, undefined, undefined, lId, cId)
        : getFollowups(tenantId || tenant?.id, lId, cId);

      p.then(followupItems => {
        if (isMounted && followupItems) {
          setApiFollowups(followupItems);
        }
      }).catch(() => { if (isMounted) setApiFollowups([]); });
    };

    fetchFollowups();
    window.addEventListener('nexus_storage_updated', fetchFollowups);

    const fetchCalls = () => {
      getCalls(tenantId || tenant?.id, lId, cId).then(records => {
        if (isMounted && records) {
          setApiCalls(records);
        }
      }).catch(() => {
        if (isMounted) setApiCalls([]);
      });
    };

    fetchCalls();
    window.addEventListener('nexus_storage_updated', fetchCalls);

    return () => {
      isMounted = false;
      window.removeEventListener('nexus_storage_updated', fetchCalls);
      window.removeEventListener('nexus_storage_updated', fetchSiteVisits);
      window.removeEventListener('nexus_storage_updated', fetchFollowups);
    };
  }, [hasValidPrimaryKey, primaryKeyNum, contactType, tenantId, tenant?.id, isGhl]);

  const handleConfirmLeadSiteVisit = async (sv: SiteVisit) => {
    try {
      await jaminApiService.confirmSiteVisit(sv.id);
      setApiSiteVisits(prev => prev.map(v => String(v.id) === String(sv.id) ? { ...v, status: 'Scheduled' } : v));
      setSiteVisitsVersion(v => v + 1);
      window.dispatchEvent(new Event('nexus_storage_updated'));
    } catch (err) {
      console.error('Failed to confirm site visit:', err);
    }
  };

  const handleCompleteLeadSiteVisit = async (sv: SiteVisit) => {
    try {
      await jaminApiService.completeSiteVisit(sv.id, 'Completed from Lead Details');
      setApiSiteVisits(prev => prev.map(v => String(v.id) === String(sv.id) ? { ...v, status: 'Completed', outcomeNotes: 'Completed from Lead Details' } : v));
      setSiteVisitsVersion(v => v + 1);
      window.dispatchEvent(new Event('nexus_storage_updated'));
    } catch (err) {
      console.error('Failed to complete site visit:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (!hasValidPrimaryKey || primaryKeyNum <= 0) {
      setApiAuditLogs([]);
      return () => { isMounted = false; };
    }
    const filter = contactType === 'customer' ? { customerId: primaryKeyNum } : { leadId: primaryKeyNum };
    getAuditLogs(tenantId || tenant?.id, filter)
      .then(logs => { if (isMounted) setApiAuditLogs(logs || []); })
      .catch(err => {
        console.warn('Failed to load lead activity logs from backend:', err);
        if (isMounted) setApiAuditLogs([]);
      });
    return () => { isMounted = false; };
  }, [hasValidPrimaryKey, primaryKeyNum, contactType, tenantId, tenant?.id]);

  // ── Lead record lookup strictly by Primary Key ───────────────────
  const selectedLead = lead || (() => {
    const leads = storageService.getLeads(tenantId) || [];
    if (hasValidPrimaryKey) {
      return leads.find(l => {
        if (String(l.id) === primaryKeyStr || String(l.id) === rawIdStr) return true;
        const lNum = Number(String(l.id).replace(/^(db-|lead-|customer-)/i, ''));
        return primaryKeyNum > 0 && lNum === primaryKeyNum;
      }) || null;
    }
    return null;
  })();

  const leadAuditLogs = useMemo(
    () =>
      apiAuditLogs
        .filter(l => {
          if (!hasValidPrimaryKey || primaryKeyNum <= 0) return false;
          if (l.leadId && Number(l.leadId) === primaryKeyNum) return true;
          if (l.entityId && (String(l.entityId) === primaryKeyStr || Number(l.entityId) === primaryKeyNum)) return true;
          return true; // backend already filtered by leadId in query
        })
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ),
    [apiAuditLogs, hasValidPrimaryKey, primaryKeyNum, primaryKeyStr]
  );

  // ── Site Visits strictly matching Primary Key ─────────────────────
  const leadSiteVisits = useMemo(() => {
    if (!hasValidPrimaryKey) return [];
    return apiSiteVisits.filter(v => {
      if (contactType === 'customer') {
        const cId = Number(String(v.customerId || '').replace(/^(db-|customer-)/i, ''));
        return (primaryKeyNum > 0 && cId === primaryKeyNum) || String(v.customerId) === primaryKeyStr;
      }
      const lId = Number(String(v.leadId || '').replace(/^(db-|lead-)/i, ''));
      return (primaryKeyNum > 0 && lId === primaryKeyNum) || String(v.leadId) === primaryKeyStr;
    });
  }, [apiSiteVisits, hasValidPrimaryKey, primaryKeyNum, primaryKeyStr, contactType]);

  const allCalls =
    (calls && calls.length > 0 ? calls : null) ||
    (apiCalls.length > 0 ? apiCalls : null) ||
    storageService.getCalls(tenantId) ||
    [];

  // ── Calls strictly matching Primary Key ───────────────────────────
  const selectedCalls = useMemo(() => {
    if (!hasValidPrimaryKey) return [];
    return allCalls
      .filter(c => {
        const cLeadId = c.leadId !== undefined && c.leadId !== null ? String(c.leadId) : '';
        const cContactId = (c as any).contactId !== undefined && (c as any).contactId !== null ? String((c as any).contactId) : '';
        const cCustId = c.customerId !== undefined && c.customerId !== null ? String(c.customerId) : '';
        const cInvId = (c as any).investorId !== undefined && (c as any).investorId !== null ? String((c as any).investorId) : '';

        // Match Primary Key string directly
        if (cLeadId === primaryKeyStr || cLeadId === rawIdStr ||
          cContactId === primaryKeyStr || cContactId === rawIdStr ||
          cCustId === primaryKeyStr || cCustId === rawIdStr ||
          cInvId === primaryKeyStr || cInvId === rawIdStr) {
          return true;
        }

        // Match Primary Key numeric ID
        if (primaryKeyNum > 0) {
          const numLead = Number(cLeadId.replace(/^(db-|lead-|customer-)/i, ''));
          const numContact = Number(cContactId.replace(/^(db-|lead-|customer-)/i, ''));
          const numCust = Number(cCustId.replace(/^(db-|lead-|customer-)/i, ''));
          if ((numLead > 0 && numLead === primaryKeyNum) ||
            (numContact > 0 && numContact === primaryKeyNum) ||
            (numCust > 0 && numCust === primaryKeyNum)) {
            return true;
          }
        }

        return false;
      })
      .filter(
        c =>
          !callDispositionFilter ||
          callDispositionFilter.length === 0 ||
          callDispositionFilter.includes(c.disposition)
      );
  }, [allCalls, hasValidPrimaryKey, primaryKeyStr, rawIdStr, primaryKeyNum, callDispositionFilter]);

  const isIrmCall = (c: CallRecord) =>
    c.source === 'irm' ||
    (c.agentRole || '').toLowerCase() === 'irm' ||
    (c.notes || '').includes('Connect via IRM') ||
    (c.notes || '').includes('Connected to IRM') ||
    (c.agentId || '').toString().toLowerCase().includes('irm') ||
    (c.agentName || '').toLowerCase().includes('irm');

  const agentCalls = selectedCalls.filter(c => !isIrmCall(c));
  const irmCalls = selectedCalls.filter(c => isIrmCall(c));
  const tabCalls = isGhl ? (callTab === 'agent' ? agentCalls : irmCalls) : selectedCalls;

  // ── Follow-up strictly matching Primary Key ───────────────────────
  const leadFollowups = useMemo(() => {
    if (!hasValidPrimaryKey) return [];
    return apiFollowups.filter(f => {
      const fLeadId = f.leadId !== undefined && f.leadId !== null ? String(f.leadId) : '';
      const fContactId = f.contactId !== undefined && f.contactId !== null ? String(f.contactId) : '';
      const fCustId = f.customerId !== undefined && f.customerId !== null ? String(f.customerId) : '';

      // Match Primary Key string directly
      if (fLeadId === primaryKeyStr || fLeadId === rawIdStr ||
        fContactId === primaryKeyStr || fContactId === rawIdStr ||
        fCustId === primaryKeyStr || fCustId === rawIdStr) {
        return true;
      }

      // Match Primary Key numeric ID
      if (primaryKeyNum > 0) {
        const numLead = Number(fLeadId.replace(/^(db-|lead-|customer-)/i, ''));
        const numContact = Number(fContactId.replace(/^(db-|lead-|customer-)/i, ''));
        const numCust = Number(fCustId.replace(/^(db-|lead-|customer-)/i, ''));
        if ((numLead > 0 && numLead === primaryKeyNum) ||
          (numContact > 0 && numContact === primaryKeyNum) ||
          (numCust > 0 && numCust === primaryKeyNum)) {
          return true;
        }
      }

      return false;
    });
  }, [apiFollowups, hasValidPrimaryKey, primaryKeyStr, rawIdStr, primaryKeyNum]);

  const activeFollowupCount = leadFollowups.filter(f => f.status === 'Pending').length;

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
        details: `Lead registered via ${selectedLead.source || 'Inbound'}${selectedLead.targetDevelopment ? ` for project ${selectedLead.targetDevelopment}` : ''}${selectedLead.location ? `, Location: ${selectedLead.location}` : ''}. Status: ${selectedLead.status || 'New'}, Priority: ${selectedLead.priority || 'Medium'}.`,
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
      const outcomeText = !c.disposition || c.disposition === 'Skipped' ? 'Wrap-up Skipped' : `Outcome: ${c.disposition}`;
      events.push({
        id: `call-${c.id}`,
        timestamp: c.timestamp,
        action: `${c.direction.toUpperCase()}_CALL`,
        actor: c.agentName || 'Agent',
        details: `${c.direction === 'inbound' ? 'Inbound' : 'Outbound'} call (${formatDuration(c.duration)}) • ${outcomeText}${c.notes ? ` • Note: ${c.notes}` : ''}`,
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

    // 7. Lead Conversion Milestone
    if (selectedLead?.status === 'Converted') {
      events.push({
        id: `conversion-${selectedLead.id}`,
        timestamp: (selectedLead as any).updatedAt || (selectedLead as any).convertedAt || selectedLead.createdAt || new Date().toISOString(),
        action: 'LEAD_CONVERTED',
        actor: selectedLead.assignedAgentName && selectedLead.assignedAgentName !== 'Unassigned' ? selectedLead.assignedAgentName : 'System',
        details: isGhl
          ? 'Lead successfully converted and promoted to Customer 360.'
          : 'Lead formalized into official Customer 360 via verified plot booking token payment.',
        type: 'audit',
        badgeColor: '#059669',
        badgeBg: '#d1fae5',
        dotColor: '#10b981',
      });
    }

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
  }, [selectedLead, selectedCalls, leadSiteVisits, leadFollowups, leadAuditLogs]);

  // If a legacy caller specifically asks for only one section (like 'callRecordings' alone)
  const isConstrainedMode = Boolean(sectionsOnly && sectionsOnly.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Lead 360 Tab Navigation Bar ───────────────────────────────────────── */}
      {!isConstrainedMode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            borderBottom: '1px solid var(--border-base)',
            paddingBottom: 10,
            overflowX: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 13px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'overview' ? '1px solid var(--primary-500, #3b82f6)' : '1px solid transparent',
              backgroundColor: activeTab === 'overview' ? 'var(--primary-50, rgba(59, 130, 246, 0.12))' : 'transparent',
              color: activeTab === 'overview' ? 'var(--primary-600, #2563eb)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <User size={15} />
            <span>Personal Info</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('followups')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 13px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'followups' ? '1px solid var(--primary-500, #3b82f6)' : '1px solid transparent',
              backgroundColor: activeTab === 'followups' ? 'var(--primary-50, rgba(59, 130, 246, 0.12))' : 'transparent',
              color: activeTab === 'followups' ? 'var(--primary-600, #2563eb)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Clock size={15} />
            <span>Follow-ups</span>
            {leadFollowups.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                  backgroundColor: activeTab === 'followups' ? 'var(--primary-600, #2563eb)' : 'var(--bg-surface-hover)',
                  color: activeTab === 'followups' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 700,
                }}
              >
                {leadFollowups.length}
              </span>
            )}
          </button>

          {(!isGhl || leadSiteVisits.length > 0) && (
            <button
              type="button"
              onClick={() => setActiveTab('siteVisits')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 13px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                border: activeTab === 'siteVisits' ? '1px solid var(--primary-500, #3b82f6)' : '1px solid transparent',
                backgroundColor: activeTab === 'siteVisits' ? 'var(--primary-50, rgba(59, 130, 246, 0.12))' : 'transparent',
                color: activeTab === 'siteVisits' ? 'var(--primary-600, #2563eb)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <MapPin size={15} />
              <span>Site Visits</span>
              {leadSiteVisits.length > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    padding: '1px 6px',
                    borderRadius: 10,
                    backgroundColor: activeTab === 'siteVisits' ? 'var(--primary-600, #2563eb)' : 'var(--bg-surface-hover)',
                    color: activeTab === 'siteVisits' ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: 700,
                  }}
                >
                  {leadSiteVisits.length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('callRecordings')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 13px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'callRecordings' ? '1px solid var(--primary-500, #3b82f6)' : '1px solid transparent',
              backgroundColor: activeTab === 'callRecordings' ? 'var(--primary-50, rgba(59, 130, 246, 0.12))' : 'transparent',
              color: activeTab === 'callRecordings' ? 'var(--primary-600, #2563eb)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Phone size={15} />
            <span>Call Recordings</span>
            {selectedCalls.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                  backgroundColor: activeTab === 'callRecordings' ? 'var(--primary-600, #2563eb)' : 'var(--bg-surface-hover)',
                  color: activeTab === 'callRecordings' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 700,
                }}
              >
                {selectedCalls.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 13px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'timeline' ? '1px solid var(--primary-500, #3b82f6)' : '1px solid transparent',
              backgroundColor: activeTab === 'timeline' ? 'var(--primary-50, rgba(59, 130, 246, 0.12))' : 'transparent',
              color: activeTab === 'timeline' ? 'var(--primary-600, #2563eb)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <History size={15} />
            <span>Activity Logs</span>
            {unifiedTimelineEvents.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                  backgroundColor: activeTab === 'timeline' ? 'var(--primary-600, #2563eb)' : 'var(--bg-surface-hover)',
                  color: activeTab === 'timeline' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 700,
                }}
              >
                {unifiedTimelineEvents.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ── TAB 1: OVERVIEW ───────────────────────────────────────────────────── */}
      {(!isConstrainedMode ? activeTab === 'overview' : (sectionsOnly?.includes('details') || sectionsOnly?.includes('summary'))) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {overviewContent ? (
            overviewContent
          ) : (
            <>
              {/* Fallback default Lead Details card for callers that do not supply overviewContent */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Building2 size={16} color="var(--primary-600)" /> {isGhl ? 'Lead / Investor Details' : 'Lead Details'}
                  </h4>
                  {onConvertToCustomer && selectedLead && selectedLead.status !== 'Converted' && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => onConvertToCustomer(selectedLead)}
                      style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: !isGhl ? '#0284c7' : '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title={!isGhl ? "Formalize plot booking & convert lead via verified token payment" : "Convert this lead into an active Customer record"}
                    >
                      {!isGhl ? <Building2 size={12} /> : <CheckCircle2 size={12} />} {!isGhl ? 'Book Plot / Convert' : 'Convert to Customer'}
                    </button>
                  )}
                </div>
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
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>PRIORITY</span>
                      <div style={{ marginTop: 2 }}>
                        <span className={`badge badge-priority-${(selectedLead.priority || 'medium').toLowerCase()}`}>
                          {selectedLead.priority || 'Medium'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>PREFERRED PROJECT</span>
                      <div style={{ fontWeight: 700, color: '#059669', fontSize: 13, paddingTop: 2 }}>
                        {selectedLead.targetDevelopment || selectedLead.customFields?.targetDevelopment || '—'}
                      </div>
                    </div>
                    {(selectedLead.budgetRange || selectedLead.customFields?.budgetRange || (selectedLead as any).customFields?.investmentCapacity) && (
                      <div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>BUDGET RANGE</span>
                        <div style={{ fontWeight: 600 }}>
                          {selectedLead.budgetRange || selectedLead.customFields?.budgetRange || (selectedLead as any).customFields?.investmentCapacity}
                        </div>
                      </div>
                    )}
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>REGISTRATION TIMELINE</span>
                      <div style={{ fontWeight: 600, color: '#0284c7', marginTop: 2 }}>
                        {selectedLead.readyToRegister || (selectedLead as any).customFields?.readyToRegister || 'Immediate'}
                      </div>
                    </div>
                    {selectedLead.notes && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>NOTES &amp; REQUIREMENTS</span>
                        <div style={{ backgroundColor: 'var(--bg-surface-hover)', padding: '8px 12px', borderRadius: 6, marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                          {selectedLead.notes}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                    Lead details unavailable
                  </div>
                )}
              </div>
            </>
          )}

          {/* Previous Consultations (if any) */}
          {consultationHistory && consultationHistory.length > 0 && (
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
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} color="var(--primary-600)" /> Previous Consultations ({consultationHistory.length})
                </h4>
                <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, backgroundColor: 'var(--bg-surface-hover)', color: 'var(--text-primary)' }}>
                            <Clock size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
                            {item.scheduledAt}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            Consultant: <strong>{item.consultantName}</strong>
                          </span>
                        </div>
                        <StatusChip status={item.status} size="sm" />
                      </div>
                      {item.agenda && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                          <strong>Reason / Agenda:</strong> {item.agenda}
                        </div>
                      )}
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
        </div>
      )}

      {/* ── TAB 2: FOLLOW-UPS ─────────────────────────────────────────────────── */}
      {(!isConstrainedMode ? activeTab === 'followups' : sectionsOnly?.includes('followups')) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} color="var(--primary-600)" /> Follow-up Schedule &amp; History ({leadFollowups.length})
            </h4>
          </div>

          {leadFollowups.length === 0 ? (
            <div
              style={{
                padding: '36px 20px',
                backgroundColor: 'var(--bg-surface-hover)',
                borderRadius: 10,
                border: '1px dashed var(--border-base)',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <Clock size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No Follow-ups Logged</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                There are no scheduled or past follow-up tasks recorded for this lead yet.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {leadFollowups.map(f => (
                <div
                  key={f.id}
                  style={{
                    border: '1px solid var(--border-base)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: 10,
                          backgroundColor: 'var(--bg-surface-hover)',
                          color: 'var(--text-primary)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Clock size={12} />
                        {f.scheduledAt || (f.scheduledDate ? `${f.scheduledDate} ${f.scheduledTime || ''}` : 'Scheduled')}
                      </span>
                      <span className={`badge badge-priority-${(f.priority || 'medium').toLowerCase()}`}>
                        {f.priority || 'Medium'} Priority
                      </span>
                    </div>
                    <StatusChip status={f.status} size="sm" />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10, fontSize: 12 }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Assigned Agent:</span>
                      <div style={{ fontWeight: 600 }}>{f.assignedAgentName || f.assignedToName || 'Agent'}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Follow-up Channel:</span>
                      <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{f.followupType || 'Call'}</div>
                    </div>
                  </div>

                  {f.notes && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        backgroundColor: 'var(--bg-surface-hover)',
                        borderRadius: 6,
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        lineHeight: 1.5,
                      }}
                    >
                      <strong style={{ color: 'var(--text-secondary)' }}>Notes: </strong>
                      {f.notes}
                    </div>
                  )}

                  {f.completedAt && (
                    <div style={{ fontSize: 11, color: '#059669', marginTop: 8, fontWeight: 500 }}>
                      ✓ Completed on {new Date(f.completedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: SITE VISITS ────────────────────────────────────────────────── */}
      {(!isConstrainedMode ? activeTab === 'siteVisits' : sectionsOnly?.includes('siteVisits')) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={16} color="#dc2626" /> Site Visits History &amp; Schedule ({leadSiteVisits.length})
            </h4>
          </div>

          {leadSiteVisits.length === 0 ? (
            <div
              style={{
                padding: '36px 20px',
                backgroundColor: 'var(--bg-surface-hover)',
                borderRadius: 10,
                border: '1px dashed var(--border-base)',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <Calendar size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No Site Visits Scheduled</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                No site visits have been requested or scheduled for this lead yet.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {leadSiteVisits.map(sv => (
                <div
                  key={sv.id}
                  style={{
                    border: '1px solid var(--border-base)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: 10,
                          backgroundColor: 'var(--bg-surface-hover)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Clock size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
                        {sv.scheduledAt || (sv.scheduledDate ? `${sv.scheduledDate} ${sv.scheduledTimeSlot || ''}` : 'Scheduled')}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {sv.projectName} {sv.plotNumber && sv.plotNumber !== '—' ? `• Plot ${sv.plotNumber}` : ''}
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

                      {(sv.status === 'Scheduled' || sv.status === 'Rescheduled') && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          style={{
                            fontSize: '11px',
                            padding: '3px 9px',
                            backgroundColor: '#0284c7',
                            borderColor: '#0284c7',
                          }}
                          onClick={() => handleCompleteLeadSiteVisit(sv)}
                        >
                          <CheckCircle2 size={12} style={{ marginRight: 4 }} /> Mark Completed
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                    Host Agent: <strong>{sv.assignedAgentName || 'Agent'}</strong>
                  </div>

                  {(sv.outcomeNotes || sv.visitorNote) && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        marginTop: 8,
                        padding: '8px 12px',
                        backgroundColor: 'var(--bg-surface-hover)',
                        borderRadius: 6,
                        fontStyle: 'italic',
                      }}
                    >
                      "{sv.outcomeNotes || sv.visitorNote}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: CALL RECORDINGS ────────────────────────────────────────────── */}
      {(!isConstrainedMode ? activeTab === 'callRecordings' : sectionsOnly?.includes('callRecordings')) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Phone size={16} color="var(--primary-600)" /> Call History &amp; Audio Recordings ({tabCalls.length})
            </h4>
          </div>

          {isGhl && (
            <div style={{ display: 'flex', gap: 8 }}>
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
            <div
              style={{
                padding: '36px 20px',
                backgroundColor: 'var(--bg-surface-hover)',
                borderRadius: 10,
                border: '1px dashed var(--border-base)',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <Phone size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No Calls Recorded</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                No inbound or outbound calls recorded for this lead yet.
              </div>
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
                      padding: '14px 16px',
                      backgroundColor: 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
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

                    {c.notes && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                        <strong>Notes:</strong> {c.notes}
                      </div>
                    )}

                    {(c as any).reason && (
                      <div style={{ fontSize: 12, marginTop: 6, backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '5px 10px', borderRadius: 5 }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Reason:</strong>{' '}
                        <span style={{ color: 'var(--text-primary)' }}>{(c as any).reason}</span>
                      </div>
                    )}

                    {c.recordingUrl && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <Volume2 size={12} /> Call Audio Recording
                        </div>
                        <audio controls src={c.recordingUrl} style={{ width: '100%', height: 36 }} />
                      </div>
                    )}

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

      {/* ── TAB 5: ACTIVITY & AUDIT TIMELINE ─────────────────────────────────── */}
      {(!isConstrainedMode ? activeTab === 'timeline' : sectionsOnly?.includes('timeline')) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={16} color="var(--primary-600)" /> Activity &amp; Audit Timeline ({unifiedTimelineEvents.length})
            </h4>
          </div>

          {unifiedTimelineEvents.length === 0 ? (
            <div
              style={{
                padding: '36px 20px',
                backgroundColor: 'var(--bg-surface-hover)',
                borderRadius: 10,
                border: '1px dashed var(--border-base)',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <History size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No Activity Logs Recorded</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                No activity or audit events recorded for this lead yet.
              </div>
            </div>
          ) : (
            <div
              className="lead-activity-timeline"
              role="region"
              aria-label="Lead activity and audit history"
              style={{
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                paddingLeft: 22,
                borderLeft: '2px solid var(--border-base)',
                gap: 14,
                marginLeft: 10,
                marginRight: 4,
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
                      padding: '12px 14px',
                      boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.04))',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: -29,
                        top: 14,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: ev.dotColor || 'var(--primary-600)',
                        border: '2px solid #ffffff',
                        boxShadow: '0 0 0 2px var(--border-base)',
                        zIndex: 1,
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
  );
};
