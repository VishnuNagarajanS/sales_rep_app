import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { CallDisposition, CallRecord } from '../types';
import { callsApi, followupsApi, customersApi, leadsApi } from '../services/crmApi';
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
  isExpanded: boolean;
  isVideoMode: boolean;
  meetingLink: string | null;
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
      status: 'connected',
      duration: 0,
      isMuted: false,
      isOnHold: false,
      quickNotes: '',
      matchedRecord: {
        type: recordType,
        id: recordId,
        name,
        meta: `${recordType === 'lead' ? 'Lead' : 'Customer'} • ${phone}`,
      },
      isExpanded: true,
      isVideoMode: false,
      meetingLink: null,
      sourceFollowupId,
    };
    setActiveCall(newCall);
    setAvailability('Busy');
  };

  const simulateIncomingCall = (name = 'Vikram Malhotra', phone = '+91 98765 43210') => {
    const newCall: ActiveCall = {
      id: `call-${Date.now()}`,
      contactName: name,
      contactPhone: phone,
      direction: 'inbound',
      status: 'ringing',
      duration: 0,
      isMuted: false,
      isOnHold: false,
      quickNotes: '',
      matchedRecord: { type: 'unknown', name, meta: 'Incoming Call' },
      isExpanded: true,
      isVideoMode: false,
      meetingLink: null,
    };
    setActiveCall(newCall);

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
    } catch {
      // ignore
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
      setAvailability(prev => (prev === 'Busy' ? 'Available' : prev));
    }
  };

  const endCall = (skipDisposition?: boolean | unknown) => {
    if (activeCall) {
      const finishedCall = { ...activeCall, status: 'ended' as CallStatus };
      setLastCallRecord(finishedCall);
      setActiveCall(null);
      if (skipDisposition === true) {
        setAvailability(prev => (prev === 'Busy' ? 'Available' : prev));
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

  const saveDisposition = (
    disposition: CallDisposition,
    notes: string,
    scheduleFollowup?: { scheduledAt: string; priority: 'Low' | 'Medium' | 'High'; notes: string },
    reason?: string
  ) => {
    if (lastCallRecord && user) {
      const leadIdStr = lastCallRecord.matchedRecord?.type === 'lead' ? lastCallRecord.matchedRecord.id : undefined;
      const leadIdNum = leadIdStr && !isNaN(Number(leadIdStr)) ? Number(leadIdStr) : undefined;
      const customerIdStr = lastCallRecord.matchedRecord?.type === 'customer' ? lastCallRecord.matchedRecord.id : undefined;
      const customerIdNum = customerIdStr && !isNaN(Number(customerIdStr)) ? Number(customerIdStr) : undefined;

      // 1. Log call to Neon database CallRecords table
      callsApi.logCall({
        contactName: lastCallRecord.contactName,
        contactPhone: lastCallRecord.contactPhone,
        direction: lastCallRecord.direction,
        duration: lastCallRecord.duration,
        disposition,
        notes: notes || lastCallRecord.quickNotes || (reason ? `Reason: ${reason}` : ''),
        leadId: leadIdNum,
        customerId: customerIdNum,
      }).catch(() => {});

      // 2. If follow-up requested, create in database
      if (scheduleFollowup || disposition === 'Follow-up Required' || disposition === 'Call Back') {
        const followupTime = scheduleFollowup?.scheduledAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        followupsApi.createFollowup({
          contactId: leadIdStr || customerIdStr || 'contact',
          contactName: lastCallRecord.contactName,
          contactPhone: lastCallRecord.contactPhone,
          contactType: lastCallRecord.matchedRecord?.type || 'lead',
          scheduledAt: followupTime,
          priority: scheduleFollowup?.priority || 'Medium',
          notes: scheduleFollowup?.notes || notes || `Follow-up from call with ${lastCallRecord.contactName}`,
        }).catch(() => {});
      }

      // 3. Update lead status if matched
      if (leadIdNum) {
        if (disposition === 'Interested') {
          leadsApi.convertLead(leadIdNum, { notes }).catch(() => {});
        } else if (disposition === 'Not Interested') {
          leadsApi.updateLead(leadIdNum, {
            status: 'Not Interested',
            dispositionReason: reason || notes || 'Not Interested',
          }).catch(() => {});
        } else if (disposition === 'Wrong Number') {
          leadsApi.updateLead(leadIdNum, {
            status: 'Junk',
            dispositionReason: reason || notes || 'Wrong Number',
          }).catch(() => {});
        } else if (disposition === 'No Response') {
          leadsApi.updateLead(leadIdNum, {
            status: 'No Response',
            notes: notes ? `[No Response] ${notes}` : undefined,
          }).catch(() => {});
        } else if (disposition === 'Follow-up Required' || disposition === 'Call Back') {
          leadsApi.updateLead(leadIdNum, {
            status: disposition,
            notes: notes ? `[${disposition}] ${notes}` : undefined,
          }).catch(() => {});
        }
      }

      // Complete source follow-up if this call originated from one
      if (lastCallRecord.sourceFollowupId) {
        followupsApi.completeFollowup(lastCallRecord.sourceFollowupId).catch(() => {});
      }
    }

    setShowDispositionModal(false);
    setLastCallRecord(null);
    setAvailability(prev => (prev === 'Busy' ? 'Available' : prev));
  };

  const closeDispositionModal = () => {
    setShowDispositionModal(false);
    setLastCallRecord(null);
    setAvailability(prev => (prev === 'Busy' ? 'Available' : prev));
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
