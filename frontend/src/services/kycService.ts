import { getAuthHeaders } from '../utils/authHeaders';
import { apiUrl } from '../utils/apiUrl';

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
  | 'Completed'
  | 'Link Sent'
  | 'In Progress'
  | 'Submitted'
  | 'Under Verification'
  | 'Needs Correction'
  | 'Wrong'
  | 'Rejected'
  | 'Assisted Draft'
  | 'Assisted KYC – Submitted for Verification'
  | 'Pending';

export function getKycReviewData(_deal: any): KycReviewData | null {
  return null;
}

export function getCustomerKycStatus(_dealId: string, currentStatus?: string): CustomerKycStatus {
  if (currentStatus === 'completed') return 'Verified';
  return (currentStatus as CustomerKycStatus) || 'Pending';
}

/**
 * Customer-side status lifecycle guard.
 * Valid forward transitions (customer journey only, one step at a time):
 *   Pending -> Link Sent -> In Progress -> Submitted
 * IRM-only statuses (Verified, Wrong, Needs Correction, Under Verification)
 * are never valid as a customer-initiated target.
 * Step-skipping (e.g. Pending → In Progress) is also blocked.
 */
export function canTransition(currentStatus: CustomerKycStatus, newStatus: CustomerKycStatus): boolean {
  if (currentStatus === newStatus) return false;

  // IRM-only target statuses — customer cannot self-assign these
  const irmOnly: CustomerKycStatus[] = ['Verified', 'Wrong', 'Needs Correction', 'Under Verification'];
  if (irmOnly.includes(newStatus)) return false;

  const order: CustomerKycStatus[] = ['Pending', 'Link Sent', 'In Progress', 'Submitted'];
  const from = order.indexOf(currentStatus);
  const to = order.indexOf(newStatus);

  // Both must be in the customer lifecycle, and only one step forward is allowed
  if (from === -1 || to === -1) return false;
  return to === from + 1;
}

/**
 * Legacy normalizer:
 * 'Pending' and 'Partially Completed' -> Pending;
 * 'Completed' -> Verified only if verifiedBy is recorded, else Pending;
 * anything else -> Pending. Only deal.kycStatus === 'Verified' set via the IRM action counts as completed.
 */
export function normalizeLegacyKycStatus(kycStatus?: string | null, verifiedBy?: string | null): 'Pending' | 'Wrong' | 'Verified' {
  if (!kycStatus) return 'Pending';
  if (kycStatus === 'Verified') return 'Verified';
  if (kycStatus === 'Wrong') return 'Wrong';
  if (kycStatus === 'Completed') {
    return verifiedBy && verifiedBy.trim().length > 0 ? 'Verified' : 'Pending';
  }
  // 'Pending', 'Partially Completed', or anything else -> 'Pending'
  return 'Pending';
}

export interface KycChecklist {
  identity: boolean;
  bank: boolean;
  documents: boolean;
  nominee: boolean;
  demat: boolean;
}

export async function patchKycStatus(
  kycId: number | string,
  payload: {
    status: 'Pending' | 'Wrong' | 'Verified';
    comment?: string;
    flaggedSections?: string[];
    checklist?: KycChecklist;
  }
): Promise<any> {
  const response = await fetch(apiUrl(`/irm/kyc/${kycId}/status`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });
  // Error responses (502/429/HTML) are not always JSON: never let a parse error hide the real status.
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || `Failed to update KYC status (${response.status})`);
  }
  return data;
}
