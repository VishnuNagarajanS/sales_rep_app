import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { ChatMember, ChatConversation } from '../../types';
import * as cs from '../../services/chatStorage';
import { Check, Lock, ShieldAlert } from 'lucide-react';

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const ROLE_ORDER = ['company_admin', 'sales_executive', 'irm'];
const ROLE_LABELS: Record<string, string> = {
  company_admin: 'Admins',
  sales_executive: 'Sales Executives',
  irm: 'Investor Relationship Managers (IRM)',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  directory: ChatMember[];
  me: ChatMember;
  companyId: string;
  onConversationCreated: (conv: ChatConversation) => void;
}

export const NewConversationModal: React.FC<Props> = ({
  isOpen, onClose, directory, me, companyId, onConversationCreated,
}) => {
  const [tab, setTab] = useState<'dm' | 'group'>('dm');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');

  const savedSettings = cs.getChatSettings(companyId, me.id);
  const isAdminOrManager = me.roleCode === 'company_admin' || me.roleCode === 'sales_manager' || me.roleCode === 'super_admin';
  const canCreateGroup = savedSettings?.adminGovernance?.whoCanCreateGroups !== 'managers_admins' || isAdminOrManager;
  const restrictDmToManagers = savedSettings?.privacy?.whoCanDm === 'managers_admins' && !isAdminOrManager;

  const others = directory.filter(m => m.id !== me.id);

  const isMemberDmAllowed = (m: ChatMember) => {
    if (!restrictDmToManagers) return true;
    return m.roleCode === 'company_admin' || m.roleCode === 'sales_manager' || m.roleCode === 'super_admin';
  };

  const toggleSelect = (id: string, disabled = false) => {
    if (disabled) return;
    if (tab === 'dm') {
      setSelectedIds([id]);
    } else {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }
  };

  const handleCreate = () => {
    if (tab === 'dm') {
      if (selectedIds.length !== 1) return;
      const them = others.find(m => m.id === selectedIds[0])!;
      const conv = cs.getOrCreateDm(companyId, me.id, them, me);
      onConversationCreated(conv);
    } else {
      if (!canCreateGroup || !groupName.trim() || selectedIds.length < 2) return;
      const members = [me, ...others.filter(m => selectedIds.includes(m.id))];
      const conv = cs.createGroup(companyId, groupName.trim(), members);
      onConversationCreated(conv);
    }
    setSelectedIds([]);
    setGroupName('');
    onClose();
  };

  const canCreate = tab === 'dm'
    ? selectedIds.length === 1
    : (canCreateGroup && groupName.trim().length > 0 && selectedIds.length >= 2);

  // Group by role
  const byRole: Record<string, ChatMember[]> = {};
  others.forEach(m => {
    if (!byRole[m.roleCode]) byRole[m.roleCode] = [];
    byRole[m.roleCode].push(m);
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { setSelectedIds([]); setGroupName(''); onClose(); }}
      title="New Conversation"
      subtitle="Start a direct message or create a group"
      maxWidth={520}
      footer={
        <div className="chat-modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedIds([]); setGroupName(''); onClose(); }}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={!canCreate} onClick={handleCreate}>
            {tab === 'dm' ? 'Start Chat' : 'Create Group'}
          </button>
        </div>
      }
    >
      <div>
        {/* Tab toggle */}
        <div className="chat-modal-tabs">
          <button className={`chat-tab-btn${tab === 'dm' ? ' active' : ''}`} onClick={() => { setTab('dm'); setSelectedIds([]); }}>
            💬 Direct Message
          </button>
          <button className={`chat-tab-btn${tab === 'group' ? ' active' : ''}`} onClick={() => { setTab('group'); setSelectedIds([]); }}>
            👥 Group Chat {!canCreateGroup && <Lock size={12} style={{ marginLeft: 4 }} />}
          </button>
        </div>

        {/* Group restricted notice */}
        {tab === 'group' && !canCreateGroup && (
          <div style={{
            padding: '12px 14px',
            margin: '12px 0',
            borderRadius: 8,
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: 'var(--text-secondary)'
          }}>
            <ShieldAlert size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
            <div>
              <strong>Group creation is restricted</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Only Managers and Admins can create new group channels per company policy.</div>
            </div>
          </div>
        )}

        {/* DM restriction notice */}
        {tab === 'dm' && restrictDmToManagers && (
          <div style={{
            padding: '10px 12px',
            marginBottom: 12,
            borderRadius: 8,
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--text-secondary)'
          }}>
            <Lock size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <span>Direct messages are restricted to Managers & Admins by company policy.</span>
          </div>
        )}

        {/* Group name input */}
        {tab === 'group' && canCreateGroup && (
          <div className="chat-group-name-wrap">
            <label htmlFor="chat-new-group-name-input" style={{ display: 'none' }}>Group Name</label>
            <input
              id="chat-new-group-name-input"
              name="groupName"
              aria-label="Group name"
              className="chat-group-name-input"
              placeholder="Group name (e.g. Q4 Sales Team)…"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              autoFocus
            />
            {selectedIds.length >= 2 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                {selectedIds.length} members selected (including you)
              </div>
            )}
          </div>
        )}

        {/* Directory */}
        <div className="chat-dir-list">
          {tab === 'group' && !canCreateGroup ? null : others.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
              No other team members in this workspace yet.
            </div>
          ) : (
            ROLE_ORDER.map(roleCode => {
              const members = byRole[roleCode];
              if (!members || members.length === 0) return null;
              return (
                <React.Fragment key={roleCode}>
                  <div className="chat-dir-group-label">{ROLE_LABELS[roleCode] || roleCode}</div>
                  {members.map(m => {
                    const sel = selectedIds.includes(m.id);
                    const disabled = tab === 'dm' && !isMemberDmAllowed(m);
                    return (
                      <div
                        key={m.id}
                        className={`chat-dir-item${sel ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
                        style={disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                        onClick={() => toggleSelect(m.id, disabled)}
                        title={disabled ? 'Direct messaging restricted to Managers & Admins' : undefined}
                      >
                        <div className="chat-avatar" style={{ width: 36, height: 36, fontSize: 13, position: 'relative' }}>
                          {initials(m.name)}
                          <span className={`chat-presence-dot ${m.status}`} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="chat-dir-name">{m.name}</div>
                          <div className="chat-dir-role">{m.roleName} · {m.status === 'online' ? '🟢 Online' : '⚫ Offline'}</div>
                        </div>
                        {disabled ? (
                          <Lock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        ) : sel ? (
                          <Check size={15} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                        ) : null}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })
          )}
        </div>

        {tab === 'dm' && (
          <div className="chat-self-msg-note">
            Members shown are from your company only.
          </div>
        )}
      </div>
    </Modal>
  );
};
