import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { CallDisposition, CallRecord, Lead, Customer, Deal, Followup, AuditLog } from '../types';
import {
  getFollowups,
  logCall as apiLogCall,
  saveLead as apiSaveLead,
  saveCustomer as apiSaveCustomer,
  saveFollowup as apiSaveFollowup,
  saveDeal as apiSaveDeal,
  getLeads as apiGetLeads,
  getCustomers as apiGetCustomers,
} from '../services/ghlApiService';
import { storageService } from '../services/storageService';
import { jaminApiService } from '../services/jaminApiService';
import { useAuth } from './AuthContext';

export type AgentAvailability = 'Available' | 'Busy' | 'Offline';
export type CallStatus = 'idle' | 'ringing' | 'connected' | 'ended';

interface MatchedRecord {
  type: 'lead' | 'customer' | 'unknown';
  id?: string;
  name?: string;
  meta?: string;
}

interface ActiveCall {
  id: string;
  contactName: string;
  contactPhone: string;
  direction: 'inbound' | 'outbound';
  status: CallStatus;
  duration: number;
  isMuted: boolean;
  isOnHold: boolean;
  quickNotes: string;
  matchedRecord?: MatchedRecord;
  // view-mode fields
  isExpanded: boolean;
  isVideoMode: boolean;
  // Google Meet integration
  meetingLink: string | null;
  // Follow-up task linkage — set when the call is initiated from a scheduled follow-up task.
  // The disposition modal uses this to restrict available Call Outcome options.
  sourceFollowupId?: string;
}

