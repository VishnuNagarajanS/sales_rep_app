export const kycValidators = {
  pan: (value: string) => {
    const val = value.toUpperCase();
    if (val.length !== 10) return false;
    const entity = val[3];
    if (!['P','C','H','F','A','T','B','L','J','G'].includes(entity)) return false;
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val);
  },
  aadhaar: (value: string) => {
    if (value.length !== 12 || value[0] === '0' || value[0] === '1') return false;
    return /^[2-9]{1}[0-9]{11}$/.test(value);
  },
  ifsc: (value: string) => {
    return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value.toUpperCase());
  },
  pincode: (value: string) => {
    return /^[1-9][0-9]{5}$/.test(value);
  },
  nomineeAllocation: (nominees: { allocationPercentage?: number }[]) => {
    let sum = 0;
    for (const n of nominees) {
      if (!n.allocationPercentage || n.allocationPercentage <= 0) return false;
      sum += n.allocationPercentage;
    }
    return sum === 100;
  },
  requiredText: (value: string, minLen = 2) => {
    return typeof value === 'string' && value.trim().length >= minLen;
  },
  phone: (value: string) => {
    const stripped = value.replace(/[\s\-().+]/g, '');
    const normalized = stripped.replace(/^(91|0)/, '');
    return /^[6-9][0-9]{9}$/.test(normalized);
  },
  email: (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  },
  dob: (value: string) => {
    if (!value) return false;
    const d = new Date(value);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    const age =
      now.getFullYear() - d.getFullYear() -
      (now.getMonth() < d.getMonth() ||
      (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
        ? 1
        : 0);
    return age >= 18;
  },
  bankAccount: (value: string) => {
    return /^[0-9]{9,18}$/.test(value.trim());
  },
  dematBoid: (value: string) => {
    return /^[0-9]{16}$/.test(value.trim());
  },
  nomineeDob: (value: string) => {
    if (!value) return false;
    const d = new Date(value);
    return !isNaN(d.getTime());
  },
};

// ── Shared KYC Field & Validation Contract ─────────────────────────────────────

export interface NomineeItem {
  id?: string;
  name: string;
  relationship: string;
  dob: string;
  allocationPercentage: number;
  address?: string;
  guardianName?: string;
}

export interface SharedKycFormData {
  // Step 1: Basic Details
  investorName: string;
  phone: string;
  email: string;
  gender: string;
  investorType: string;
  residentType: string;
  occupation?: string;

  // Step 2: Identity & Address
  panNumber: string;
  nameAsPerPan: string;
  aadhaarNumber: string;
  fatherName?: string;
  dob: string;
  address: string;
  courierAddress?: string;
  country?: string;
  state: string;
  city: string;
  pincode: string;

  // Step 3: Bank Details
  accountType: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  accountHolderName?: string;
  branchName?: string;
  swiftCode?: string;

  // Step 4: Demat Account
  hasNoDemat: boolean;
  dematAccountNumber?: string;
  dematDepository?: string;
  dematDpId?: string;
  dematClientId?: string;

  // Step 5: Nominee Details
  hasNominee?: boolean;
  nominees: NomineeItem[];
}

// ── Canonical Option Constants ─────────────────────────────────────────────────

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;

export const INVESTOR_TYPE_OPTIONS = [
  'Individual / Retail HNW',
  'Corporate / Non-Individual',
  'HUF',
  'NRI / Foreign',
] as const;

export const RESIDENT_TYPE_OPTIONS = [
  'Resident Indian',
  'Non-Resident Indian (NRI)',
  'Person of Indian Origin (PIO)',
] as const;

export const ACCOUNT_TYPE_OPTIONS = [
  'Savings Account',
  'Current Account',
] as const;

export const NOMINEE_RELATIONSHIP_OPTIONS = [
  'Spouse',
  'Son',
  'Daughter',
  'Mother',
  'Father',
  'Brother',
  'Sister',
  'Other',
] as const;

/**
 * Validates a single KYC wizard step using the shared contract across
 * both Customer Email-Link KYC and IRM-Assisted KYC flows.
 *
 * Rules:
 * - Nominee is OPTIONAL in both flows.
 * - When nominees are provided, all nominee fields must be valid and allocation must equal 100%.
 * - Fields that were required in only one flow (e.g. occupation, fatherName, courierAddress)
 *   are made non-blocking so neither flow forces unnecessary constraints.
 */
