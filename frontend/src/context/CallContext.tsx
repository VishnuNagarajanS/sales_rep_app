import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { CallDisposition, CallRecord, Lead, Customer, Deal } from '../types';
import {
  logCall as apiLogCall,
  saveLead as apiSaveLead,
  saveCustomer as apiSaveCustomer,
  saveFollowup as apiSaveFollowup,
  getFollowups as apiGetFollowups,
  saveDeal as apiSaveDeal,
  getLeads as apiGetLeads,
  getCustomers as apiGetCustomers,
  transitionFollowupToKyc,
} from '../services/ghlApiService';
import { storageService } from '../services/storageService';
import { useAuth } from './AuthContext';
import { twilioVoiceService } from '../services/twilioVoiceService';
import { Call } from '@twilio/voice-sdk';

export type AgentAvailability = 'Available' | 'Busy' | 'Offline';
export type CallStatus = 'idle' | 'ringing' | 'connected' | 'ended' | 'simulated' | 'error' | 'unavailable';

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
  callModule?: string;
  isSimulated?: boolean;
  providerStatus?: string;
  twilioCallSid?: string;
  errorMessage?: string;
}

interface CallContextType {
  availability: AgentAvailability;
  setAvailability: (status: AgentAvailability) => void;
  activeCall: ActiveCall | null;
  showDispositionModal: boolean;
  lastCallRecord: ActiveCall | null;
  initiateCall: (
    name: string,
    phone: string,
    recordType?: 'lead' | 'customer',
    recordId?: string,
    sourceFollowupId?: string,
    callModule?: string
  ) => void;
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
  skipDispositionWithReason: (reason: string, notes?: string) => Promise<void>;
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
  const twilioCallRef = useRef<Call | null>(null);

  // Sync leads for incoming call lookup
  useEffect(() => {
    if (tenant?.id) {
      apiGetLeads(tenant.id).then(setLeads).catch(console.error);
    }
  }, [tenant?.id]);

