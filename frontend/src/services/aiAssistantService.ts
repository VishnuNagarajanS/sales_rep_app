import { apiClient } from './apiClient';
import { ApiResponse } from '../types';

export interface AiChatRequest {
  message: string;
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
    return apiClient.post<AiChatResponse>('/ai/chat', request);
  }
};
