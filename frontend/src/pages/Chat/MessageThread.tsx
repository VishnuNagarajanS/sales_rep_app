import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Smile,
  Edit2,
  Trash2,
  Check,
  X,
  Paperclip,
  FileText,
  FileSpreadsheet,
  File,
  Download,
  Phone,
  Video,
  Eye,
  Shield,
  Clock,
} from 'lucide-react';
import { ChatConversation, ChatMessage, ChatMember, ChatAttachment, FilePermission } from '../../types';
import * as cs from '../../services/chatStorage';
import { FileShareModal } from './FileShareModal';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏', '✅', '💯', '🙏', '😊'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDateSep(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = today.getTime() - msgDay.getTime();
  if (diff === 0) return 'Today';
  if (diff === 86400000) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function isSameDay(a: string, b: string) {
  const da = new Date(a); const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

interface Props {
  conversation: ChatConversation;
  me: ChatMember;
  companyId: string;
  onStartCall?: (callMode: 'video' | 'audio') => void;
  onJoinCall?: (meetingId: string, callMode: 'video' | 'audio') => void;
}

export const MessageThread: React.FC<Props> = ({
  conversation,
  me,
  companyId,
  onStartCall,
  onJoinCall,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [emojiPickerId, setEmojiPickerId] = useState<string | null>(null);
  const [touchActiveMsgId, setTouchActiveMsgId] = useState<string | null>(null);
  const [typingEntry, setTypingEntry] = useState<cs.TypingEntry | null>(null);
  
  // File Share Pre-Send Modal
  const [showFileModal, setShowFileModal] = useState(false);

  // In-app preview modal
  const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMessages = useCallback(() => {
    setMessages(cs.getMessages(conversation.id));
    setTypingEntry(cs.getTyping(conversation.id, me.id));
  }, [conversation.id, me.id]);

  useEffect(() => {
    loadMessages();
    cs.markRead(conversation.id, companyId);
    const handler = () => loadMessages();
    window.addEventListener('nexus_chat_updated', handler);
    const typingPoll = setInterval(() => setTypingEntry(cs.getTyping(conversation.id, me.id)), 1000);
    return () => {
      window.removeEventListener('nexus_chat_updated', handler);
      clearInterval(typingPoll);
    };
  }, [conversation.id, companyId, loadMessages, me.id]);

  // Click outside or Escape to close emoji picker & touch actions
  useEffect(() => {
    if (!emojiPickerId && !touchActiveMsgId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.chat-emoji-picker, .chat-msg-actions')) {
        setEmojiPickerId(null);
        setTouchActiveMsgId(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEmojiPickerId(null);
        setTouchActiveMsgId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [emojiPickerId, touchActiveMsgId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text && pendingAttachments.length === 0) return;
    cs.sendMessage(conversation.id, companyId, me, text, pendingAttachments.length > 0 ? pendingAttachments : undefined);
    setInput('');
    setPendingAttachments([]);
    cs.setTyping(conversation.id, null);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleAttachmentConfirmed = (attachment: ChatAttachment) => {
    setPendingAttachments(prev => [...prev, attachment]);
    setShowFileModal(false);
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    cs.setTyping(conversation.id, { userId: me.id, userName: me.name, ts: Date.now() });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => cs.setTyping(conversation.id, null), 2500);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const commitEdit = () => {
    if (editingId && editContent.trim()) {
      cs.editMessage(conversation.id, editingId, editContent.trim());
    }
    setEditingId(null);
    setEditContent('');
  };

  const showAvatar = (idx: number) => {
    if (idx === 0) return true;
    return messages[idx].senderId !== messages[idx - 1].senderId;
  };

  const getPermissionLabel = (perm?: FilePermission) => {
    switch (perm) {
      case 'read_only': return 'View only';
      case 'view_edit': return 'View & Edit';
      default: return 'View & Download';
    }
  };

  const otherMember = conversation.type === 'dm' ? conversation.members.find(m => m.id !== me.id) : null;

  return (
    <>
      {/* Thread header */}
      <div className="chat-thread-header">
        <div className={`chat-avatar ${conversation.type === 'group' ? 'group' : ''}`} style={{ width: 40, height: 40, fontSize: conversation.type === 'group' ? 18 : 14 }}>
          {conversation.type === 'group' ? '👥' : initials(otherMember?.name || conversation.name || '?')}
          {conversation.type === 'dm' && otherMember && (
            <span className={`chat-presence-dot ${otherMember.status}`} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="chat-thread-name">
            {conversation.type === 'group' ? (conversation.name || 'Group') : (otherMember?.name || 'Chat')}
          </div>
          <div className="chat-thread-sub">
            {conversation.type === 'group' ? (
              `${conversation.members.length} members`
            ) : otherMember ? (
              <span className="chat-thread-sub-row">
                <span>{otherMember.roleName}</span>
                <span className="chat-thread-sub-sep">·</span>
                <span className={`chat-status-indicator status-${otherMember.status}`}>
                  <span className="chat-status-dot" />
                  <span className="chat-status-text">
                    {otherMember.status === 'online' ? 'Available' : otherMember.status === 'busy' ? 'Busy' : 'Offline'}
                  </span>
                </span>
              </span>
            ) : ''}
          </div>
        </div>

        {/* Action Buttons: Voice Call & Video Meeting */}
        <div className="chat-header-actions">
          <button
            type="button"
            className="chat-hdr-action-btn"
            title="Start Voice Call"
            onClick={() => onStartCall?.('audio')}
          >
            <Phone size={16} />
            <span className="chat-hdr-btn-text">Call</span>
          </button>
          <button
            type="button"
            className="chat-hdr-action-btn primary"
            title="Start Video Meeting"
            onClick={() => onStartCall?.('video')}
          >
            <Video size={16} />
            <span className="chat-hdr-btn-text">Meeting</span>
          </button>
        </div>
      </div>

      {/* Messages list */}
      <div className="chat-messages" onClick={() => setEmojiPickerId(null)}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 40 }}>
            No messages yet. Say hello! 👋
          </div>
        )}

        {messages.map((msg, idx) => {
          const isOwn = msg.senderId === me.id;
          const showDateSep = idx === 0 || !isSameDay(messages[idx - 1].createdAt, msg.createdAt);
          const showSenderAvatar = showAvatar(idx);

          // Check if this is an embedded Interactive Call Card
          const isCallCard = msg.content.startsWith('[CALL:');
          let callPayload: any = null;
          if (isCallCard) {
            try {
              callPayload = JSON.parse(msg.content.slice(6, -1));
            } catch {}
          }

          return (
            <React.Fragment key={msg.id}>
              {showDateSep && (
                <div className="chat-date-sep">
                  <span>{formatDateSep(msg.createdAt)}</span>
                </div>
              )}

              {isCallCard && callPayload ? (
                /* Interactive WebRTC Call Card in Message Thread */
                <div className="chat-call-card-row">
                  <div className={`chat-call-card ${callPayload.status === 'active' ? 'active' : 'ended'}`}>
                    <div className="chat-call-card-icon">
                      {callPayload.callMode === 'audio' ? <Phone size={20} /> : <Video size={20} />}
                    </div>
                    <div className="chat-call-card-info">
                      <div className="chat-call-card-title">
                        <span>{callPayload.callMode === 'audio' ? 'Voice Call' : 'Video Meeting'}</span>
                        {callPayload.status === 'active' ? (
                          <span className="chat-call-badge active">
                            <span className="pulse-dot" /> Live Call
                          </span>
                        ) : (
                          <span className="chat-call-badge ended">
                            <Clock size={11} /> {callPayload.duration || 'Ended'}
                          </span>
                        )}
                      </div>
                      <div className="chat-call-card-sub">
                        Hosted by {callPayload.hostName} · {formatMsgTime(callPayload.startedAt || msg.createdAt)}
                      </div>
                    </div>
                    {callPayload.status === 'active' && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm chat-call-join-btn"
                        onClick={() => onJoinCall?.(callPayload.meetingId, callPayload.callMode)}
                      >
                        Join Call
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Standard Message Row */
                <div
                  className={`chat-msg-row${isOwn ? ' own' : ''}${touchActiveMsgId === msg.id ? ' touch-active' : ''}`}
                  onClick={() => setTouchActiveMsgId(prev => prev === msg.id ? null : msg.id)}
                >
                  <div className="chat-msg-avatar-wrap">
                    {showSenderAvatar && (
                      <div className="chat-msg-avatar">{initials(msg.senderName)}</div>
                    )}
                  </div>

                  <div className="chat-msg-body">
                    {showSenderAvatar && (
                      <div className="chat-msg-meta">
                        <span className="chat-msg-sender">{isOwn ? 'You' : msg.senderName}</span>
                        <span className="chat-msg-time">{formatMsgTime(msg.createdAt)}</span>
                      </div>
                    )}

                    {editingId === msg.id ? (
                      <div>
                        <textarea
                          className="chat-edit-textarea"
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                            if (e.key === 'Escape') { setEditingId(null); }
                          }}
                        />
                        <div className="chat-edit-actions">
                          <button className="btn btn-sm btn-primary" onClick={commitEdit} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Check size={13} /> Save
                          </button>
                          <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <X size={13} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={`chat-msg-bubble${!msg.content && msg.attachments && msg.attachments.length > 0 ? ' file-only' : ''}`}>
                        {msg.isDeleted ? (
                          <span className="chat-msg-deleted">🚫 This message was deleted</span>
                        ) : (
                          <>
                            {msg.content && <div>{msg.content}</div>}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="chat-msg-attachments">
                                {msg.attachments.map(att => {
                                  const isReadOnly = att.permission === 'read_only';
                                  const canDownload = !isReadOnly || isOwn;

                                  return (
                                    <div key={att.id} className="chat-file-card">
                                      <div className="chat-file-card-top">
                                        <div className="chat-file-icon-wrap">
                                          {att.category === 'Image' ? (
                                            <img src={att.dataUrl} alt={att.name} className="chat-file-thumb" onClick={() => setPreviewAttachment(att)} />
                                          ) : att.category === 'PDF' ? (
                                            <FileText size={24} className="cat-icon-pdf" />
                                          ) : att.category === 'Spreadsheet' ? (
                                            <FileSpreadsheet size={24} className="cat-icon-sheet" />
                                          ) : (
                                            <File size={24} className="cat-icon-doc" />
                                          )}
                                        </div>

                                        <div className="chat-file-details">
                                          <div className="chat-file-name" title={att.name} onClick={() => setPreviewAttachment(att)}>
                                            {att.name}
                                          </div>
                                          <div className="chat-file-meta-row">
                                            <span>{formatBytes(att.size)}</span>
                                            <span className="chat-file-sep">·</span>
                                            <span className={`chat-file-perm-badge perm-${att.permission || 'view_download'}`}>
                                              <Shield size={10} />
                                              {getPermissionLabel(att.permission)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="chat-file-card-divider" />

                                      <div className="chat-file-card-actions">
                                        <button
                                          type="button"
                                          className="chat-file-action-link"
                                          onClick={() => setPreviewAttachment(att)}
                                        >
                                          <Eye size={14} />
                                          <span>View</span>
                                        </button>
                                        {canDownload ? (
                                          <a
                                            href={att.dataUrl}
                                            download={att.name}
                                            className="chat-file-action-link"
                                          >
                                            <Download size={14} />
                                            <span>Download</span>
                                          </a>
                                        ) : (
                                          <span
                                            className="chat-file-action-link disabled"
                                            title="Download disabled by sender (Read-only)"
                                          >
                                            <Download size={14} />
                                            <span>Download</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {msg.isEdited && <span className="chat-msg-edited">(edited)</span>}
                          </>
                        )}
                      </div>
                    )}

                    {/* Reactions */}
                    {msg.reactions.length > 0 && !msg.isDeleted && (
                      <div className="chat-reactions">
                        {Array.from(new Set(msg.reactions.map(r => r.emoji))).map(emoji => {
                          const group = msg.reactions.filter(r => r.emoji === emoji);
                          const mine = group.some(r => r.userId === me.id);
                          return (
                            <button
                              key={emoji}
                              className={`chat-reaction-chip${mine ? ' mine' : ''}`}
                              title={group.map(r => r.userName).join(', ')}
                              onClick={e => {
                                e.stopPropagation();
                                cs.toggleReaction(conversation.id, msg.id, emoji, me.id, me.name);
                              }}
                            >
                              {emoji} <span style={{ fontSize: 11, fontWeight: 700 }}>{group.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Actions toolbar directly BELOW the bubble */}
                    {!msg.isDeleted && (
                      <div className={`chat-msg-actions ${emojiPickerId === msg.id ? 'picker-open' : ''}`}>
                        <button
                          type="button"
                          className="chat-action-btn"
                          title="React"
                          onClick={e => {
                            e.stopPropagation();
                            setEmojiPickerId(prev => prev === msg.id ? null : msg.id);
                          }}
                        >
                          <Smile size={14} />
                        </button>
                        {isOwn && !msg.isDeleted && (
                          <>
                            <button
                              type="button"
                              className="chat-action-btn"
                              title="Edit"
                              onClick={e => {
                                e.stopPropagation();
                                setEditingId(msg.id);
                                setEditContent(msg.content);
                                setEmojiPickerId(null);
                              }}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              className="chat-action-btn danger"
                              title="Delete"
                              onClick={e => {
                                e.stopPropagation();
                                if (window.confirm('Are you sure you want to delete this message?')) {
                                  cs.deleteMessage(conversation.id, msg.id);
                                }
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                        {emojiPickerId === msg.id && (
                          <div className="chat-emoji-picker" onClick={e => e.stopPropagation()}>
                            {EMOJIS.map(em => (
                              <button
                                key={em}
                                type="button"
                                className="chat-emoji-btn"
                                onClick={() => {
                                  cs.toggleReaction(conversation.id, msg.id, em, me.id, me.name);
                                  setEmojiPickerId(null);
                                }}
                              >
                                {em}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      <div className="chat-typing-indicator">
        {typingEntry && (
          <>
            <div className="chat-typing-dots"><span /><span /><span /></div>
            <span>{typingEntry.userName} is typing…</span>
          </>
        )}
      </div>

      {/* Input box */}
      <div className="chat-input-area">
        {pendingAttachments.length > 0 && (
          <div className="chat-pending-attachments">
            {pendingAttachments.map(att => (
              <div key={att.id} className="chat-pending-chip">
                <span>{att.category === 'Image' ? '🖼️' : att.category === 'PDF' ? '📄' : '📎'}</span>
                <span>{att.name.length > 20 ? att.name.slice(0, 18) + '…' : att.name}</span>
                <span className={`chat-pending-perm-tag perm-${att.permission}`}>
                  {getPermissionLabel(att.permission)}
                </span>
                <button
                  type="button"
                  className="chat-pending-chip-remove"
                  onClick={() => removePendingAttachment(att.id)}
                  title="Remove attachment"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="chat-input-box">
          <button
            type="button"
            className="chat-attach-btn"
            title="Attach file"
            onClick={() => setShowFileModal(true)}
          >
            <Paperclip size={16} />
          </button>
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder={`Message ${conversation.type === 'group' ? (conversation.name || 'group') : (otherMember?.name || 'chat')}…`}
            value={input}
            rows={1}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          <button
            className="chat-send-btn"
            disabled={!input.trim() && pendingAttachments.length === 0}
            onClick={handleSend}
            title="Send message"
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      {/* File Share Pre-Send Modal */}
      <FileShareModal
        isOpen={showFileModal}
        onClose={() => setShowFileModal(false)}
        onConfirm={handleAttachmentConfirmed}
      />

      {/* In-App Document & Image Preview Modal */}
      {previewAttachment && (
        <div className="chat-preview-modal-overlay" onClick={() => setPreviewAttachment(null)}>
          <div className="chat-preview-modal-box" onClick={e => e.stopPropagation()}>
            <div className="chat-preview-modal-header">
              <div className="chat-preview-title">
                <span style={{ fontWeight: 600 }}>{previewAttachment.name}</span>
                <span className={`chat-file-perm-badge perm-${previewAttachment.permission}`}>
                  {getPermissionLabel(previewAttachment.permission)}
                </span>
              </div>
              <button type="button" className="btn-close-sm" onClick={() => setPreviewAttachment(null)}>×</button>
            </div>
            <div className="chat-preview-body">
              {previewAttachment.category === 'Image' ? (
                <img src={previewAttachment.dataUrl} alt={previewAttachment.name} className="chat-preview-full-img" />
              ) : previewAttachment.category === 'PDF' ? (
                <iframe src={previewAttachment.dataUrl} title={previewAttachment.name} className="chat-preview-iframe" />
              ) : (
                <div className="chat-preview-generic">
                  <FileText size={48} style={{ color: 'var(--primary-600)', marginBottom: 12 }} />
                  <h4>{previewAttachment.name}</h4>
                  <p>{formatBytes(previewAttachment.size)} · {previewAttachment.category} Document</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    Document content preview active. {previewAttachment.permission === 'read_only' ? 'File download is protected by sender policy.' : ''}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
