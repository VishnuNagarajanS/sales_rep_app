import React, { useState, useEffect } from 'react';
import { Plus, Users, MessageSquare, Settings, Pin, VolumeX, Volume2, MoreVertical, Edit2, Trash2, LogOut, UserPlus, Search } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import * as cs from '../../services/chatStorage';
import { ChatConversation, ChatMember } from '../../types';

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function relTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function convDisplayName(conv: ChatConversation, meId: string): string {
  if (conv.type === 'group') return conv.name || 'Group';
  const other = conv.members.find(m => m.id !== meId);
  return other?.name || 'Direct Message';
}

function convOtherMember(conv: ChatConversation, meId: string): ChatMember | undefined {
  return conv.members.find(m => m.id !== meId);
}

interface Props {
  conversations: ChatConversation[];
  activeId: string | null;
  meId: string;
  me?: ChatMember;
  onSelect: (id: string) => void;
  onNew: () => void;
  onOpenSettings?: () => void;
}

export const ConversationList: React.FC<Props> = ({
  conversations,
  activeId,
  meId,
  me,
  onSelect,
  onNew,
  onOpenSettings,
}) => {
  const [search, setSearch] = useState('');
  const [openMenuConvId, setOpenMenuConvId] = useState<string | null>(null);
  const [renameModalConv, setRenameModalConv] = useState<ChatConversation | null>(null);
  const [renameText, setRenameText] = useState('');

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!openMenuConvId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.chat-conv-menu-dropdown, .chat-conv-more-btn')) {
        setOpenMenuConvId(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuConvId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openMenuConvId]);

  const isManagerOrAdmin = me?.roleCode === 'company_admin' || me?.roleCode === 'super_admin' || me?.roleCode === 'sales_manager';

  const handleTogglePin = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    cs.togglePinConversation(convId);
    setOpenMenuConvId(null);
  };

  const handleToggleMute = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    cs.toggleMuteConversation(convId);
    setOpenMenuConvId(null);
  };

  const handleOpenRename = (e: React.MouseEvent, conv: ChatConversation) => {
    e.stopPropagation();
    setRenameModalConv(conv);
    setRenameText(conv.name || '');
    setOpenMenuConvId(null);
  };

  const handleClearHistory = (e: React.MouseEvent, conv: ChatConversation) => {
    e.stopPropagation();
    setOpenMenuConvId(null);
    const name = convDisplayName(conv, meId);
    if (window.confirm(`Are you sure you want to clear chat history for "${name}"?`)) {
      cs.clearConversationMessages(conv.id);
    }
  };

  const handleLeaveGroup = (e: React.MouseEvent, conv: ChatConversation) => {
    e.stopPropagation();
    setOpenMenuConvId(null);
    const name = convDisplayName(conv, meId);
    if (window.confirm(`Are you sure you want to leave "${name}"?`)) {
      cs.leaveConversation(conv.id, meId);
    }
  };

  const filtered = conversations.filter(c => {
    const name = convDisplayName(c, meId).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  // Pinned items first, then sort by updatedAt descending
  const sorted = [...filtered].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const formatPreview = (conv: ChatConversation, other?: ChatMember) => {
    if (!conv.lastMessage) {
      return conv.type === 'group' ? `${conv.members.length} members` : other ? other.roleName : '';
    }
    if (conv.lastMessage.isDeleted) return '🚫 Message deleted';
    if (conv.lastMessage.content?.startsWith('[CALL:')) {
      try {
        const payload = JSON.parse(conv.lastMessage.content.slice(6, -1));
        const isAudio = payload.callMode === 'audio';
        return `${isAudio ? '📞 Voice Call' : '📹 Video Meeting'} (${payload.status === 'active' ? 'Live' : payload.duration || 'Ended'})`;
      } catch {
        return '📞 Call record';
      }
    }
    if (conv.type === 'group') {
      return `${conv.lastMessage.senderName}: ${conv.lastMessage.content}`;
    }
    return conv.lastMessage.content;
  };

  return (
    <>
      <div className="chat-sidebar-header">
        <div className="chat-sidebar-title-row">
          <div className="chat-sidebar-title">
            <MessageSquare size={16} style={{ color: 'var(--primary-600)' }} />
            <span>Messages & Calls</span>
          </div>
          {onOpenSettings && (
            <button
              type="button"
              className="chat-hdr-icon-btn"
              title="Chat & Meeting Settings"
              onClick={onOpenSettings}
            >
              <Settings size={16} />
            </button>
          )}
        </div>

        <div className="chat-sidebar-section-row">
          <span className="chat-section-label">Chat</span>
          <button
            type="button"
            className="chat-add-user-btn"
            title="New Chat"
            onClick={onNew}
          >
            <UserPlus size={16} />
          </button>
        </div>
      </div>

      <div className="chat-search-wrap">
        <Search size={15} className="chat-search-icon" />
        <input
          className="chat-search"
          placeholder="Search teammates or groups…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="chat-conv-list">
        {sorted.length === 0 ? (
          <div className="chat-empty-conv">
            <Users size={36} />
            <div style={{ fontWeight: 600 }}>No conversations yet</div>
            <div>Start a conversation with your team</div>
          </div>
        ) : (
          sorted.map(conv => {
            const name = convDisplayName(conv, meId);
            const other = convOtherMember(conv, meId);
            const isGroup = conv.type === 'group';
            const isCall = conv.lastMessage?.content?.startsWith('[CALL:');

            return (
              <div
                key={conv.id}
                className={`chat-conv-item${activeId === conv.id ? ' active' : ''}${openMenuConvId === conv.id ? ' menu-active' : ''}`}
                onClick={() => onSelect(conv.id)}
              >
                <div className={`chat-avatar${isGroup ? ' group' : ''}`}>
                  {isGroup ? '👥' : initials(name)}
                  {!isGroup && other && (
                    <span className={`chat-presence-dot ${other.status}`} />
                  )}
                </div>

                <div className="chat-conv-info">
                  <div className="chat-conv-name-row">
                    <span className="chat-conv-name">{name}</span>
                    {conv.isPinned && <Pin size={12} className="chat-pin-icon" />}
                    {conv.isMuted && <VolumeX size={12} className="chat-mute-icon" />}
                  </div>

                  <div className={`chat-conv-preview ${isCall ? 'call-preview' : ''}`}>
                    {formatPreview(conv, other)}
                  </div>
                </div>

                <div className="chat-conv-meta">
                  <div className="chat-conv-meta-top">
                    <span className="chat-conv-time">{relTime(conv.updatedAt)}</span>
                    <button
                      type="button"
                      className={`chat-conv-more-btn ${openMenuConvId === conv.id ? 'active' : ''}`}
                      title="More options"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuConvId(openMenuConvId === conv.id ? null : conv.id);
                      }}
                    >
                      <MoreVertical size={13} />
                    </button>

                    {openMenuConvId === conv.id && (
                      <div
                        className="chat-conv-menu-dropdown"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* 1. Pin / Unpin */}
                        <button
                          type="button"
                          className="chat-conv-menu-item"
                          onClick={(e) => handleTogglePin(e, conv.id)}
                        >
                          <Pin size={13} />
                          <span>{conv.isPinned ? 'Unpin conversation' : 'Pin conversation'}</span>
                        </button>

                        {/* 2. Mute / Unmute */}
                        <button
                          type="button"
                          className="chat-conv-menu-item"
                          onClick={(e) => handleToggleMute(e, conv.id)}
                        >
                          {conv.isMuted ? <Volume2 size={13} /> : <VolumeX size={13} />}
                          <span>{conv.isMuted ? 'Unmute notifications' : 'Mute notifications'}</span>
                        </button>

                        {/* 3. Rename group (manager/admin only for groups) */}
                        {isGroup && isManagerOrAdmin && (
                          <button
                            type="button"
                            className="chat-conv-menu-item"
                            onClick={(e) => handleOpenRename(e, conv)}
                          >
                            <Edit2 size={13} />
                            <span>Rename group</span>
                          </button>
                        )}

                        <div className="chat-conv-menu-divider" />

                        {/* 4. Clear History */}
                        <button
                          type="button"
                          className="chat-conv-menu-item danger"
                          onClick={(e) => handleClearHistory(e, conv)}
                        >
                          <Trash2 size={13} />
                          <span>Clear history</span>
                        </button>

                        {/* 5. Leave Group (groups only) */}
                        {isGroup && (
                          <button
                            type="button"
                            className="chat-conv-menu-item danger"
                            onClick={(e) => handleLeaveGroup(e, conv)}
                          >
                            <LogOut size={13} />
                            <span>Leave group</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {conv.unreadCount > 0 && (
                    <span className="chat-unread-badge">{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Rename Group Dialog */}
      {renameModalConv && (
        <Modal
          isOpen={!!renameModalConv}
          onClose={() => setRenameModalConv(null)}
          title="Rename Group"
          subtitle="Update the display name for this group chat."
          maxWidth={440}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setRenameModalConv(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!renameText.trim()}
                onClick={() => {
                  if (renameModalConv && renameText.trim()) {
                    cs.renameConversation(renameModalConv.id, renameText.trim());
                    setRenameModalConv(null);
                  }
                }}
              >
                Save Name
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Group Name
            </label>
            <input
              type="text"
              className="form-input"
              value={renameText}
              onChange={e => setRenameText(e.target.value)}
              placeholder="e.g. Sales Team Alpha"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && renameText.trim() && renameModalConv) {
                  e.preventDefault();
                  cs.renameConversation(renameModalConv.id, renameText.trim());
                  setRenameModalConv(null);
                }
              }}
            />
          </div>
        </Modal>
      )}
    </>
  );
};