export function validateKycStep(
  step: 1 | 2 | 3 | 4 | 5,
  data: Partial<SharedKycFormData>
): Record<string, string> {
  const errs: Record<string, string> = {};

  if (step === 1) {
    if (!kycValidators.requiredText(data.investorName || '', 2)) {
      errs.investorName = 'Full Name is required (at least 2 characters).';
    }
    if (!kycValidators.phone(data.phone || '')) {
      errs.phone = 'Enter a valid 10-digit mobile number.';
    }
    if (!kycValidators.email(data.email || '')) {
      errs.email = 'Enter a valid email address.';
    }
    if (!data.gender) {
      errs.gender = 'Gender is required.';
    }
    if (!data.investorType) {
      errs.investorType = 'Investor Type is required.';
    }
    if (!data.residentType) {
      errs.residentType = 'Resident Status is required.';
    }
    // Note: occupation is optional per shared contract rules
  }

  if (step === 2) {
    const panClean = (data.panNumber || '').trim().toUpperCase();
    if (!kycValidators.pan(panClean)) {
      errs.panNumber = 'Enter a valid 10-character PAN (e.g. ABCDE1234F).';
    }
    if (!kycValidators.requiredText(data.nameAsPerPan || '', 2)) {
      errs.nameAsPerPan = 'Name as per PAN is required.';
    }
    const aadhaarClean = (data.aadhaarNumber || '').replace(/\D/g, '');
    if (!kycValidators.aadhaar(aadhaarClean)) {
      errs.aadhaarNumber = 'Enter a valid 12-digit Aadhaar number (cannot start with 0 or 1).';
    }
    if (!kycValidators.dob(data.dob || '')) {
      errs.dob = 'Date of birth is required and the investor must be at least 18 years old.';
    }
    if (!kycValidators.requiredText(data.address || '', 5)) {
      errs.address = 'Permanent address is required (at least 5 characters).';
    }
    if (!kycValidators.requiredText(data.city || '', 2)) {
      errs.city = 'City is required.';
    }
    if (!kycValidators.requiredText(data.state || '', 2)) {
      errs.state = 'State is required.';
    }
    const pincodeClean = (data.pincode || '').replace(/\D/g, '');
    if (!kycValidators.pincode(pincodeClean)) {
      errs.pincode = 'Enter a valid 6-digit PIN code.';
    }
    // Note: fatherName, courierAddress, country are optional
  }

  if (step === 3) {
    if (!kycValidators.requiredText(data.bankName || '', 2)) {
      errs.bankName = 'Bank name is required.';
    }
    const accClean = (data.accountNumber || '').trim();
    if (!kycValidators.bankAccount(accClean)) {
      errs.accountNumber = 'Enter a valid bank account number (9–18 digits).';
    }
    const ifscClean = (data.ifscCode || '').trim().toUpperCase();
    if (!kycValidators.ifsc(ifscClean)) {
      errs.ifscCode = 'Enter a valid IFSC code (e.g. HDFC0001234).';
    }
    if (!data.accountType) {
      errs.accountType = 'Account type is required.';
    }
    // Note: accountHolderName, branchName, swiftCode are optional
  }

  if (step === 4) {
    if (!data.hasNoDemat) {
      const dematClean = (data.dematAccountNumber || '').replace(/\D/g, '');
      if (!kycValidators.dematBoid(dematClean)) {
        errs.dematAccountNumber = 'Demat account number must be exactly 16 digits (BO ID).';
      }
    }
  }

  if (step === 5) {
    // Nominee is optional in both flows.
    // Only validate when nominee has been explicitly opted-in or provided.
    const hasNominee = Boolean(
      data.hasNominee || (data.nominees && data.nominees.length > 0 && data.nominees.some(n => n.name?.trim()))
    );

    if (hasNominee && data.nominees && data.nominees.length > 0) {
      let totalPct = 0;
      data.nominees.forEach((nom, idx) => {
        if (!kycValidators.requiredText(nom.name || '', 2)) {
          errs[`nominee_${idx}_name`] = 'Nominee full name is required (at least 2 characters).';
        }
        if (!nom.relationship) {
          errs[`nominee_${idx}_relationship`] = 'Relationship is required.';
        }
        if (!kycValidators.nomineeDob(nom.dob || '')) {
          errs[`nominee_${idx}_dob`] = 'Nominee date of birth is required.';
        }
        const pct = Number(nom.allocationPercentage);
        if (isNaN(pct) || pct <= 0) {
          errs[`nominee_${idx}_pct`] = 'Allocation percentage must be greater than 0%.';
        } else {
          totalPct += pct;
        }
      });

      if (totalPct !== 100) {
        errs.nominees = `Total allocation across all nominees must equal exactly 100% (currently ${totalPct}%).`;
      }
    }
  }

  return errs;
}