  // Register Twilio Voice device and incoming call listener
  useEffect(() => {
    if (user?.id) {
      twilioVoiceService.initializeDevice().catch(err => {
        console.warn('[CallContext] Twilio Voice initialization notice:', err?.message || err);
      });

      const unsubIncoming = twilioVoiceService.onIncomingCall((incomingCall: Call) => {
        if (availability === 'Offline' || availability === 'Busy') {
          try { incomingCall.reject(); } catch {}
          return;
        }

        twilioCallRef.current = incomingCall;
        const phone = incomingCall.parameters.From || 'Unknown';
        const sid = incomingCall.parameters.CallSid;

        const matchedLead = leads.find(l => l.phone.includes(phone.slice(-5)) || l.name.toLowerCase().includes(phone.toLowerCase()));

        const newCall: ActiveCall = {
          id: `call-${Date.now()}`,
          contactName: matchedLead ? matchedLead.name : (incomingCall.parameters.From || 'Incoming Caller'),
          contactPhone: phone,
          direction: 'inbound',
          status: 'ringing',
          isSimulated: false,
          twilioCallSid: sid,
          providerStatus: 'Incoming Twilio Voice Call',
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

        incomingCall.on('accept', () => {
          setActiveCall(prev => (prev ? {
            ...prev,
            status: 'connected',
            isSimulated: false,
            twilioCallSid: incomingCall.parameters.CallSid || prev.twilioCallSid,
            providerStatus: 'Twilio Call Connected',
          } : null));
        });

        const handleEnded = () => {
          setActiveCall(prev => {
            if (prev) {
              const finished: ActiveCall = {
                ...prev,
                status: 'ended',
                twilioCallSid: incomingCall.parameters.CallSid || prev.twilioCallSid,
                duration: prev.status === 'connected' ? prev.duration : 0,
              };
              setLastCallRecord(finished);
              setShowDispositionModal(true);
            }
            return null;
          });
          twilioCallRef.current = null;
        };

        incomingCall.on('disconnect', handleEnded);
        incomingCall.on('cancel', handleEnded);
        incomingCall.on('reject', handleEnded);
        incomingCall.on('error', (twErr: any) => {
          console.error('[Twilio] Incoming call error:', twErr);
          handleEnded();
        });

        const prefs = getCallPreferences();
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
          } catch {}
        }
        if (prefs.desktopNotifEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification('Incoming Twilio Call', { body: `${newCall.contactName} — ${newCall.contactPhone}` });
          } catch {}
        }
        if (prefs.autoBusyEnabled) {
          setAvailability('Busy');
        }
      });

      return () => {
        unsubIncoming();
      };
    }
  }, [user?.id, availability, leads]);

  // Timer for connected calls only (never increments for simulated/unconnected calls)
  useEffect(() => {
    if (activeCall?.status === 'connected' && !activeCall.isSimulated) {
      timerRef.current = setInterval(() => {
        setActiveCall(prev => (prev ? { ...prev, duration: prev.duration + 1 } : null));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCall?.status, activeCall?.isSimulated]);

  const initiateCall = async (
    name: string,
    phone: string,
    recordType: 'lead' | 'customer' = 'lead',
    recordId?: string,
    sourceFollowupId?: string,
    callModule?: string
  ) => {
    const callId = `call-${Date.now()}`;
    const newCall: ActiveCall = {
      id: callId,
      contactName: name,
      contactPhone: phone,
      direction: 'outbound',
      status: 'ringing',
      isSimulated: false,
      providerStatus: 'Connecting to Twilio Voice...',
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
      callModule,
    };
    setActiveCall(newCall);

    const prefs = getCallPreferences();
    if (prefs.autoBusyEnabled && availability === 'Available') {
      setAvailability('Busy');
    }

    try {
      const call = await twilioVoiceService.makeCall(phone);
      twilioCallRef.current = call;

      const sid = call.parameters.CallSid;
      if (sid) {
        setActiveCall(prev => (prev ? { ...prev, twilioCallSid: sid } : null));
      }

      call.on('ringing', () => {
        setActiveCall(prev => (prev ? { ...prev, status: 'ringing', providerStatus: 'Twilio: Ringing...' } : null));
      });

      call.on('accept', () => {
        const confirmedSid = call.parameters.CallSid || sid;
        setActiveCall(prev => (prev ? {
          ...prev,
          status: 'connected',
          isSimulated: false,
          twilioCallSid: confirmedSid,
          providerStatus: 'Twilio: Call Connected',
        } : null));
      });

      const handleCallEnded = () => {
        setActiveCall(prev => {
          if (prev) {
            const finished: ActiveCall = {
              ...prev,
              status: 'ended',
              twilioCallSid: call.parameters.CallSid || prev.twilioCallSid,
              duration: prev.status === 'connected' ? prev.duration : 0,
            };
            setLastCallRecord(finished);
            setShowDispositionModal(true);
          }
          return null;
        });
        twilioCallRef.current = null;
      };

      call.on('disconnect', handleCallEnded);
      call.on('cancel', handleCallEnded);
      call.on('reject', handleCallEnded);
      call.on('error', (twErr: any) => {
        console.error('[TwilioCall] Call error:', twErr);
        const errMsg = twErr?.message || 'Call failed';
        setActiveCall(prev => (prev ? {
          ...prev,
          status: 'error',
          providerStatus: `Twilio Error: ${errMsg}`,
          errorMessage: errMsg,
        } : null));
      });

      call.on('mute', (isMuted: boolean) => {
        setActiveCall(prev => (prev ? { ...prev, isMuted } : null));
      });
    } catch (err: any) {
      console.error('[TwilioCall] Outbound call initialization error:', err);
      const errMsg = err?.message || 'Twilio Voice unavailable';
      setActiveCall(prev => (prev ? {
        ...prev,
        status: 'unavailable',
        isSimulated: false,
        providerStatus: `Telephony Gateway Unavailable: ${errMsg}`,
        errorMessage: errMsg,
      } : null));
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
      isSimulated: true,
      providerStatus: 'Simulated Incoming Call (Carrier Offline)',
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
    if (twilioCallRef.current) {
      try {
        twilioCallRef.current.accept();
      } catch (err) {
        console.error('[TwilioCall] accept error:', err);
      }
    } else if (activeCall) {
      const status: CallStatus = activeCall.isSimulated ? 'simulated' : 'connected';
      setActiveCall({ 
        ...activeCall, 
        status, 
        duration: 0, 
        isExpanded: true, 
        isVideoMode: false, 
        meetingLink: null 
      });
    }
  };

  const rejectCall = () => {
    if (twilioCallRef.current) {
      try {
        twilioCallRef.current.reject();
      } catch (err) {
        console.error('[TwilioCall] reject error:', err);
      }
      twilioCallRef.current = null;
    }
    setActiveCall(null);
    setAvailability(prev => prev === 'Busy' ? 'Available' : prev);
  };

  const endCall = (skipDisposition?: boolean | unknown) => {
    if (twilioCallRef.current) {
      try {
        twilioCallRef.current.disconnect();
      } catch (err) {
        console.error('[TwilioCall] disconnect error:', err);
      }
      twilioCallRef.current = null;
    }
    if (activeCall) {
      const isConnectedReal = activeCall.status === 'connected' && !activeCall.isSimulated;
      const finishedCall: ActiveCall = { 
        ...activeCall, 
        status: 'ended' as CallStatus,
        duration: isConnectedReal ? activeCall.duration : 0
      };
      setLastCallRecord(finishedCall);
      setActiveCall(null);
      if (skipDisposition === true || activeCall.status === 'error' || activeCall.status === 'unavailable') {
        setAvailability(prev => prev === 'Busy' ? 'Available' : prev);
      } else {
        setShowDispositionModal(true);
      }
    }
  };

  const toggleMute = () => {
    if (twilioCallRef.current) {
      const nextMute = !activeCall?.isMuted;
      try {
        twilioCallRef.current.mute(nextMute);
      } catch (err) {
        console.error('[TwilioCall] mute error:', err);
      }
      if (activeCall) {
        setActiveCall({ ...activeCall, isMuted: nextMute });
      }
    } else if (activeCall) {
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
      const isRealConnected = !lastCallRecord.isSimulated && lastCallRecord.status === 'connected';
      const isSim = !isRealConnected;
      let finalNotes = notes || lastCallRecord.quickNotes || '';
      if (isSim && !finalNotes.includes('Simulated') && !finalNotes.includes('Not Connected')) {
        finalNotes = finalNotes 
          ? `[Provider Result: Call Not Connected (0s)]\n${finalNotes}` 
          : '[Provider Result: Call Not Connected (0s)]';
      }
      if (reason?.trim()) {
        finalNotes = finalNotes ? `${finalNotes}\n[Reason]: ${reason.trim()}` : `[Reason]: ${reason.trim()}`;
      }

      // Do not mark simulated or unconfirmed calls as connected or successful
      let effectiveDispo = disposition;
      if (isSim && (effectiveDispo === 'Interested' || effectiveDispo === 'Converted')) {
        effectiveDispo = 'No Response';
      }

      const callRecord: CallRecord = {
        id: lastCallRecord.id,
        companyId: tenant.id,
        contactName: lastCallRecord.contactName,
        contactPhone: lastCallRecord.contactPhone,
        direction: lastCallRecord.direction,
        duration: isSim ? 0 : lastCallRecord.duration,
        agentId: user.id,
        agentName: user.name,
        disposition: effectiveDispo,
        timestamp: new Date().toISOString(),
        recordingUrl: undefined,
        transcription: undefined,
        notes: finalNotes || undefined,
        reason: reason || undefined,
        callModule: lastCallRecord.callModule,
        module: lastCallRecord.callModule,
        leadId: lastCallRecord.matchedRecord?.type === 'lead' ? lastCallRecord.matchedRecord.id : undefined,
        customerId: lastCallRecord.matchedRecord?.type === 'customer' ? lastCallRecord.matchedRecord.id : undefined,
        twilioCallSid: lastCallRecord.twilioCallSid,
      };

      await apiLogCall(callRecord);

      // Locate matched lead if any
      const leadId = lastCallRecord.matchedRecord?.type === 'lead' ? lastCallRecord.matchedRecord.id : null;
      const allLeads = leads.length > 0 ? leads : (tenant ? storageService.getLeads(tenant.id) : []);
      const normalize = (p: string) => (p || '').replace(/\D/g, '').slice(-10);
      const callPhoneDigits = normalize(lastCallRecord.contactPhone);
      const matchedLead = leadId
        ? allLeads.find((l: Lead) => l.id === leadId)
        : allLeads.find((l: Lead) =>
            (callPhoneDigits && normalize(l.phone) === callPhoneDigits) ||
            (l.name && l.name.toLowerCase() === lastCallRecord.contactName.toLowerCase())
          );

      // 1. Interested -> Move to Customer 360, remove from active Leads
      if (disposition === 'Interested') {
        const existingCustomers = await apiGetCustomers(tenant.id).catch(() => []);
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
        await apiSaveCustomer(cust);

        if (matchedLead) {
          matchedLead.status = 'Interested';
          matchedLead.notes = `${matchedLead.notes ? matchedLead.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Interested - Handed over to IRM${notes ? `: ${notes}` : ''}`;
          if (!matchedLead.customFields) matchedLead.customFields = {};
          matchedLead.customFields.qualifiedByAgentName = user.name;
          matchedLead.customFields.qualifiedAt = new Date().toISOString();
          matchedLead.customFields.transferredToIrm = 'true';
          await apiSaveLead(matchedLead);
          storageService.saveLead(matchedLead);
        } else if (lastCallRecord.contactPhone || lastCallRecord.contactName) {
          const newInterestedLead: Lead = {
            id: `lead-${Date.now()}`,
            companyId: tenant.id,
            name: lastCallRecord.contactName || 'Interested Prospect',
            phone: lastCallRecord.contactPhone,
            email: '',
            location: '',
            source: 'Phone Call',
            status: 'Interested',
            priority: 'High',
            assignedAgentId: user.id,
            assignedAgentName: user.name,
            createdAt: new Date().toISOString().split('T')[0],
            notes: notes ? `[Call Disposition - Interested]: ${notes}` : 'Interested prospect qualified via call',
            customFields: {
              qualifiedByAgentName: user.name,
              qualifiedAt: new Date().toISOString(),
              transferredToIrm: 'true',
            },
          };
          await apiSaveLead(newInterestedLead);
          storageService.saveLead(newInterestedLead);
        }
      }

      // 2. Follow-up Required -> Create or reuse follow-up record; move lead status to 'Follow-up Required'
      else if (disposition === 'Follow-up Required') {
        const followupScheduledAt = scheduleFollowup?.scheduledAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const followupPriority = scheduleFollowup?.priority || 'High';
        const followupNotes = scheduleFollowup?.notes || (notes ? `Follow-up required: ${notes}` : `Follow-up required from call with ${lastCallRecord.contactName}`);

        if (matchedLead) {
          // Setting status to 'Follow-up Required' reliably moves it out of My Leads (Interested only) to Follow-up
          // while preserving the row in the shared database leads table.
          matchedLead.status = 'Follow-up Required';
          matchedLead.nextFollowupDate = followupScheduledAt;
          if (notes) {
            matchedLead.notes = `${matchedLead.notes ? matchedLead.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Follow-up Required: ${notes}`;
          }
          await apiSaveLead(matchedLead);
          storageService.saveLead(matchedLead);
        }

        await apiSaveFollowup({
          id: `flw-${Date.now()}`,
          companyId: tenant.id,
          contactId: matchedLead?.id || lastCallRecord.matchedRecord?.id || `contact-${Date.now()}`,
          contactName: lastCallRecord.contactName,
          contactPhone: lastCallRecord.contactPhone,
          contactEmail: (matchedLead as any)?.email || (lastCallRecord.matchedRecord as any)?.email || undefined,
          contactType: 'lead',
          scheduledAt: followupScheduledAt,
          priority: followupPriority,
          status: 'Pending',
          notes: followupNotes,
          assignedAgentId: matchedLead?.assignedAgentId || user.id,
          assignedAgentName: matchedLead?.assignedAgentName || user.name,
        });
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
          await apiSaveLead(matchedLead);
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
          await apiSaveLead(newLead);
        }

        if (scheduleFollowup) {
          await apiSaveFollowup({
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
          matchedLead.customFields = { ...matchedLead.customFields, dispositionReason: reasonText };
          await apiSaveLead(matchedLead);
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
          await apiSaveLead(newLead);
        }
      }

      // 5. Wrong Number -> Remove from Leads, move to Junk section
      else if (disposition === 'Wrong Number') {
        const reasonText = reason || notes || 'Wrong Number';
        if (matchedLead) {
          matchedLead.status = 'Junk';
          matchedLead.customFields = { ...matchedLead.customFields, dispositionReason: reasonText };
          await apiSaveLead(matchedLead);
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
          await apiSaveLead(newLead);
        }
      }

      // 6. No Response -> Keep in Leads section, update status to No Response, create scheduled follow-up
      else if (disposition === 'No Response') {
        if (matchedLead) {
          matchedLead.status = 'No Response';
          if (scheduleFollowup?.scheduledAt) {
            matchedLead.nextFollowupDate = scheduleFollowup.scheduledAt;
          }
          if (notes) {
            matchedLead.notes = `${matchedLead.notes ? matchedLead.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] No Response: ${notes}`;
          }
          await apiSaveLead(matchedLead);
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
          await apiSaveLead(newLead);
        }

        if (scheduleFollowup) {
          await apiSaveFollowup({
            id: `flw-${Date.now()}`,
            companyId: tenant.id,
            contactId: matchedLead?.id || lastCallRecord.matchedRecord?.id || 'contact-new',
            contactName: lastCallRecord.contactName,
            contactPhone: lastCallRecord.contactPhone,
            contactType: lastCallRecord.matchedRecord?.type === 'customer' ? 'customer' : 'lead',
            scheduledAt: scheduleFollowup.scheduledAt,
            priority: scheduleFollowup.priority,
            status: 'Pending',
            notes: scheduleFollowup.notes || (notes ? `Follow-up from No Response: ${notes}` : `Follow-up required for ${lastCallRecord.contactName}`),
            assignedAgentId: user.id,
            assignedAgentName: user.name,
          });
        }
      }

      // 7. Converted -> Existing conversion behavior
      else if (disposition === 'Converted') {
        if (matchedLead) {
          const existingCustomers = await apiGetCustomers(tenant.id).catch(() => []);
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
            await apiSaveCustomer(cust);
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
          await apiSaveDeal(newDeal);

          matchedLead.status = 'Converted';
          if (notes) {
            matchedLead.notes = `${matchedLead.notes ? matchedLead.notes + '\n\n' : ''}[${new Date().toLocaleDateString()}] Converted: ${notes}`;
          }
          await apiSaveLead(matchedLead);
        }
      }

      // 8. Ready for KYC -> Transition contact to KYC module and mark follow-up completed
      else if (disposition === 'Ready for KYC') {
        try {
          await transitionFollowupToKyc({
            contactName: lastCallRecord.contactName,
            contactPhone: lastCallRecord.contactPhone,
            contactId: lastCallRecord.matchedRecord?.id,
            followupId: lastCallRecord.sourceFollowupId,
            followupNotes: notes,
            assignedAgentId: user.id,
            assignedAgentName: user.name,
            tenantId: tenant.id,
            tenantName: tenant.name,
            actorName: user.name,
            actorEmail: user.email,
          });
        } catch (err) {
          console.error('[CallContext] Failed to transition to KYC on disposition:', err);
        }
      }

      // 9. Other -> If originated from a follow-up, mark the source follow-up as completed
      else if (disposition === 'Other') {
        if (lastCallRecord.sourceFollowupId) {
          try {
            const followups = await apiGetFollowups(tenant.id).catch(() => []);
            const match = followups.find(f => f.id === lastCallRecord.sourceFollowupId);
            if (match) {
              await apiSaveFollowup({
                ...match,
                status: 'Completed',
                notes: `${match.notes ? match.notes + ' | ' : ''}Reclassified to Other: ${reason || notes || ''}`,
              });
            }
          } catch (err) {
            console.error('[CallContext] Failed to mark source follow-up completed on Other:', err);
          }
        }
      }
    }

    try {
      window.dispatchEvent(new Event('nexus_storage_updated'));
      window.dispatchEvent(new Event('nexus_call_logged'));
    } catch {}

    setShowDispositionModal(false);
    setLastCallRecord(null);
    setAvailability(prev => prev === 'Busy' ? 'Available' : prev);
  };

  const skipDispositionWithReason = async (_reason: string, _notes?: string) => {
    // "Skip for Now" has been completely removed from the disposition workflow.
    console.warn('[CallContext] skipDispositionWithReason is deprecated and disabled.');
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
        skipDispositionWithReason,
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
