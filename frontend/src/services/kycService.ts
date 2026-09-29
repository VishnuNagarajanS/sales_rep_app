import { isMockMode } from '../config/environment';

export interface KycReviewData {
  refId: string;
  submissionDate: string;
  ipAddress: string;
  userAgent: string;
  basicDetails: {
    investorName: string;
    phone: string;
    email: string;
    gender: string;
    investorType: string;
    residentType: string;
    occupation: string;
  };
  identityDetails: {
    panNumber: string;
    nameAsPerPan: string;
    aadhaarNumber: string;
    fatherName: string;
    dob: string;
    address: string;
    courierAddress: string;
  };
  bankDetails: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    accountType: string;
    ifscCode: string;
    branchName: string;
  };
  dematDetails: {
    hasNoDemat: boolean;
    dematAccountNumber: string;
    dematDepository: string;
    dematDpId: string;
    dematClientId: string;
  };
  nominees: Array<{
    name: string;
    relationship: string;
    dob: string;
    allocationPercentage: number;
    address: string;
  }>;
  documents: Array<{
    id: string;
    name: string;
    size: string;
    verified: boolean;
  }>;
  consent: {
    acceptedAt: string;
    termsVersion: string;
    ipHash: string;
  };
  liveness: {
    capturedAt: string;
    matchScore: string;
    livenessStatus: string;
  };
  providerVerifications: Array<{
    name: string;
    status: string;
    detail: string;
  }>;
}

export type CustomerKycStatus =
  | 'Verified'
  | 'Link Sent'
  | 'In Progress'
  | 'Submitted'
  | 'Under Verification'
  | 'Needs Correction'
  | 'Pending';

export interface MockKycProvider {
  getReviewData: (deal: any) => KycReviewData | null;
  getCustomerStatus: (dealId: string, currentStatus?: string) => CustomerKycStatus;
}

let mockKycProviderInstance: MockKycProvider | null = null;

export function registerMockKycProvider(provider: MockKycProvider): void {
  mockKycProviderInstance = provider;
}

export function getKycReviewData(deal: any): KycReviewData | null {
  if (isMockMode() && mockKycProviderInstance) {
    return mockKycProviderInstance.getReviewData(deal);
  }
  return null;
}

export function getCustomerKycStatus(dealId: string, currentStatus?: string): CustomerKycStatus {
  if (isMockMode() && mockKycProviderInstance) {
    return mockKycProviderInstance.getCustomerStatus(dealId, currentStatus);
  }
  if (currentStatus === 'completed') return 'Verified';
  return (currentStatus as CustomerKycStatus) || 'Pending';
}
