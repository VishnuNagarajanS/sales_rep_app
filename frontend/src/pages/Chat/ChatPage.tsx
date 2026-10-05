import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Phone, Video, ArrowLeft } from 'lucide-react';
import { adminUserService } from '../../services/adminUserService';
import { ChatConversation, ChatMember, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import * as cs from '../../services/chatStorage';
import { ConversationList } from './ConversationList';
import { MessageThread } from './MessageThread';
import { NewConversationModal } from './NewConversationModal';
import { MeetingRoom } from './MeetingRoom';
import { ChatSettingsModal } from './ChatSettingsModal';
import './ChatPage.css';

interface ActiveMeetingState {
  id: string;
  participants: ChatMember[];
  callMode: 'video' | 'audio';
  convId?: string;
}

export const ChatPage: React.FC<{ onNavigate?: (route: string) => void }> = ({ onNavigate }) => {
  const { user, tenant } = useAuth();
  const { availability } = useCall();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<ActiveMeetingState | null>(null);
  const [directory, setDirectory] = useState<ChatMember[]>([]);
  const [isMobileThreadOpen, setIsMobileThreadOpen] = useState(false);

  // Derive companyId: prefer numeric/slug id from user, fall back to tenant id
  const companyId = (user?.companyId as string | undefined) ?? tenant?.id ?? '';

  // Map TopBar AgentPresence to chat presence
  const currentPresenceStatus: 'online' | 'busy' | 'offline' =
    availability === 'Available' ? 'online' : availability === 'Busy' ? 'busy' : 'offline';

  // Build "me" as a ChatMember
  const me: ChatMember | null = user
    ? {
      id: String(user.id),
      name: user.name,
      email: user.email,
      roleCode: user.role?.code || 'sales_executive',
      roleName: user.role?.name || 'Sales Executive',
      companyId: String(companyId),
      status: currentPresenceStatus,
    }
    : null;

  // Sync presence to chatStorage whenever TopBar availability changes
  useEffect(() => {
    if (user?.id) {
      cs.setPresence(String(user.id), currentPresenceStatus === 'busy' ? 'online' : currentPresenceStatus);
    }
  }, [user?.id, currentPresenceStatus]);

  const loadData = useCallback(async () => {
    if (!companyId) return;

    // 1. Fetch live company team members from backend API
    let liveUsers: User[] = [];
    try {
      liveUsers = await adminUserService.getUsers(companyId);
    } catch (e) {
      console.error('Failed to load team members for chat', e);
    }

    // 2. Build live directory from backend users
    const presenceMap = cs.getPresence();
    const dir: ChatMember[] = (liveUsers || []).map(u => {
      const uId = String(u.id);
      const isMe = String(user?.id) === uId;
      const isOnline = isMe
        ? (currentPresenceStatus !== 'offline')
        : (presenceMap[uId] === 'online');

      return {
        id: uId,
        name: u.name,
        email: u.email,
        roleCode: u.role?.code || 'sales_executive',
        roleName: u.role?.name || 'Sales Executive',
        companyId: String(companyId),
        status: isOnline ? 'online' : 'offline',
      };
    });
    setDirectory(dir);

    // 3. Load conversations or initialize team channel
    let convs = cs.getConversations(companyId);

    // Update members in existing conversations with live directory and presence
    convs = convs.map(c => {
      const updatedMembers = c.members.map(m => {
        const found = dir.find(d => String(d.id) === String(m.id)) || (String(m.id) === String(me?.id) ? me : null);
        if (found) {
          return {
            ...m,
            name: found.name,
            email: found.email,
            roleCode: found.roleCode,
            roleName: found.roleName,
            status: found.status,
          };
        }
        return m;
      });

      // Deduplicate members
      const uniqueMembers = Array.from(new Map(updatedMembers.map(m => [String(m.id), m])).values());
      return {
        ...c,
        members: uniqueMembers,
        memberIds: uniqueMembers.map(m => String(m.id)),
      };
    });

    if (convs.length === 0 && dir.length > 0) {
      const isJamin = tenant?.slug === 'jamin' || tenant?.id === 't-jamin-02' || tenant?.id === '2';
      const teamName = isJamin 
        ? 'Jamin Bazaar — Sales & Operations'
        : 'Team General Channel';
      const allMembers = me ? [me, ...dir.filter(m => String(m.id) !== String(me.id))] : dir;
      const uniqueMembers = Array.from(new Map(allMembers.map(m => [String(m.id), m])).values());
      const generalConv = cs.createGroup(companyId, teamName, uniqueMembers);
      convs = [generalConv];
    }
    setConversations(convs);
  }, [companyId, tenant?.slug, tenant?.id, me, user?.id, currentPresenceStatus]);

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener('nexus_chat_updated', handler);
    return () => window.removeEventListener('nexus_chat_updated', handler);
  }, [loadData]);

  // Auto-select first conversation if none selected on desktop
  useEffect(() => {
    if (!activeConvId && conversations.length > 0 && window.innerWidth > 768) {
      setActiveConvId(conversations[0].id);
    }
  }, [activeConvId, conversations]);

  const activeConv = conversations.find(c => c.id === activeConvId) ?? null;

  const handleSelect = (id: string) => {
    setActiveConvId(id);
    setIsMobileThreadOpen(true);
    cs.markRead(id, companyId);
    loadData();
  };

  const handleConvCreated = (conv: ChatConversation) => {
    setActiveConvId(conv.id);
    setIsMobileThreadOpen(true);
    loadData();
  };

  // Call Initiation
  const handleStartCall = (callMode: 'video' | 'audio') => {
    if (!activeConv || !me) return;
    const meetingId = `meet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Post interactive call card into the active thread
    cs.sendCallCardMessage(activeConv.id, companyId, me, meetingId, callMode);
    loadData();

    // 2. Open Meeting Room
    setActiveMeeting({
      id: meetingId,
      participants: activeConv.members,
      callMode,
      convId: activeConv.id,
    });
  };

  const handleJoinCall = (meetingId: string, callMode: 'video' | 'audio') => {
    if (!activeConv || !me) return;
    setActiveMeeting({
      id: meetingId,
      participants: activeConv.members,
      callMode,
      convId: activeConv.id,
    });
  };

  const handleCallEnded = (durationStr: string) => {
    if (activeMeeting?.convId) {
      cs.updateCallCardMessage(activeMeeting.convId, activeMeeting.id, durationStr);
      loadData();
    }
    setActiveMeeting(null);
  };

  if (!me) {
    return (
      <div className="chat-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Please log in to use Chat.</p>
      </div>
    );
  }

  return (
    <div className={`chat-page ${isMobileThreadOpen ? 'mobile-thread-open' : ''}`}>
      {/* Left panel — conversation list */}
      <div className="chat-sidebar">
        <ConversationList
          conversations={conversations}
          activeId={activeConvId}
          meId={me.id}
          me={me}
          onSelect={handleSelect}
          onNew={() => setShowNewModal(true)}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
      </div>

      {/* Right panel — message thread */}
      <div className="chat-main">
        {/* Mobile Back Button */}
        {activeConv && (
          <div className="chat-mobile-back-bar">
            <button
              type="button"
              className="btn-ghost btn-sm chat-mobile-back-btn"
              onClick={() => setIsMobileThreadOpen(false)}
            >
              <ArrowLeft size={16} />
              <span>All Chats</span>
            </button>
          </div>
        )}

        {activeConv ? (
          <MessageThread
            key={activeConv.id}
            conversation={activeConv}
            me={me}
            companyId={companyId}
            onStartCall={handleStartCall}
            onJoinCall={handleJoinCall}
          />
        ) : (
          <div className="chat-no-conv">
            <div className="chat-no-conv-icon">
              <MessageSquare size={36} style={{ color: 'var(--primary-600)' }} />
            </div>
            <h3>Welcome to NexusSales Chat</h3>
            <p>Connect with your team, share documents with granular permissions, and launch instant WebRTC calls.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
                Start a Conversation
              </button>
              <button className="btn btn-secondary" onClick={() => setShowSettingsModal(true)}>
                Chat Settings
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      <NewConversationModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        directory={directory}
        me={me}
        companyId={companyId}
        onConversationCreated={handleConvCreated}
      />

      {/* Chat Settings Modal */}
      <ChatSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        me={me}
        companyId={companyId}
        activeConversation={activeConv}
        onConversationUpdated={loadData}
        onNavigate={onNavigate}
      />

      {/* WebRTC Audio/Video Meeting Room Overlay */}
      {activeMeeting && (
        <MeetingRoom
          meetingId={activeMeeting.id}
          participants={activeMeeting.participants}
          callMode={activeMeeting.callMode}
          me={me}
          onClose={() => setActiveMeeting(null)}
          onCallEnded={handleCallEnded}
        />
      )}
    </div>
  );
};
