import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { CallDisposition, CallRecord, Lead, Customer, Deal } from '../types';
import { storageService } from '../services/storageService';
import { executiveApi } from '../services/executiveApi';
import { IS_MOCK_ENV } from '../config/runtime';
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
  endCall: () => void;
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

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, tenant } = useAuth();
  const [availability, setAvailability] = useState<AgentAvailability>('Available');
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [lastCallRecord, setLastCallRecord] = useState<ActiveCall | null>(null);
  const [showDispositionModal, setShowDispositionModal] = useState(false);

  const timerRef = useRef<any>(null);

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
    const newCall: ActiveCall = {
      id: `call-${Date.now()}`,
      contactName: name,
      contactPhone: phone,
      direction: 'outbound',
      status: 'connected', // instantly connected for dialer simulation
      duration: 0,
      isMuted: false,
      isOnHold: false,
      quickNotes: '',
      matchedRecord: {
        type: recordType,
        id: recordId,
        name: name,
        meta: recordType === 'lead' ? 'Active Inbound Lead' : 'Customer Account',
      },
      isExpanded: true,
      isVideoMode: false,
      meetingLink: null,
      sourceFollowupId,
    };
    setActiveCall(newCall);
    const prefs = storageService.getCallPreferences();
    if (prefs.autoBusyEnabled && availability === 'Available') {
      setAvailability('Busy');
    }
  };

  const simulateIncomingCall = (name = 'Kishore Varma', phone = '+91 98860 77112') => {
    if (availability === 'Offline' || availability === 'Busy') {
      return;
    }

    // Check if phone matches any existing lead or customer
    const leads = storageService.getLeads(tenant?.id);
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
    const prefs = storageService.getCallPreferences();
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

  const endCall = () => {
    if (activeCall) {
      const finishedCall = { ...activeCall, status: 'ended' as CallStatus };
      setLastCallRecord(finishedCall);
      setActiveCall(null);
      setShowDispositionModal(true);
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

  const saveDisposition = (
    disposition: CallDisposition,
    notes: string,
    scheduleFollowup?: { scheduledAt: string; priority: 'Low' | 'Medium' | 'High'; notes: string },
    reason?: string
  ) => {
    if (lastCallRecord && tenant && user) {
      const callRecord: CallRecord = {
        id: lastCallRecord.id,
        companyId: tenant.id,
        contactName: lastCallRecord.contactName,
        contactPhone: lastCallRecord.contactPhone,
        direction: lastCallRecord.direction,
        duration: lastCallRecord.duration,
        agentId: user.id,
        agentName: user.name,
        disposition,
        timestamp: new Date().toISOString(),
        recordingUrl: 'https://cdn.nexusplatform.io/recordings/sample.mp3',
        transcription: `Automated Call Transcript: Agent ${user.name} connected with ${lastCallRecord.contactName}. Call disposition marked as ${disposition}.`,
        notes: reason ? `${notes}\n\nReason: ${reason}` : (notes || lastCallRecord.quickNotes),
      };

      if (!IS_MOCK_ENV && user.role.code === 'sales_executive') {
        void executiveApi.processDisposition({
          contactName: callRecord.contactName,
          contactPhone: callRecord.contactPhone,
          direction: callRecord.direction,
          duration: callRecord.duration,
          disposition,
          notes: callRecord.notes,
        }).catch(error => console.error('Failed to persist call disposition', error));
      }

      storageService.addCall(callRecord);

      storageService.addAuditLog({
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        actorName: user.name,
        actorEmail: user.email,
        action: 'CALL_DISPOSITION_SAVED',
        entityType: 'CallRecord',
        entityId: callRecord.id,
        companyId: tenant.id,
        companyName: tenant.name,
        details: `Saved disposition "${disposition}" for call with ${lastCallRecord.contactName} (${lastCallRecord.duration}s).`,
      });

      // Locate matched lead if any
      const leadId = lastCallRecord.matchedRecord?.type === 'lead' ? lastCallRecord.matchedRecord.id : null;
      const allLeads = storageService.getLeads(tenant.id);
      const matchedLead = leadId
        ? allLeads.find(l => l.id === leadId)
        : allLeads.find(l => l.phone === lastCallRecord.contactPhone || (l.name && l.name.toLowerCase() === lastCallRecord.contactName.toLowerCase()));

      // 1. Interested -> Move to Customer 360, remove from active Leads
      if (disposition === 'Interested') {
        const existingCustomers = storageService.getCustomers(tenant.id);
        let cust = existingCustomers.find(c =>
          (matchedLead && c.phone === matchedLead.phone) ||
          c.phone === lastCallRecord.contactPhone ||
          (matchedLead?.email && c.email === matchedLead.email)
        );

        if (!cust) {
          cust = {
            id: matchedLead ? `cust-${matchedLead.id.replace('lead-', '')}` : `cust-${Date.now()}`,
            companyId: tenant.id,
            name: matchedLead?.name || lastCallRecord.contactName || 'Customer',
            phone: matchedLead?.phone || lastCallRecord.contactPhone,
            email: matchedLead?.email || '',
            status: 'Active',
            assignedAgentId: matchedLead?.assignedAgentId || user.id,
            assignedAgentName: matchedLead?.assignedAgentName || user.name,
            location: matchedLead?.location || '',
            lastContacted: 'Just now',
            openDealsCount: 0,
            totalValue: 0,
            createdAt: matchedLead?.createdAt || new Date().toISOString().split('T')[0],
            notes: notes
              ? `${matchedLead?.notes ? matchedLead.notes + '\n\n' : ''}[Call Disposition - Interested]: ${notes}`
              : (matchedLead?.notes || 'Interested - Transferred to Customer 360'),
            customFields: {
              ...(matchedLead?.customFields || {}),
              movedFromLeadAt: new Date().toISOString(),
              disposition: 'Interested',
            },
          };
        } else {
          cust.lastContacted = 'Just now';
          if (notes) {
            cust.notes = cust.notes ? `${cust.notes}\n\n[Call Disposition - Interested]: ${notes}` : `[Call Disposition - Interested]: ${notes}`;
          }
          if (matchedLead?.customFields) {
            cust.customFields = { ...cust.customFields, ...matchedLead.customFields };
          }
        }
        storageService.saveCustomer(cust);

        if (matchedLead) {
          matchedLead.status = 'Converted';
          matchedLead.notes = `${matchedLead.notes ? matchedLead.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Interested - Moved to Customer 360${notes ? `: ${notes}` : ''}`;
          storageService.saveLead(matchedLead);
        }
      }

      // 2. Follow-up Required -> Move to Follow-up section, remove from active Leads
      else if (disposition === 'Follow-up Required') {
        const followupScheduledAt = scheduleFollowup?.scheduledAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const followupPriority = scheduleFollowup?.priority || 'High';
        const followupNotes = scheduleFollowup?.notes || (notes ? `Follow-up required: ${notes}` : `Follow-up required from call with ${lastCallRecord.contactName}`);

        storageService.saveFollowup({
          id: `flw-${Date.now()}`,
          companyId: tenant.id,
          contactId: matchedLead?.id || lastCallRecord.matchedRecord?.id || `contact-${Date.now()}`,
          contactName: lastCallRecord.contactName,
          contactPhone: lastCallRecord.contactPhone,
          contactType: 'lead',
          scheduledAt: followupScheduledAt,
          priority: followupPriority,
          status: 'Pending',
          notes: followupNotes,
          assignedAgentId: matchedLead?.assignedAgentId || user.id,
          assignedAgentName: matchedLead?.assignedAgentName || user.name,
        });

        if (matchedLead) {
          matchedLead.status = 'Follow-up Required';
          matchedLead.nextFollowupDate = followupScheduledAt;
          if (notes) {
            matchedLead.notes = `${matchedLead.notes ? matchedLead.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Follow-up Required: ${notes}`;
          }
          storageService.saveLead(matchedLead);
        }
      }

      // 3. Call Back -> Keep in Leads section, update status to Callback
      else if (disposition === 'Call Back') {
        if (matchedLead) {
          matchedLead.status = 'Callback';
          if (scheduleFollowup?.scheduledAt) {
            matchedLead.nextFollowupDate = scheduleFollowup.scheduledAt;
          }
          if (notes) {
            matchedLead.notes = `${matchedLead.notes ? matchedLead.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Call Back: ${notes}`;
          }
          storageService.saveLead(matchedLead);
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
          storageService.saveLead(newLead);
        }

        if (scheduleFollowup) {
          storageService.saveFollowup({
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
          });
        }
      }

      // 4. Not Interested -> Remove from Leads, move to Not Interested section
      else if (disposition === 'Not Interested') {
        const reasonText = reason || notes || 'Not Interested';
        if (matchedLead) {
          matchedLead.status = 'Not Interested';
          matchedLead.notes = `${matchedLead.notes ? matchedLead.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Not Interested Reason: ${reasonText}`;
          matchedLead.customFields = { ...matchedLead.customFields, dispositionReason: reasonText };
          storageService.saveLead(matchedLead);
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
            notes: `[${new Date().toLocaleDateString()}] Not Interested Reason: ${reasonText}`,
            customFields: { dispositionReason: reasonText },
          };
          storageService.saveLead(newLead);
        }
      }

      // 5. Wrong Number -> Remove from Leads, move to Junk section
      else if (disposition === 'Wrong Number') {
        const reasonText = reason || notes || 'Wrong Number';
        if (matchedLead) {
          matchedLead.status = 'Junk';
          matchedLead.notes = `${matchedLead.notes ? matchedLead.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Junk / Wrong Number Reason: ${reasonText}`;
          matchedLead.customFields = { ...matchedLead.customFields, dispositionReason: reasonText };
          storageService.saveLead(matchedLead);
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
            notes: `[${new Date().toLocaleDateString()}] Wrong Number Reason: ${reasonText}`,
            customFields: { dispositionReason: reasonText },
          };
          storageService.saveLead(newLead);
        }
      }

      // 6. No Response -> Keep in Leads section, update status to No Response
      else if (disposition === 'No Response') {
        if (matchedLead) {
          matchedLead.status = 'No Response';
          if (notes) {
            matchedLead.notes = `${matchedLead.notes ? matchedLead.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] No Response: ${notes}`;
          }
          storageService.saveLead(matchedLead);
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
          storageService.saveLead(newLead);
        }
      }

      // 7. Converted -> Existing conversion behavior
      else if (disposition === 'Converted') {
        if (matchedLead) {
          const existingCustomers = storageService.getCustomers(tenant.id);
          let cust = existingCustomers.find(c => c.phone === matchedLead.phone || (matchedLead.email && c.email === matchedLead.email));
          if (!cust) {
            cust = {
              id: `cust-${matchedLead.id.replace('lead-', '')}`,
              companyId: tenant.id,
              name: matchedLead.name,
              phone: matchedLead.phone,
              email: matchedLead.email || '',
              status: 'Active',
              assignedAgentId: matchedLead.assignedAgentId || user.id,
              assignedAgentName: matchedLead.assignedAgentName || user.name,
              location: matchedLead.location || '',
              lastContacted: 'Just now',
              openDealsCount: 1,
              totalValue: 5000000,
              createdAt: new Date().toISOString().split('T')[0],
              notes: `Converted from lead. Original notes: ${matchedLead.notes || ''}`,
              customFields: matchedLead.customFields,
            };
            storageService.saveCustomer(cust);
          }

          const newDeal: Deal = {
            id: `deal-${Date.now()}`,
            companyId: tenant.id,
            title: `${cust.name} - Investment Consultation`,
            customerId: cust.id,
            customerName: cust.name,
            stage: tenant.slug === 'jamin' ? 'site_visit' : 'consultation',
            value: 5000000,
            expectedCloseDate: 'Within 30 Days',
            assignedAgentId: matchedLead.assignedAgentId || user.id,
            assignedAgentName: matchedLead.assignedAgentName || user.name,
            notes: `Deal initiated upon converting lead ${matchedLead.name}. ${notes ? `Call notes: ${notes}` : ''}`,
            createdAt: new Date().toISOString().split('T')[0],
          };
          storageService.saveDeal(newDeal);

          matchedLead.status = 'Converted';
          if (notes) {
            matchedLead.notes = `${matchedLead.notes ? matchedLead.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Converted: ${notes}`;
          }
          storageService.saveLead(matchedLead);
        }
      }
    }

    setShowDispositionModal(false);
    setLastCallRecord(null);
    setAvailability(prev => prev === 'Busy' ? 'Available' : prev);
  };

  const closeDispositionModal = () => {
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
