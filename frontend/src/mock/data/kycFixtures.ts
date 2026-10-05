import { KycReviewData, CustomerKycStatus, MockKycProvider } from '../../services/kycService';

export function createMockKycReviewData(deal: any): KycReviewData {
  const dealId = deal.id || 'deal-01';
  const customerName = deal.customerName || 'Investor';

  return {
    refId: `GHL-KYC-${dealId.slice(-6).toUpperCase()}-2026`,
    submissionDate: '24 Sep 2026, 04:32 PM',
    ipAddress: '49.207.214.18 (Bengaluru, KA)',
    userAgent: 'Mobile Safari • iOS 18.2 (iPhone 16 Pro)',

    basicDetails: {
      investorName: customerName,
      phone: deal.phone || '+91 98450 12345',
      email: deal.email || 'investor@example.com',
      gender: 'Male',
      investorType: deal.investorType || 'Individual / HNI',
      residentType: 'Resident Indian',
      occupation: 'Business Owner / Private Investor',
    },

    identityDetails: {
      panNumber: 'ABCDE****F',
      nameAsPerPan: customerName.toUpperCase(),
      aadhaarNumber: 'XXXX XXXX 8921',
      fatherName: 'Late Dr. R. K. ' + customerName.split(' ')[0],
      dob: '14 May 1984',
      address: 'Plot 42, Green Glen Layout, Bellandur, Bengaluru, Karnataka - 560103',
      courierAddress: 'Same as permanent address',
    },

    bankDetails: {
      accountHolderName: customerName,
      bankName: 'HDFC Bank Ltd',
      accountNumber: '••••••••5678',
      accountType: 'Savings Account',
      ifscCode: 'HDFC0000240',
      branchName: 'Koramangala 4th Block, Bengaluru',
    },

    dematDetails: {
      hasNoDemat: false,
      dematAccountNumber: '12081600••••••••',
      dematDepository: 'CDSL',
      dematDpId: '12081600',
      dematClientId: '00349812',
    },

    nominees: [
      {
        name: 'Sunita ' + (customerName.split(' ')[1] || 'Varma'),
        relationship: 'Spouse',
        dob: '22 Aug 1986',
        allocationPercentage: 100,
        address: 'Same as investor address',
      },
    ],

    documents: [
      { id: 'doc-1', name: 'PAN_Card_Front_Official.pdf', size: '1.2 MB', verified: true },
      { id: 'doc-2', name: 'Aadhaar_Offline_XML_EKYC.pdf', size: '2.4 MB', verified: true },
      { id: 'doc-3', name: 'HDFC_Cancelled_Cheque_Proof.pdf', size: '1.8 MB', verified: true },
      { id: 'doc-4', name: 'CDSL_Client_Master_Report.pdf', size: '850 KB', verified: true },
    ],

    consent: {
      acceptedAt: '24 Sep 2026, 04:32:15 PM IST',
      termsVersion: 'v2.4-ghl-sebi-undertaking-2026',
      ipHash: '49.207.214.18 (Verified GPS Geo-fence: Karnataka, IN)',
    },

    liveness: {
      capturedAt: '24 Sep 2026, 04:31:02 PM',
      matchScore: '98.4%',
      livenessStatus: 'Live Person Confirmed (Passive + Active Blink Check Passed)',
    },

    providerVerifications: [
      { name: 'NSDL PAN Status', status: 'pass', detail: 'Valid & Active (Name 100% Match)' },
      { name: 'NPCI Bank Penny Drop', status: 'pass', detail: 'Account Active • Name Match 96%' },
      { name: 'UIDAI Aadhaar eKYC', status: 'pass', detail: 'Digitally Signed XML Verified' },
      { name: 'AI Face Liveness & Match', status: 'pass', detail: 'Score 98.4% • No spoofing detected' },
    ],
  };
}

export function getMockCustomerKycStatus(dealId: string, currentStatus?: string): CustomerKycStatus {
  // Use mock storage per deal
  try {
    const raw = localStorage.getItem('nexus_mock_kyc_records');
    if (raw) {
      const records = JSON.parse(raw);
      if (records[dealId]?.status) return records[dealId].status;
    }
  } catch { }

  if (currentStatus === 'completed') return 'Verified';
  if (currentStatus) return currentStatus as CustomerKycStatus;
  return 'Submitted';
}

export const mockKycProvider: MockKycProvider = {
  getReviewData: () => null,
  getCustomerStatus: getMockCustomerKycStatus,
};
