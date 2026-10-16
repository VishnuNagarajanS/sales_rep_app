import { apiClient } from './apiClient';
import { ChatConversation, ChatMessage, ChatAttachment } from '../types';

export interface CreateConversationPayload {
  id?: string;
  type: 'dm' | 'group';
  name?: string;
  description?: string;
  memberUserIds: number[];
}

export interface SendMessagePayload {
  content: string;
  messageType?: string;
  replyToMessageId?: string;
  attachments?: ChatAttachment[];
}

export interface UpdateConversationPayload {
  name?: string;
  isPinned?: boolean;
  isMuted?: boolean;
}

class ChatApiService {
  async getConversations(): Promise<ChatConversation[]> {
    try {
      const res = await apiClient.get<ChatConversation[]>('/chat/conversations');
      return Array.isArray(res) ? res : ((res as any)?.data || []);
    } catch (err) {
      console.warn('[ChatApiService] getConversations error:', err);
      return [];
    }
  }

  async createConversation(payload: CreateConversationPayload): Promise<ChatConversation> {
    const res = await apiClient.post<ChatConversation>('/chat/conversations', payload);
    return (res as any)?.data || res;
  }

  async getMessages(conversationId: string, limit: number = 100): Promise<ChatMessage[]> {
    try {
      const res = await apiClient.get<ChatMessage[]>(`/chat/conversations/${encodeURIComponent(conversationId)}/messages?limit=${limit}`);
      return Array.isArray(res) ? res : ((res as any)?.data || []);
    } catch (err) {
      console.warn('[ChatApiService] getMessages error:', err);
      return [];
    }
  }

  async sendMessage(conversationId: string, payload: SendMessagePayload): Promise<ChatMessage> {
    const res = await apiClient.post<ChatMessage>(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, payload);
    return (res as any)?.data || res;
  }

  async markAsRead(conversationId: string): Promise<void> {
    try {
      await apiClient.post(`/chat/conversations/${encodeURIComponent(conversationId)}/read`, {});
    } catch (err) {
      console.warn('[ChatApiService] markAsRead error:', err);
    }
  }

  async updateConversation(conversationId: string, payload: UpdateConversationPayload): Promise<void> {
    try {
      await apiClient.patch(`/chat/conversations/${encodeURIComponent(conversationId)}`, payload);
    } catch (err) {
      console.warn('[ChatApiService] updateConversation error:', err);
    }
  }

  async sendTyping(conversationId: string, isTyping: boolean): Promise<void> {
    try {
      await apiClient.post(`/chat/conversations/${encodeURIComponent(conversationId)}/typing`, { isTyping });
    } catch { }
  }

  async toggleReaction(conversationId: string, messageId: string, emoji: string): Promise<ChatMessage> {
    const res = await apiClient.post<ChatMessage>(`/chat/conversations/${encodeURIComponent(conversationId)}/reactions/${encodeURIComponent(messageId)}`, { emoji });
    return (res as any)?.data || res;
  }

  async clearHistory(conversationId: string): Promise<void> {
    await apiClient.post(`/chat/conversations/${encodeURIComponent(conversationId)}/clear`, {});
  }

  async leaveGroup(conversationId: string): Promise<void> {
    await apiClient.post(`/chat/conversations/${encodeURIComponent(conversationId)}/leave`, {});
  }

  async uploadFile(file: File): Promise<ChatAttachment> {
    const token = sessionStorage.getItem('nexus_auth_token') || localStorage.getItem('nexus_auth_token');
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/chat/upload', {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Upload failed with status ${res.status}`);
    }

    const data = await res.json();
    return data;
  }
}

export const chatApiService = new ChatApiService();
