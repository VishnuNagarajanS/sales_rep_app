import { ChatAttachment } from '../../types';

export const MOCK_CHAT_ATTACHMENTS: ChatAttachment[] = [
  {
    id: 'att-demo-rajesh-docs',
    name: 'Dr_Rajesh_KYC_Verification.pdf',
    size: 2450000,
    type: 'application/pdf',
    category: 'PDF',
    permission: 'read_only',
    dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp...',
  },
  {
    id: 'att-demo-site-plan',
    name: 'Greenfield_Meadows_MasterPlan.png',
    size: 1120000,
    type: 'image/png',
    category: 'Image',
    permission: 'view_download',
    dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="400" height="250" fill="%231e293b"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif" font-size="16">Master Plan Preview</text></svg>',
  },
];
