import { apiClient } from './apiClient';
import { ApiResponse } from '../types';
import { storageService } from './storageService';

export interface AiChatRequest {
  message: string;
  clientContext?: string;
  history: AiChatMessage[];
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiReference {
  type: string;
  id: string;
  label: string;
  route: string;
}

export interface AiChatResponse {
  answer: string;
  references: AiReference[];
  suggestions: string[];
  declined: boolean;
}

export const aiAssistantService = {
  chat: async (request: AiChatRequest): Promise<ApiResponse<AiChatResponse>> => {
    try {
        const parsed = storageService.getCallPreferences();
        request.clientContext = `Call Preferences: Auto-Busy is ${parsed.autoBusyEnabled ? 'Enabled' : 'Disabled'}. Sound is ${parsed.soundEnabled ? 'Enabled' : 'Disabled'}. Desktop Notifications: ${parsed.desktopNotifEnabled ? 'Enabled' : 'Disabled'}. Default Followup Time: ${parsed.defaultFollowupTime}.`;
    } catch(e) {}
    
    return apiClient.post<AiChatResponse>('/ai/chat', request);
  }
};
