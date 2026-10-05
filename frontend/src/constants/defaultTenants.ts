import { Tenant } from '../types';

export const DEFAULT_TENANTS: Record<string, Tenant> = {
  ghl: {
    id: '1',
    name: 'GHL India Ventures',
    slug: 'ghl',
    brandColor: '#0284c7',
    tagline: 'Institutional Wealth & Real Estate Investment Advisory',
    enabledFeatures: [
      'leads', 'customers', 'deals', 'followups', 'calls', 'call-recording',
      'call-transcription', 'investors', 'consultations', 'investment-opportunities',
      'reports', 'users', 'roles', 'company-settings', 'audit-logs'
    ],
    timezone: 'Asia/Kolkata (IST)',
    currency: '₹ INR',
    businessHours: '10:00 AM - 06:30 PM IST',
    status: 'Active',
  },
  jamin: {
    id: '2',
    name: 'Jamin Bazaar',
    slug: 'jamin',
    brandColor: '#059669',
    tagline: 'Premium Plotted Enclaves & Farmland Communities',
    enabledFeatures: [
      'leads', 'customers', 'deals', 'followups', 'calls', 'call-recording',
      'call-transcription', 'properties', 'site-visits', 'bookings',
      'reports', 'users', 'roles', 'company-settings', 'audit-logs'
    ],
    timezone: 'Asia/Kolkata (IST)',
    currency: '₹ INR',
    businessHours: '10:00 AM - 06:30 PM IST',
    status: 'Active',
  },
};