interface CallContextType {
  availability: AgentAvailability;
  setAvailability: (status: AgentAvailability) => void;
  activeCall: ActiveCall | null;
  showDispositionModal: boolean;
  lastCallRecord: ActiveCall | null;
  initiateCall: (name: string, phone: string, recordType?: 'lead' | 'customer', recordId?: string, sourceFollowupId?: string) => void;
  simulateIncomingCall: (name?: string, phone?: string) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: (skipDisposition?: boolean | unknown) => void;
  toggleMute: () => void;
  toggleHold: () => void;
  toggleExpanded: () => void;
  toggleVideoMode: () => void;
  setMeetingLink: (link: string | null) => void;
  setQuickNotes: (notes: string) => void;
  saveDisposition: (
    disposition: CallDisposition,
    notes: string,
    scheduleFollowup?: { scheduledAt: string; priority: 'Low' | 'Medium' | 'High'; notes: string },
    reason?: string
  ) => void;
  closeDispositionModal: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

function getCallPreferences() {
  try {
    const raw = localStorage.getItem('nexus_call_prefs') || localStorage.getItem('nexus_call_preferences');
    return raw
      ? JSON.parse(raw)
      : { soundEnabled: true, desktopNotifEnabled: false, autoBusyEnabled: true, defaultFollowupTime: '11:00' };
  } catch {
    return { soundEnabled: true, desktopNotifEnabled: false, autoBusyEnabled: true, defaultFollowupTime: '11:00' };
  }
}

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, tenant } = useAuth();
  const [availability, setAvailability] = useState<AgentAvailability>('Available');
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [lastCallRecord, setLastCallRecord] = useState<ActiveCall | null>(null);
  const [showDispositionModal, setShowDispositionModal] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);

  const timerRef = useRef<any>(null);

  // Sync leads for incoming call lookup
  useEffect(() => {
    if (tenant?.id) {
      apiGetLeads(tenant.id).then(setLeads).catch(console.error);
    }
  }, [tenant?.id]);

  // Timer for connected calls
  useEffect(() => {
    if (activeCall?.status === 'connected') {
      timerRef.current = setInterval(() => {
        setActiveCall(prev => (prev ? { ...prev, duration: prev.duration + 1 } : null));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCall?.status]);

  const initiateCall = (name: string, phone: string, recordType: 'lead' | 'customer' = 'lead', recordId?: string, sourceFollowupId?: string) => {
    const phoneDigits = (phone || '').replace(/\D/g, '').slice(-10);
    const allLeads = [
      ...(leads || []),
      ...(tenant?.id ? storageService.getLeads(tenant.id) : [])
    ];
    const allCusts = storageService.getCustomers ? (storageService.getCustomers(tenant?.id) || []) : [];

    const matchedLead = allLeads.find(l => {
      if (recordId && (recordType === 'lead' || !recordType) && (l.id === recordId || String(l.id).replace(/\D/g, '') === String(recordId).replace(/\D/g, ''))) return true;
      const lDigits = (l.phone || '').replace(/\D/g, '').slice(-10);
      return phoneDigits && lDigits && phoneDigits === lDigits;
    });

    const matchedCust = allCusts.find(c => {
      if (recordId && recordType === 'customer' && (c.id === recordId || String(c.id).replace(/\D/g, '') === String(recordId).replace(/\D/g, ''))) return true;
      const cDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
      return phoneDigits && cDigits && phoneDigits === cDigits;
    });

    const effectiveType = recordType || (matchedCust ? 'customer' : 'lead');
    const effectiveId = recordId || (effectiveType === 'customer' ? matchedCust?.id : matchedLead?.id);
    const effectiveName = (name && name !== 'Direct Outbound Call' && name !== 'Contact') 
      ? name 
      : (effectiveType === 'customer' ? matchedCust?.name : matchedLead?.name) || name || 'Contact';

    const newCall: ActiveCall = {
      id: `call-${Date.now()}`,
      contactName: effectiveName,
      contactPhone: phone,
      direction: 'outbound',
      status: 'connected', // instantly connected for dialer simulation
      duration: 0,
      isMuted: false,
      isOnHold: false,
      quickNotes: '',
      matchedRecord: {
        type: effectiveType,
        id: effectiveId,
        name: effectiveName,
        meta: effectiveType === 'lead' ? 'Active Inbound Lead' : 'Customer Account',
      },
      isExpanded: true,
      isVideoMode: false,
      meetingLink: null,
      sourceFollowupId,
    };
    setActiveCall(newCall);
    const prefs = getCallPreferences();
    if (prefs.autoBusyEnabled && availability === 'Available') {
      setAvailability('Busy');
    }
  };

  const simulateIncomingCall = (name = 'Kishore Varma', phone = '+91 98860 77112') => {
    if (availability === 'Offline' || availability === 'Busy') {
      return;
    }

    // Check if phone matches any existing lead
    const matchedLead = leads.find(l => l.phone.includes(phone.slice(-5)) || l.name.toLowerCase().includes(name.toLowerCase()));

    const newCall: ActiveCall = {
      id: `call-${Date.now()}`,
      contactName: matchedLead ? matchedLead.name : name,
      contactPhone: matchedLead ? matchedLead.phone : phone,
      direction: 'inbound',
      status: 'ringing',
      duration: 0,
      isMuted: false,
      isOnHold: false,
      quickNotes: '',
      matchedRecord: matchedLead
        ? { type: 'lead', id: matchedLead.id, name: matchedLead.name, meta: `Lead • Priority: ${matchedLead.priority}` }
        : { type: 'unknown', name: 'Unknown Caller', meta: 'Unregistered Number' },
      isExpanded: true,
      isVideoMode: false,
      meetingLink: null,
    };
    setActiveCall(newCall);
    const prefs = getCallPreferences();
    // Play ringtone via Web Audio API if sound is enabled
    if (prefs.soundEnabled) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          osc.frequency.value = 880;
          osc.type = 'sine';
          osc.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        }
      } catch { /* audio not available */ }
    }
    // Desktop notification if enabled and permission granted
    if (prefs.desktopNotifEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('Incoming Call', { body: `${newCall.contactName} — ${newCall.contactPhone}` });
      } catch { /* notifications not available */ }
    }
    if (prefs.autoBusyEnabled) {
      setAvailability('Busy');
    }
  };

  const acceptCall = () => {
    if (activeCall) {
      setActiveCall({ ...activeCall, status: 'connected', duration: 0, isExpanded: true, isVideoMode: false, meetingLink: null });
    }
  };

  const rejectCall = () => {
    if (activeCall) {
      setActiveCall(null);
      setAvailability(prev => prev === 'Busy' ? 'Available' : prev);
    }
  };

  const persistCallRecord = async (
    call: ActiveCall,
    disposition: CallDisposition,
    notes?: string,
    reason?: string
  ): Promise<CallRecord | null> => {
    if (!tenant || !user) return null;

    const isCustomer = call.matchedRecord?.type === 'customer';
    const isLead = call.matchedRecord?.type === 'lead';

    const allLeads = [
      ...(leads || []),
      ...(tenant?.id ? storageService.getLeads(tenant.id) : [])
    ];
    const allCusts = storageService.getCustomers ? (storageService.getCustomers(tenant?.id) || []) : [];
    const phoneDigits = (call.contactPhone || '').replace(/\D/g, '').slice(-10);

    const matchedLead = allLeads.find((l: Lead) => {
      if (call.matchedRecord?.id && (l.id === call.matchedRecord.id || String(l.id).replace(/\D/g, '') === String(call.matchedRecord.id).replace(/\D/g, ''))) return true;
      const lDigits = (l.phone || '').replace(/\D/g, '').slice(-10);
      return phoneDigits && lDigits && phoneDigits === lDigits;
    });

    const matchedCust = allCusts.find((c: Customer) => {
      if (call.matchedRecord?.id && (c.id === call.matchedRecord.id || String(c.id).replace(/\D/g, '') === String(call.matchedRecord.id).replace(/\D/g, ''))) return true;
      const cDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
      return phoneDigits && cDigits && phoneDigits === cDigits;
    });

    const targetLeadId = isLead ? (call.matchedRecord?.id || matchedLead?.id) : matchedLead?.id;
    const targetCustomerId = isCustomer ? (call.matchedRecord?.id || matchedCust?.id) : matchedCust?.id;

    const callRecord: CallRecord = {
      id: call.id,
      companyId: tenant.id,
      customerId: targetCustomerId,
      leadId: targetLeadId,
      contactName: call.contactName,
      contactPhone: call.contactPhone,
      direction: call.direction,
      duration: call.duration,
      agentId: user.id,
      agentName: user.name,
      disposition: disposition || ('' as CallDisposition),
      timestamp: new Date().toISOString(),
      recordingUrl: 'https://cdn.nexusplatform.io/recordings/sample.mp3',
      transcription: disposition
        ? `Automated Call Transcript: Agent ${user.name} connected with ${call.contactName}. Call disposition marked as ${disposition}.`
        : `Automated Call Transcript: Agent ${user.name} connected with ${call.contactName}.`,
      notes: notes || call.quickNotes || undefined,
      reason: reason || undefined,
    };

    let savedRecord: CallRecord;
    try {
      const saved = await apiLogCall(callRecord);
      savedRecord = saved;
    } catch (err) {
      console.warn('CallContext persistCallRecord fallback to local:', err);
      storageService.addCall(callRecord);
      savedRecord = callRecord;
    }

    // Record in Company Audit Log and Lead/Customer Activity Trail
    const dirTitle = (call.direction || 'outbound').charAt(0).toUpperCase() + (call.direction || 'outbound').slice(1).toLowerCase();
    const outcomeDesc = !disposition || disposition === 'Skipped' ? 'Wrap-up Skipped' : `Outcome: ${disposition}`;
    const callNotesDesc = notes ? ` • Note: ${notes}` : '';
    const auditDetails = `${dirTitle} call (${call.duration}s) with ${call.contactName} (${call.contactPhone}) • ${outcomeDesc}${callNotesDesc}`;

    const localAudit: AuditLog = {
      id: `aud-${Date.now()}`,
      companyId: tenant.id,
      timestamp: new Date().toISOString(),
      actorName: user.name,
      actorEmail: user.email,
      action: `${(call.direction || 'outbound').toUpperCase()}_CALL`,
      entityType: targetCustomerId ? 'Customer' : (targetLeadId ? 'Lead' : 'CallRecord'),
      entityId: String(targetCustomerId || targetLeadId || call.id),
      leadId: targetLeadId ? String(targetLeadId).replace(/\D/g, '') : undefined,
      customerId: targetCustomerId ? String(targetCustomerId).replace(/\D/g, '') : undefined,
      details: auditDetails,
      module: 'CallCenter',
      status: (!disposition || disposition === 'Skipped') ? 'Skipped' : disposition,
    };
    storageService.addAuditLog(localAudit);
    window.dispatchEvent(new Event('nexus_storage_updated'));

    return savedRecord;
  };

  const endCall = (skipDisposition?: boolean | unknown) => {
    if (activeCall) {
      const finishedCall = { ...activeCall, status: 'ended' as CallStatus };
      setLastCallRecord(finishedCall);
      setActiveCall(null);

      if (skipDisposition === true) {
        setAvailability(prev => prev === 'Busy' ? 'Available' : prev);
      } else {
        setShowDispositionModal(true);
      }
    }
  };

  const toggleMute = () => {
    if (activeCall) {
      setActiveCall({ ...activeCall, isMuted: !activeCall.isMuted });
    }
  };

  const toggleHold = () => {
    if (activeCall) {
      setActiveCall({ ...activeCall, isOnHold: !activeCall.isOnHold });
    }
  };

  const toggleExpanded = () => {
    if (activeCall) {
      setActiveCall({ ...activeCall, isExpanded: !activeCall.isExpanded });
    }
  };

  const toggleVideoMode = () => {
    if (activeCall) {
      setActiveCall({ ...activeCall, isVideoMode: !activeCall.isVideoMode });
    }
  };

  const setMeetingLink = (link: string | null) => {
    if (activeCall) {
      setActiveCall({ ...activeCall, meetingLink: link });
    }
  };

  const setQuickNotes = (notes: string) => {
    if (activeCall) {
      setActiveCall({ ...activeCall, quickNotes: notes });
    }
  };

  const saveDisposition = async (
    disposition: CallDisposition,
    notes: string,
    scheduleFollowup?: { scheduledAt: string; priority: 'Low' | 'Medium' | 'High'; notes: string },
    reason?: string
  ) => {
    if (lastCallRecord && tenant && user) {
      await persistCallRecord(lastCallRecord, disposition, notes, reason);
      const isJaminTenant = tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' || String(tenant?.id) === '2';

      // Locate matched lead if any
      const rawLeadId = String(lastCallRecord.matchedRecord?.type === 'lead' ? (lastCallRecord.matchedRecord.id || '') : '');
      const cleanLeadId = rawLeadId.replace('db-', '').replace('lead-', '').replace('l-', '').trim();
      const allLeads = [
        ...(leads || []),
        ...(tenant?.id ? storageService.getLeads(tenant.id) : [])
      ];
      const normalize = (p: string) => (p || '').replace(/\D/g, '').slice(-10);
      const callPhoneDigits = normalize(lastCallRecord.contactPhone);
      
      let matchedLead = allLeads.find((l: Lead) => {
        const lCleanId = String(l.id || '').replace('db-', '').replace('lead-', '').replace('l-', '').trim();
        if (cleanLeadId && lCleanId === cleanLeadId) return true;
        const lPhoneDigits = normalize(l.phone);
        if (callPhoneDigits && lPhoneDigits && callPhoneDigits === lPhoneDigits) return true;
        if (lastCallRecord.contactName && l.name && l.name.trim().toLowerCase() === lastCallRecord.contactName.trim().toLowerCase()) return true;
        return false;
      });

      // Complete source follow-up or matching pending follow-up for this contact upon call completion
      try {
        const targetFollowupId = lastCallRecord.sourceFollowupId;
        const allFollowups = await getFollowups(tenant?.id);
        let followupToComplete = targetFollowupId
          ? allFollowups.find(f => f.id === targetFollowupId)
          : null;

        if (!followupToComplete && callPhoneDigits) {
          followupToComplete = allFollowups.find(f => {
            if (f.status !== 'Pending') return false;
            const fPhone = normalize(f.contactPhone);
            return fPhone && fPhone === callPhoneDigits;
          }) || null;
        }

        if (followupToComplete) {
          const completedF: Followup = {
            ...followupToComplete,
            status: 'Completed',
            completedAt: new Date().toISOString(),
            notes: `${followupToComplete.notes ? followupToComplete.notes + ' | ' : ''}Call Completed (${disposition})${notes ? `: ${notes}` : ''}`,
          };
          await apiSaveFollowup(completedF);
          const isJaminTenant =
            tenant?.slug === 'jamin' ||
            tenant?.id === 't-jamin-02' ||
            String(tenant?.id) === '2';
          if (isJaminTenant) {
            jaminApiService.completeFollowup(followupToComplete.id).catch(console.error);
          }
        }
      } catch (fErr) {
        console.warn('[CallContext] Error completing source followup:', fErr);
      }

      // If matchedRecord was a lead but not yet found in array, construct reference to existing lead
      if (!matchedLead && (rawLeadId || lastCallRecord.matchedRecord?.type === 'lead')) {
        matchedLead = {
          id: rawLeadId || `db-${cleanLeadId}`,
          companyId: tenant.id,
          name: lastCallRecord.contactName || 'Lead',
          phone: lastCallRecord.contactPhone,
          email: '',
          location: '',
          source: 'Website Inbound',
          status: 'New',
          priority: 'Medium',
          assignedAgentId: user.id,
          assignedAgentName: user.name,
          createdAt: new Date().toISOString().split('T')[0],
          notes: '',
          customFields: {},
        };
      }

      // 1. Interested -> Keep as active warm lead in Leads (NOT converted yet)
      if (disposition === 'Interested') {
        if (matchedLead) {
          const isJaminTenant =
            tenant?.slug === 'jamin' ||
            tenant?.id === 't-jamin-02' ||
            String(tenant?.id) === '2' ||
            user?.companySlug === 'jamin' ||
            String(user?.companyId) === '2' ||
            matchedLead?.companyId === 't-jamin-02' ||
            String(matchedLead?.companyId) === '2';

          matchedLead.status = 'Interested';
          if (!matchedLead.customFields) matchedLead.customFields = {};
          matchedLead.customFields.qualifiedByAgentName = user.name;
          matchedLead.customFields.qualifiedAt = new Date().toISOString();
          if (!isJaminTenant) {
            matchedLead.customFields.transferredToIrm = 'true';
          }
          apiSaveLead(matchedLead).catch(console.error);
          storageService.saveLead(matchedLead);
          setLeads(prev => prev.map(l => l.id === matchedLead!.id ? matchedLead! : l));
        }
      }

      // 2. Follow-up Required -> Move to Follow-up section, remove from active Leads
      else if (disposition === 'Follow-up Required') {
        const followupScheduledAt = scheduleFollowup?.scheduledAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const followupPriority = scheduleFollowup?.priority || 'High';
        const followupNotes = scheduleFollowup?.notes || (notes ? `Follow-up required: ${notes}` : `Follow-up required from call with ${lastCallRecord.contactName}`);
        const isJaminTenant = tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' || String(tenant?.id) === '2';
        if (!lastCallRecord.sourceFollowupId) {
          const isCust = lastCallRecord.matchedRecord?.type === 'customer';
          const targetCustId = isCust ? (lastCallRecord.matchedRecord?.id ? String(lastCallRecord.matchedRecord.id).replace(/\D/g, '') : undefined) : undefined;
          const targetLeadIdNum = !isCust ? (matchedLead?.id ? String(matchedLead.id).replace(/\D/g, '') : (lastCallRecord.matchedRecord?.id ? String(lastCallRecord.matchedRecord.id).replace(/\D/g, '') : undefined)) : undefined;

          const followupPayload: Followup = {
            id: `flw-${Date.now()}`,
            companyId: tenant.id,
            contactId: isCust
              ? (lastCallRecord.matchedRecord?.id || `customer-${Date.now()}`)
              : (matchedLead?.id || lastCallRecord.matchedRecord?.id || `contact-${Date.now()}`),
            contactName: lastCallRecord.contactName,
            contactPhone: lastCallRecord.contactPhone,
            contactType: isCust ? 'customer' : 'lead',
            leadId: targetLeadIdNum,
            customerId: targetCustId,
            scheduledAt: followupScheduledAt,
            priority: followupPriority,
            status: 'Pending',
            notes: followupNotes,
            assignedAgentId: matchedLead?.assignedAgentId || user.id,
            assignedAgentName: matchedLead?.assignedAgentName || user.name,
          };
          if (isJaminTenant) {
            await jaminApiService.scheduleFollowup({
              contactId: followupPayload.contactId,
              contactType: followupPayload.contactType,
              leadId: targetLeadIdNum,
              customerId: targetCustId,
              contactName: followupPayload.contactName,
              contactPhone: followupPayload.contactPhone,
              scheduledAt: followupPayload.scheduledAt,
              priority: followupPayload.priority,
              notes: followupPayload.notes,
              assignedAgentId: String(followupPayload.assignedAgentId || user.id),
            });
          } else {
            apiSaveFollowup(followupPayload).catch(console.error);
          }
        }

        if (matchedLead) {
          matchedLead.status = 'Follow-up Required';
          matchedLead.nextFollowupDate = followupScheduledAt;
          apiSaveLead(matchedLead).catch(console.error);
        }
      }

      // 3. Call Back -> Keep in Leads section, update status to Callback
      else if (disposition === 'Call Back') {
        if (matchedLead) {
          matchedLead.status = 'Callback';
          if (scheduleFollowup?.scheduledAt) {
            matchedLead.nextFollowupDate = scheduleFollowup.scheduledAt;
          }
          apiSaveLead(matchedLead).catch(console.error);
        } else {
          const newLead: Lead = {
            id: `lead-${Date.now()}`,
            companyId: tenant.id,
            name: lastCallRecord.contactName || 'Unknown Caller',
            phone: lastCallRecord.contactPhone,
            email: '',
            location: '',
            source: 'Inbound Call',
            status: 'Callback',
            priority: 'Medium',
            assignedAgentId: user.id,
            assignedAgentName: user.name,
            createdAt: new Date().toISOString().split('T')[0],
            notes: notes || '',
            customFields: {},
          };
          apiSaveLead(newLead).catch(console.error);
        }

        if (scheduleFollowup) {
          apiSaveFollowup({
            id: `flw-${Date.now()}`,
            companyId: tenant.id,
            contactId: matchedLead?.id || lastCallRecord.matchedRecord?.id || 'contact-new',
            contactName: lastCallRecord.contactName,
            contactPhone: lastCallRecord.contactPhone,
            contactType: 'lead',
            scheduledAt: scheduleFollowup.scheduledAt,
            priority: scheduleFollowup.priority,
            status: 'Pending',
            notes: scheduleFollowup.notes || (notes ? `Callback reminder: ${notes}` : `Callback reminder for ${lastCallRecord.contactName}`),
            assignedAgentId: user.id,
            assignedAgentName: user.name,
          }).catch(console.error);
        }
      }

      // 4. Not Interested -> Remove from Leads, move to Not Interested section
      else if (disposition === 'Not Interested') {
        const reasonText = reason || notes || 'Not Interested';
        if (matchedLead) {
          matchedLead.status = 'Not Interested';
          matchedLead.customFields = { ...matchedLead.customFields, dispositionReason: reasonText };
          apiSaveLead(matchedLead).catch(console.error);
        } else {
          const newLead: Lead = {
            id: `lead-${Date.now()}`,
            companyId: tenant.id,
            name: lastCallRecord.contactName || 'Unknown Caller',
            phone: lastCallRecord.contactPhone,
            email: '',
            location: '',
            source: 'Inbound Call',
            status: 'Not Interested',
            priority: 'Low',
            assignedAgentId: user.id,
            assignedAgentName: user.name,
            createdAt: new Date().toISOString().split('T')[0],
            notes: '',
            customFields: { dispositionReason: reasonText },
          };
          apiSaveLead(newLead).catch(console.error);
        }
      }

      // 5. Wrong Number -> Remove from Leads, move to Junk section
      else if (disposition === 'Wrong Number') {
        const reasonText = reason || notes || 'Wrong Number';
        if (matchedLead) {
          matchedLead.status = 'Junk';
          matchedLead.customFields = { ...matchedLead.customFields, dispositionReason: reasonText };
          apiSaveLead(matchedLead).catch(console.error);
        } else {
          const newLead: Lead = {
            id: `lead-${Date.now()}`,
            companyId: tenant.id,
            name: lastCallRecord.contactName || 'Unknown Caller',
            phone: lastCallRecord.contactPhone,
            email: '',
            location: '',
            source: 'Inbound Call',
            status: 'Junk',
            priority: 'Low',
            assignedAgentId: user.id,
            assignedAgentName: user.name,
            createdAt: new Date().toISOString().split('T')[0],
            notes: '',
            customFields: { dispositionReason: reasonText },
          };
          apiSaveLead(newLead).catch(console.error);
        }
      }

      // 6. No Response -> Keep in Leads section, update status to No Response
      else if (disposition === 'No Response') {
        if (matchedLead) {
          matchedLead.status = 'No Response';
          apiSaveLead(matchedLead).catch(console.error);
        } else {
          const newLead: Lead = {
            id: `lead-${Date.now()}`,
            companyId: tenant.id,
            name: lastCallRecord.contactName || 'Unknown Caller',
            phone: lastCallRecord.contactPhone,
            email: '',
            location: '',
            source: 'Inbound Call',
            status: 'No Response',
            priority: 'Low',
            assignedAgentId: user.id,
            assignedAgentName: user.name,
            createdAt: new Date().toISOString().split('T')[0],
            notes: notes || '',
            customFields: {},
          };
          apiSaveLead(newLead).catch(console.error);
        }
      }

      // 7. Converted -> Instant Conversion to Customer 360
      else if (disposition === 'Converted') {
        if (matchedLead) {
          if (isJaminTenant) {
            // For Jamin Bazaar: conversion is strictly gated behind an active verified plot booking.
            // Do not create a local Customer or mark the lead Converted unless backend confirms conversion.
            const cleanId = String(matchedLead.id).replace('db-', '').replace('lead-', '').replace('l-', '').trim();
            let backendConversionSuccess = false;
            let backendMessage = 'In Jamin Bazaar, lead conversion requires a verified token payment on an active plot booking.';

            if (!isNaN(Number(cleanId)) && Number(cleanId) > 0) {
              try {
                const res = await jaminApiService.convertLead(cleanId, undefined, undefined, matchedLead.notes);
                if (res?.success) {
                  backendConversionSuccess = true;
                } else if (res?.message) {
                  backendMessage = res.message;
                }
              } catch (err: any) {
                if (err?.message) backendMessage = err.message;
              }
            }

            if (backendConversionSuccess) {
              const cust: Customer = {
                id: `cust-${Date.now()}`,
                companyId: tenant.id,
                name: matchedLead.name,
                phone: matchedLead.phone,
                email: matchedLead.email || '',
                status: 'Active',
                assignedAgentId: matchedLead.assignedAgentId || user.id,
                assignedAgentName: matchedLead.assignedAgentName || user.name,
                location: matchedLead.location || '',
                lastContacted: 'Just now',
                openDealsCount: 0,
                totalValue: 0,
                createdAt: new Date().toISOString().split('T')[0],
                notes: `Converted from lead via Call Wrap-up. ${notes ? `Call notes: ${notes}` : ''} ${matchedLead.notes ? `Original: ${matchedLead.notes}` : ''}`.trim(),
                customFields: matchedLead.customFields,
              };
              storageService.saveCustomer(cust);
              apiSaveCustomer(cust).catch(console.error);

              matchedLead.status = 'Converted';
              storageService.saveLead(matchedLead);
              setLeads(prev => prev.filter(l => l.id !== matchedLead!.id));
            } else {
              console.warn(`[Jamin Call Wrap-up] Cannot mark lead Converted: ${backendMessage}`);
              // Retain active lead status without bypassing booking requirement
              if (matchedLead.status !== 'Converted') {
                matchedLead.status = matchedLead.status || 'Interested';
                storageService.saveLead(matchedLead);
                apiSaveLead(matchedLead).catch(console.error);
                setLeads(prev => prev.map(l => l.id === matchedLead!.id ? { ...matchedLead! } : l));
              }
            }
          } else {
            // Generic CRM behavior preserved for GHL India and other tenants
            const cust: Customer = {
              id: `cust-${Date.now()}`,
              companyId: tenant.id,
              name: matchedLead.name,
              phone: matchedLead.phone,
              email: matchedLead.email || '',
              status: 'Active',
              assignedAgentId: matchedLead.assignedAgentId || user.id,
              assignedAgentName: matchedLead.assignedAgentName || user.name,
              location: matchedLead.location || '',
              lastContacted: 'Just now',
              openDealsCount: 0,
              totalValue: 0,
              createdAt: new Date().toISOString().split('T')[0],
              notes: `Converted from lead via Call Wrap-up. ${notes ? `Call notes: ${notes}` : ''} ${matchedLead.notes ? `Original: ${matchedLead.notes}` : ''}`.trim(),
              customFields: matchedLead.customFields,
            };
            storageService.saveCustomer(cust);
            apiSaveCustomer(cust).catch(console.error);

            // Mark Lead as Converted locally and in DB
            matchedLead.status = 'Converted';
            storageService.saveLead(matchedLead);
            setLeads(prev => prev.filter(l => l.id !== matchedLead!.id));

            const cleanId = String(matchedLead.id).replace('db-', '').replace('lead-', '').replace('l-', '').trim();
            if (!isNaN(Number(cleanId)) && Number(cleanId) > 0) {
              jaminApiService.convertLead(cleanId, undefined, undefined, matchedLead.notes).catch(console.error);
            }
          }
        }
      }

      // Ensure updated lead status is saved to storage, API, and local state for all non-converted dispositions
      if (matchedLead && disposition !== 'Converted') {
        storageService.saveLead(matchedLead);
        apiSaveLead(matchedLead).catch(console.error);
        setLeads(prev => prev.map(l => l.id === matchedLead!.id ? { ...matchedLead! } : l));
        window.dispatchEvent(new Event('nexus_storage_updated'));
      }
    }

    setShowDispositionModal(false);
    setLastCallRecord(null);
    setAvailability(prev => prev === 'Busy' ? 'Available' : prev);
  };

  const closeDispositionModal = () => {
    if (lastCallRecord) {
      // Only store the call record itself — do not modify lead status, schedule followups, or assign automatic disposition
      persistCallRecord(
        lastCallRecord,
        '' as CallDisposition,
        lastCallRecord.quickNotes || undefined
      );
    }
    setShowDispositionModal(false);
    setLastCallRecord(null);
    setAvailability(prev => prev === 'Busy' ? 'Available' : prev);
  };

  return (
    <CallContext.Provider
      value={{
        availability,
        setAvailability,
        activeCall,
        showDispositionModal,
        lastCallRecord,
        initiateCall,
        simulateIncomingCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleHold,
        toggleExpanded,
        toggleVideoMode,
        setMeetingLink,
        setQuickNotes,
        saveDisposition,
        closeDispositionModal,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
