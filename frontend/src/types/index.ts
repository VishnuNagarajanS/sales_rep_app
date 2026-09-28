export type TenantSlug = string;

export interface Tenant {
  id: string;
  name: string;
  slug: TenantSlug;
  brandColor: string;
  logo?: string;
  tagline: string;
  enabledFeatures: string[];
  timezone: string;
  currency: string;
  businessHours: string;
  legalName?: string;
  companyCode?: string;
  industry?: string;
  businessType?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  defaultLanguage?: string;
  status?: 'Active' | 'Inactive' | 'Suspended';
  subscriptionPlan?: string;
  defaultRoutingStrategy?: string;
  leadSla?: number;
  callEnabled?: boolean;
  recordingEnabled?: boolean;
  transcriptionEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type RoleCode = 'super_admin' | 'company_admin' | 'sales_executive' | 'irm';

export interface Role {
  id: string;
  name: string;
  code: RoleCode;
  permissions: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  companyId?: string;
  companySlug?: TenantSlug;
  companyName?: string;
  status: 'Active' | 'Invited' | 'Disabled';
  lastLogin?: string;
  avatar?: string;
  employeeCode?: string;
  designation?: string;
  managerId?: string;
  departmentId?: string;
  teamId?: string;
  skills?: string[];
  languages?: string[];
  specializations?: string[];
  maxActiveLeads?: number;
  currentActiveLeads?: number;
  routingPriority?: number;
  availabilityStatus?: 'available' | 'busy' | 'offline' | 'break';
  workingHours?: { start: string; end: string; days: string[] };
  joinedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Lead {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  source: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Converted' | 'Lost' | 'Not Interested' | 'Junk' | 'Callback' | 'No Response' | 'Follow-up Required' | 'Interested';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  assignedAgentId: string;
  assignedAgentName: string;
  nextFollowupDate?: string;
  createdAt: string;
  notes: string;
  customFields: Record<string, any>;
  departmentId?: string;
  teamId?: string;
  queueId?: string;
  intent?: string;
  subIntent?: string;
  productId?: string;
  sourceType?: string;
  campaignId?: string;
  customerType?: string;
  assignmentStatus?: 'assigned' | 'unassigned' | 'queued' | 'escalated';
  assignmentReason?: string;
  assignedAt?: string;
  routingPriority?: number;
  preferredLanguage?: string;
  preferredContactTime?: string;
  lastContactedAt?: string;
  lastCallAt?: string;
  leadScore?: number;
  isDuplicate?: boolean;
  duplicateOf?: string;
  slaDueAt?: string;
  slaStatus?: 'on_track' | 'at_risk' | 'breached';
  createdBy?: string;
  updatedBy?: string;
}

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  email: string;
  status: 'Active' | 'VIP' | 'Inactive';
  assignedAgentId: string;
  assignedAgentName: string;
  location: string;
  lastContacted: string;
  openDealsCount: number;
  totalValue: number;
  createdAt: string;
  notes: string;
  customFields: Record<string, any>;
  departmentId?: string;
  teamId?: string;
  customerType?: string;
  intent?: string;
  preferredLanguage?: string;
  lastCallAt?: string;
  lastContactedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  assignedIrmId?: string;
  assignedIrmName?: string;
  assignedIrmAt?: string;
}

export interface IrmProfile {
  id: string;
  name: string;
  experience: string;
  experienceYears: number;
  experienceLevel: 'Experienced' | 'Mid-Level' | 'Fresher';
  performance: number;
  status: 'Available' | 'Busy';
  email: string;
  phone: string;
}

export interface Deal {
  id: string;
  companyId: string;
  title: string;
  customerId: string;
  customerName: string;
  stage: string;
  value: number;
  expectedCloseDate: string;
  assignedAgentId: string;
  assignedAgentName: string;
  notes: string;
  lostReason?: string;
  createdAt: string;
  stageEnteredAt?: string;
  phone?: string;
  email?: string;
  priority?: 'High' | 'Medium' | 'Low';
  location?: string;
  preferredAssetClass?: string;
  investmentRange?: string; // e.g. "₹15 Cr – ₹25 Cr", display string shown in green
  investorType?: 'AIF' | 'Co-AIF';
}

export interface DealActivity {
  id: string;
  dealId: string;
  companyId: string;
  type: 'note' | 'call' | 'whatsapp' | 'meeting' | 'stage_change';
  text: string;
  fromStage?: string; // for stage_change entries
  toStage?: string;   // for stage_change entries
  loggedByName: string;
  loggedByRole: string; // e.g. "IRM"
  timestamp: string;
}

export type CallDisposition =
  | 'Interested'
  | 'Not Interested'
  | 'Follow-up Required'
  | 'Call Back'
  | 'Wrong Number'
  | 'Converted'
  | 'No Response';

export interface CallRecord {
  id: string;
  companyId: string;
  contactName: string;
  contactPhone: string;
  direction: 'inbound' | 'outbound';
  duration: number; // in seconds
  agentId: string;
  agentName: string;
  disposition: CallDisposition;
  timestamp: string;
  recordingUrl?: string;
  transcription?: string;
  notes?: string;
  reason?: string;
  providerCallId?: string;
  contactId?: string;
  leadId?: string;
  customerId?: string;
  investorId?: string;
  departmentId?: string;
  teamId?: string;
  queueId?: string;
  routingAttemptId?: string;
  answeredAt?: string;
  endedAt?: string;
  ringDuration?: number;
  hangupReason?: string;
  transferCount?: number;
  transferredFrom?: string;
  transferredTo?: string;
  recordingConsent?: boolean;
  recordingStatus?: 'pending' | 'completed' | 'failed';
  callStatus?: 'completed' | 'missed' | 'abandoned' | 'transferred';
  source?: string;
}

export interface Followup {
  id: string;
  companyId: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  contactType: 'lead' | 'customer' | 'investor';
  scheduledAt: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Pending' | 'Completed' | 'Cancelled';
  notes: string;
  assignedAgentId: string;
  assignedAgentName: string;
  assignedRole?: string;
  followupType?: 'call' | 'meeting' | 'email' | 'whatsapp';
  scheduledDate?: string;
  scheduledTime?: string;
  createdBy?: string;
  completedAt?: string;
  relatedCallId?: string;
  statusReason?: string;
}

export interface PropertyProject {
  id: string;
  name: string;
  location: string;
  status: 'Upcoming' | 'Active' | 'Sold Out';
  totalPlots: number;
  availablePlots: number;
  holdPlots: number;
  soldPlots: number;
  description: string;
  priceRange: string;
}

export interface Plot {
  id: string;
  projectId: string;
  projectName: string;
  plotNumber: string;
  sizeSqft: number;
  pricePerSqft: number;
  totalPrice: number;
  status: 'Available' | 'Hold' | 'Sold';
  dimension?: string;
  facing?: string;
  holdByCustomer?: string;
  holdByAgent?: string;
  holdExpiry?: string;
}

export interface SiteVisit {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  projectId: string;
  projectName: string;
  plotNumber?: string;
  scheduledAt: string;
  assignedAgentId: string;
  assignedAgentName: string;
  status: 'Scheduled' | 'Completed' | 'Rescheduled' | 'Cancelled' | 'No-show';
  outcomeNotes?: string;
}

export interface Booking {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  projectId: string;
  projectName: string;
  plotId: string;
  plotNumber: string;
  bookingDate: string;
  bookingAmount: number;
  totalAmount: number;
  status: 'Pending' | 'Confirmed' | 'Cancelled';
  agentId: string;
  agentName: string;
  paymentTerms: string;
}

export interface Investor {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  email: string;
  status: 'Lead' | 'Active Investor' | 'HNW Investor' | 'Inactive';
  investmentCapacity: string;
  preferredAssetClass: string;
  assignedAgentId: string;
  assignedAgentName: string;
  referralSource?: string;
  createdAt: string;
  notes: string;
  committedAUM?: string;
  investmentMandate?: string;
  riskTolerance?: 'Conservative' | 'Moderate' | 'Aggressive';
}

export interface Consultation {
  id: string;
  companyId: string;
  investorId: string;
  investorName: string;
  investorPhone: string;
  scheduledAt: string;
  consultantId: string;
  consultantName: string;
  status: 'Scheduled' | 'Completed' | 'Rescheduled' | 'Cancelled' | 'No-show';
  agenda: string;
  outcomeNotes?: string;
  referredByAgentName?: string;
}

export interface InvestmentOpportunity {
  id: string;
  companyId: string;
  title: string;
  investorId: string;
  investorName: string;
  stage: 'Enquiry' | 'Contacted' | 'Consultation' | 'Qualified' | 'Opportunity' | 'Committed' | 'Closed Won' | 'Closed Lost';
  targetAmount: number;
  committedAmount: number;
  assignedAgentId: string;
  assignedAgentName: string;
  expectedCloseDate: string;
  notes: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  companyId?: string;
  companyName?: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  beforeValue?: Record<string, any>;
  afterValue?: Record<string, any>;
  module?: string;
  status?: 'success' | 'failure';
}

export interface NotificationItem {
  id: string;
  type: 'lead' | 'call' | 'followup' | 'visit' | 'booking' | 'system' | 'alert' | 'broadcast';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  companyId?: string;
  companySlug?: string;
  targetUserId?: string; // 'all' or specific user ID
  targetUserName?: string;
  targetRole?: string; // 'all' | 'sales_executive' | 'irm' | etc.
  createdById?: string;
  createdByName?: string;
  priority?: 'normal' | 'important' | 'urgent';
  createdAt?: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
  category: string;
  entityType?: 'lead' | 'customer' | 'investor' | 'booking' | 'consultation' | 'company';
  entityId?: string;
}

export interface Department {
  id: string;
  companyId: string;
  name?: string;
  code?: string;
  description?: string;
  headUserId?: string;
  status?: 'active' | 'inactive' | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Team {
  id: string;
  companyId: string;
  departmentId?: string;
  name?: string;
  teamLeadId?: string;
  memberIds?: string[];
  skills?: string[];
  languages?: string[];
  queueId?: string;
  maxCapacity?: number;
  status?: 'active' | 'inactive' | string;
}

export interface Queue {
  id: string;
  companyId: string;
  departmentId?: string;
  teamId?: string;
  name?: string;
  routingStrategy?: string;
  priority?: number;
  maxWaitSeconds?: number;
  fallbackTeamId?: string;
  fallbackUserId?: string;
  status?: 'active' | 'inactive' | string;
}

export interface RoutingRule {
  id: string;
  companyId: string;
  name?: string;
  priority?: number;
  enabled?: boolean;
  source?: string;
  intent?: string;
  subIntent?: string;
  productId?: string;
  customerType?: string;
  leadPriority?: string;
  language?: string;
  departmentId?: string;
  teamId?: string;
  queueId?: string;
  requiredSkills?: string[];
  routingStrategy?: string;
  maxRingSeconds?: number;
  maxAttempts?: number;
  fallbackQueueId?: string;
  fallbackUserId?: string;
  businessHoursOnly?: boolean;
  afterHoursAction?: string;
  slaMinutes?: number;
}

export interface LeadAssignment {
  id: string;
  companyId: string;
  leadId?: string;
  fromAgentId?: string;
  toAgentId?: string;
  routingRuleId?: string;
  reason?: string;
  assignedBy?: string;
  assignedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  status?: string;
}

export interface AgentPresence {
  id?: string;
  userId?: string;
  companyId: string;
  status?: 'available' | 'busy' | 'offline' | 'break' | string;
  currentCallId?: string;
  lastHeartbeat?: string;
  availableSince?: string;
}

export interface RoutingAttempt {
  id: string;
  companyId: string;
  callId?: string;
  leadId?: string;
  queueId?: string;
  candidateAgentId?: string;
  attemptNumber?: number;
  startedAt?: string;
  endedAt?: string;
  result?: string;
  failureReason?: string;
}

export interface CustomFieldDefinition {
  id: string;
  companyId: string;
  module?: string;
  fieldKey?: string;
  label?: string;
  fieldType?: string;
  required?: boolean;
  options?: string[];
  defaultValue?: any;
  validation?: string | Record<string, any>;
  displayOrder?: number;
  active?: boolean;
}

export interface ProductService {
  id: string;
  companyId: string;
  name?: string;
  code?: string;
  category?: string;
  subcategory?: string;
  description?: string;
  departmentId?: string;
  teamId?: string;
  priceRange?: string;
  requiredSkills?: string[];
  status?: 'active' | 'inactive' | string;
}

// ── Chat Types ─────────────────────────────────────────────────────────────
export interface ChatReaction {
  emoji: string;
  userId: string;
  userName: string;
}

export type FileCategory = 'PDF' | 'Image' | 'Document' | 'Spreadsheet' | 'Other';
export type FilePermission = 'read_only' | 'view_download' | 'view_edit';

export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  category?: FileCategory;
  permission?: FilePermission;
  dataUrl: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  isDeleted: boolean;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  reactions: ChatReaction[];
  attachments?: ChatAttachment[];
}

export interface ChatMember {
  id: string;
  name: string;
  email?: string;
  roleCode: string;
  roleName: string;
  companyId: string;
  avatarUrl?: string;
  status: 'online' | 'offline' | 'busy';
}

export interface ChatConversation {
  id: string;
  companyId: string;
  type: 'dm' | 'group';
  name?: string;
  memberIds: string[];
  members: ChatMember[];
  lastMessage?: Pick<ChatMessage, 'content' | 'senderName' | 'isDeleted'>;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  isPinned?: boolean;
  isMuted?: boolean;
}

export interface ChatSettings {
  general?: {
    theme: 'default' | 'dark' | 'high_contrast';
    autoStartApp: boolean;
    openInBackground: boolean;
    onCloseKeepRunning: boolean;
    gpuHardwareAcceleration: boolean;
    registerAsDefaultChatApp: boolean;
    language: string;
    keyboardLanguage: string;
    turnOffAnimations: boolean;
    outOfOfficeReply: boolean;
    outOfOfficeMessage: string;
  };
  accounts?: {
    activeTenant: string;
  };
  privacy: {
    readReceipts: boolean;
    typingIndicator: boolean;
    whoCanDm: 'everyone' | 'team' | 'managers_admins';
    priorityAccess?: string[];
    blockedContacts?: string[];
    participateInSurveys?: boolean;
  };
  notifications: {
    desktopPush: boolean;
    sound: boolean;
    mentionOnly: boolean;
    notificationStyle?: 'teams' | 'windows';
    showPreview?: boolean;
    missedActivityEmails?: 'hourly' | 'daily' | 'asap' | 'off';
    chatsAndChannels?: 'banner_feed' | 'feed_only' | 'off';
    meetingsAndCalls?: 'banner' | 'off';
  };
  captions?: {
    autoIdentifyMe: boolean;
    spokenLanguage: string;
    autoStartTranscription: boolean;
  };
  files?: {
    fileOpenPreference: 'teams' | 'desktop' | 'browser';
    downloadLocation: string;
    alwaysAskWhereToSave: boolean;
  };
  calls: {
    defaultMic: string;
    defaultCamera: string;
    defaultSpeaker?: string;
    noiseSuppression?: 'auto' | 'high' | 'low' | 'off';
    secondaryRinger?: string;
    cameraOffOnJoin: boolean;
    autoAnswer: boolean;
    callAnsweringRules?: 'ring_me' | 'forward';
    forwardTo?: 'voicemail' | 'delegates';
    ringDurationBeforeRedirect?: number;
    ringtone?: string;
  };
  appPermissions?: {
    media: boolean;
    location: boolean;
    notifications: boolean;
    externalLinks: boolean;
    midiDevices: boolean;
  };
  accessibility?: {
    signLanguageView: boolean;
    alwaysShowMeetingControls: boolean;
    highContrast: boolean;
  };
  adminGovernance?: {
    retentionDays: number; // 0 for forever
    fileRetentionDays: number;
    whoCanCreateGroups: 'everyone' | 'managers_admins';
  };
}

// ============================================================================
// Super Admin Platform Types
// ============================================================================

export interface SubscriptionPackage {
  id: string;
  name: string;
  code: string;
  description: string;
  tier: 'Starter' | 'Growth' | 'Enterprise';
  priceMonthly: number;
  currency: string;
  maxUsers: number;
  maxStorageGb: number;
  features: string[];
  isPopular?: boolean;
  isActive: boolean;
  enrolledTenantsCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface TenantDidMapping {
  id: string;
  phoneNumber: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  routingStrategy: 'Round-Robin' | 'Skill/Priority' | 'Least-Busy Rep' | 'Direct Extension';
  queueName: string;
  enableRecording: boolean;
  enableAiWhisper: boolean;
  status: 'Online' | 'Offline' | 'Reserved';
  channelsCount: number;
  allocatedAt: string;
  notes?: string;
}

export interface PlatformCarrierSettings {
  primaryCarrier: string;
  secondaryCarrier: string;
  sipRealm: string;
  webrtcGatewayUrl: string;
  recordingRetentionDays: number;
  maxConcurrentChannels: number;
  emergencyRoutingEnabled: boolean;
  whisperAiModel: string;
  lastTestedAt?: string;
  testStatus?: 'Success' | 'Degraded' | 'Offline';
}

export interface SystemDiagnostics {
  apiStatus: 'Healthy' | 'Degraded' | 'Down';
  apiLatencyMs: number;
  dbPoolActive: number;
  dbPoolMax: number;
  dbLatencyMs: number;
  memoryUsedMb: number;
  memoryLimitMb: number;
  storageUsedGb: number;
  storageLimitGb: number;
  activeSessions: number;
  activeWebSockets: number;
  telephonyDropRate: number;
  systemUptimePercentage: number;
  lastBackupAt: string;
}

export interface BroadcastAnnouncement {
  id: string;
  title: string;
  message: string;
  priority: 'info' | 'warning' | 'critical';
  targetAudience: 'all' | 'tenant_admins' | 'sales_reps';
  targetTenantId?: string; // null or 'all' for all tenants
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  expiresAt?: string;
}

export interface PlatformMetrics {
  totalTenants: number;
  activeTenants: number;
  onboardingTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  activeUsers: number;
  callsToday: number;
  callsConnected: number;
  totalLeads: number;
  totalPipelineValue: number;
  totalCustomers: number;
  systemHealthScore: number;
}

