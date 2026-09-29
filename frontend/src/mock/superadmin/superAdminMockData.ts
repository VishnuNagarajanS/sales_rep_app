import {
  SubscriptionPackage,
  TenantDidMapping,
  PlatformCarrierSettings,
  BroadcastAnnouncement,
  SystemDiagnostics,
  PlatformMetrics,
  Tenant,
} from '../../types';
import { FEATURES } from '../../constants/features';
import { DEFAULT_TENANTS } from '../../constants/defaultTenants';

// ============================================================================
// SUPER ADMIN MOCK FIXTURES & SEED DATA
// ============================================================================

export const SUPER_ADMIN_MOCK_PACKAGES: SubscriptionPackage[] = [
  {
    id: 'pkg-standard-crm',
    name: 'Starter CRM Tier',
    code: 'starter_crm',
    description: 'Essential inbound leads, customer directory, softphone calling, and follow-ups.',
    tier: 'Starter',
    priceMonthly: 14999,
    currency: '₹',
    maxUsers: 15,
    maxStorageGb: 50,
    features: [
      FEATURES.LEADS,
      FEATURES.CUSTOMERS,
      FEATURES.FOLLOWUPS,
      FEATURES.CALLS,
      FEATURES.REPORTS,
    ],
    isActive: true,
    enrolledTenantsCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pkg-real-estate-pro',
    name: 'Plotted Land Operations Pro',
    code: 'jamin_real_estate_pro',
    description: 'Tailored for plotted development builders with interactive plot layouts, site visit logistics, and token bookings.',
    tier: 'Growth',
    priceMonthly: 39999,
    currency: '₹',
    maxUsers: 50,
    maxStorageGb: 250,
    features: [
      FEATURES.LEADS,
      FEATURES.CUSTOMERS,
      FEATURES.DEALS,
      FEATURES.FOLLOWUPS,
      FEATURES.CALLS,
      FEATURES.CALL_RECORDING,
      FEATURES.CALL_TRANSCRIPTION,
      FEATURES.PROPERTIES,
      FEATURES.SITE_VISITS,
      FEATURES.BOOKINGS,
      FEATURES.REPORTS,
    ],
    isPopular: true,
    isActive: true,
    enrolledTenantsCount: 1,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pkg-wealth-enterprise',
    name: 'Wealth Advisory Enterprise Suite',
    code: 'ghl_wealth_enterprise',
    description: 'Engineered for institutional capital syndicates, private family offices, and CRE investment opportunities.',
    tier: 'Enterprise',
    priceMonthly: 79999,
    currency: '₹',
    maxUsers: 150,
    maxStorageGb: 1000,
    features: [
      FEATURES.LEADS,
      FEATURES.CUSTOMERS,
      FEATURES.DEALS,
      FEATURES.FOLLOWUPS,
      FEATURES.CALLS,
      FEATURES.CALL_RECORDING,
      FEATURES.CALL_TRANSCRIPTION,
      FEATURES.INVESTORS,
      FEATURES.CONSULTATIONS,
      FEATURES.INVESTMENT_OPPORTUNITIES,
      FEATURES.REPORTS,
    ],
    isActive: true,
    enrolledTenantsCount: 1,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

export const SUPER_ADMIN_MOCK_DIDS: TenantDidMapping[] = [
  {
    id: 'did-001',
    phoneNumber: '+91 80 4700 8001',
    tenantId: '1',
    tenantName: 'GHL India Ventures',
    tenantSlug: 'ghl',
    routingStrategy: 'Skill/Priority',
    queueName: 'HNW Wealth Advisory Queue',
    enableRecording: true,
    enableAiWhisper: true,
    status: 'Online',
    channelsCount: 8,
    allocatedAt: '2026-01-10T10:00:00Z',
    notes: 'Primary inbound trunk for HNW wealth consultations',
  },
  {
    id: 'did-002',
    phoneNumber: '+91 80 4700 8002',
    tenantId: '2',
    tenantName: 'Jamin Bazaar',
    tenantSlug: 'jamin',
    routingStrategy: 'Round-Robin',
    queueName: 'Plotted Enclaves Telecallers',
    enableRecording: true,
    enableAiWhisper: true,
    status: 'Online',
    channelsCount: 12,
    allocatedAt: '2026-01-15T14:30:00Z',
    notes: 'Buyer inquiry hotline for gated community layouts',
  },
  {
    id: 'did-003',
    phoneNumber: '+91 80 4700 8003',
    tenantId: '',
    tenantName: 'Unassigned Pool',
    tenantSlug: '',
    routingStrategy: 'Round-Robin',
    queueName: 'Available DID Reserve',
    enableRecording: false,
    enableAiWhisper: false,
    status: 'Reserved',
    channelsCount: 4,
    allocatedAt: '2026-02-01T09:00:00Z',
    notes: 'Spare DID number for next enterprise onboarding',
  },
];

export const SUPER_ADMIN_MOCK_CARRIER_SETTINGS: PlatformCarrierSettings = {
  primaryCarrier: 'Twilio Elastic SIP Trunking (Mumbai AP-South)',
  secondaryCarrier: 'Exotel Cloud Gateway (Failover Redundant)',
  sipRealm: 'sip.trunk.nexusplatform.io:5060',
  webrtcGatewayUrl: 'wss://webrtc.nexusplatform.io/gateway',
  recordingRetentionDays: 180,
  maxConcurrentChannels: 100,
  emergencyRoutingEnabled: true,
  whisperAiModel: 'OpenAI Whisper-Large-v3 (Self-Hosted on GPU cluster)',
  lastTestedAt: '2026-09-26T10:00:00Z',
  testStatus: 'Success',
};

export const SUPER_ADMIN_MOCK_ANNOUNCEMENTS: BroadcastAnnouncement[] = [
  {
    id: 'ann-001',
    title: 'Platform Infrastructure Upgrade',
    message: 'Scheduled zero-downtime database optimization today at 11:30 PM IST. Telephony routing will not be interrupted.',
    priority: 'info',
    targetAudience: 'all',
    isActive: true,
    createdAt: '2026-09-26T08:00:00Z',
    createdBy: 'Yanosh',
    expiresAt: '2026-09-27T06:00:00Z',
  },
];

export const SUPER_ADMIN_MOCK_TENANTS: Tenant[] = [
  {
    ...DEFAULT_TENANTS.ghl,
    status: 'Active',
    subscriptionPlan: 'Wealth Advisory Enterprise Suite',
    leadSla: 15,
    callEnabled: true,
    recordingEnabled: true,
    transcriptionEnabled: true,
  },
  {
    ...DEFAULT_TENANTS.jamin,
    status: 'Active',
    subscriptionPlan: 'Plotted Land Operations Pro',
    leadSla: 30,
    callEnabled: true,
    recordingEnabled: true,
    transcriptionEnabled: true,
  },
];

export const SUPER_ADMIN_MOCK_DIAGNOSTICS: SystemDiagnostics = {
  apiStatus: 'Healthy',
  apiLatencyMs: 18,
  dbPoolActive: 14,
  dbPoolMax: 60,
  dbLatencyMs: 6,
  memoryUsedMb: 428,
  memoryLimitMb: 2048,
  storageUsedGb: 8.4,
  storageLimitGb: 250,
  activeSessions: 38,
  activeWebSockets: 19,
  telephonyDropRate: 0.0,
  systemUptimePercentage: 99.98,
  lastBackupAt: new Date(Date.now() - 3600000 * 4).toISOString(),
};

export const SUPER_ADMIN_MOCK_MAINTENANCE_MODE = {
  enabled: false,
  message: 'Platform under scheduled maintenance.',
  bypassSecret: 'nexus-admin-2026',
};

export const SUPER_ADMIN_MOCK_METRICS: PlatformMetrics = {
  totalTenants: 2,
  activeTenants: 2,
  onboardingTenants: 0,
  suspendedTenants: 0,
  totalUsers: 8,
  activeUsers: 8,
  callsToday: 384,
  callsConnected: 341,
  totalLeads: 2480,
  totalPipelineValue: 485000000, // ₹48.5 Cr
  totalCustomers: 864,
  systemHealthScore: 99.98,
};
