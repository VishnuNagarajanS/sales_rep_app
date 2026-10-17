/** Parses a YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, or ISO date as a LOCAL calendar date. */
export function parseLocalDate(value: string): Date | null {
  if (!value) return null;
  const trimmed = value.trim();

  // 1. YYYY-MM-DD or YYYY/MM/DD
  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(trimmed);
  if (ymd) {
    const y = Number(ymd[1]), mo = Number(ymd[2]) - 1, day = Number(ymd[3]);
    const d = new Date(y, mo, day);
    if (d.getFullYear() === y && d.getMonth() === mo && d.getDate() === day) return d;
    return null;
  }

  // 2. DD-MM-YYYY or DD/MM/YYYY
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(trimmed);
  if (dmy) {
    const day = Number(dmy[1]), mo = Number(dmy[2]) - 1, y = Number(dmy[3]);
    const d = new Date(y, mo, day);
    if (d.getFullYear() === y && d.getMonth() === mo && d.getDate() === day) return d;
    return null;
  }

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Ensures year in a date string (YYYY-MM-DD, DD-MM-YYYY, etc.) does not exceed 4 digits.
 * Clamps 5+ digit years to 4 digits (e.g. 20000-02-03 -> 2000-02-03, 03-02-20000 -> 03-02-2000).
 */
export function sanitizeDobString(value?: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();

  // 1. YYYY-MM-DD format (HTML5 standard date input value)
  const ymdParts = trimmed.split('-');
  if (ymdParts.length === 3) {
    let [year, month, day] = ymdParts;
    let modified = false;
    if (year.length > 4) {
      year = year.slice(0, 4);
      modified = true;
    }
    if (day.length > 4) {
      day = day.slice(0, 4);
      modified = true;
    }
    if (modified) {
      return `${year}-${month}-${day}`;
    }
  }

  // 2. Slashes (YYYY/MM/DD or DD/MM/YYYY)
  const slashParts = trimmed.split('/');
  if (slashParts.length === 3) {
    let [p0, p1, p2] = slashParts;
    let modified = false;
    if (p0.length > 4) {
      p0 = p0.slice(0, 4);
      modified = true;
    }
    if (p2.length > 4) {
      p2 = p2.slice(0, 4);
      modified = true;
    }
    if (modified) {
      return `${p0}/${p1}/${p2}`;
    }
  }

  return trimmed;
}

export function getDobValidationError(value: string | undefined | null): string | null {
  if (!value || !value.trim()) {
    return 'Date of birth is required.';
  }
  const trimmed = value.trim();

  const yearOver4 = /^(\d{5,})[-/]/.exec(trimmed) || /[-/](\d{5,})$/.exec(trimmed);
  if (yearOver4) {
    return 'Year must be 4 digits.';
  }

  // Check specific day-of-month calendar validity for YYYY-MM-DD and DD-MM-YYYY
  let y: number | null = null;
  let mo: number | null = null;
  let day: number | null = null;

  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(trimmed);
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(trimmed);

  if (ymd) {
    y = Number(ymd[1]);
    mo = Number(ymd[2]);
    day = Number(ymd[3]);
  } else if (dmy) {
    day = Number(dmy[1]);
    mo = Number(dmy[2]);
    y = Number(dmy[3]);
  }

  if (y !== null && mo !== null && day !== null) {
    if (mo < 1 || mo > 12) {
      return 'Invalid month in date of birth.';
    }
    const daysInMonth = new Date(y, mo, 0).getDate();
    if (day < 1 || day > daysInMonth) {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return `Invalid calendar date. ${monthNames[mo - 1]} ${y} has only ${daysInMonth} days.`;
    }
  }

  const d = parseLocalDate(trimmed);
  if (!d) {
    return 'Please enter a valid date of birth (DD-MM-YYYY).';
  }

  const now = new Date();
  if (d.getTime() > now.getTime()) {
    return 'Date of birth cannot be in the future.';
  }

  const age = ageOn(d, now);
  if (age < 18) {
    return 'Investor must be at least 18 years old.';
  }
  if (age > 120) {
    return 'Please enter a valid date of birth.';
  }

  return null;
}

function ageOn(d: Date, now: Date = new Date()): number {
  return (
    now.getFullYear() - d.getFullYear() -
    (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate()) ? 1 : 0)
  );
}

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
    return Math.abs(sum - 100) < 0.01; // tolerate floating point (e.g. 33.3 + 33.3 + 33.4)
  },
  requiredText: (value: string, minLen = 2) => {
    return typeof value === 'string' && value.trim().length >= minLen;
  },
  phone: (value: string) => {
    // Only strip a country/trunk prefix when the length shows it IS a prefix. Blindly stripping a leading
    // "91" rejected genuine mobile numbers such as 9123456789.
    let digits = value.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    return /^[6-9][0-9]{9}$/.test(digits);
  },
  email: (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  },
  dob: (value: string) => {
    return getDobValidationError(value) === null;
  },

  bankAccount: (value: string) => {
    return /^[0-9]{9,18}$/.test(value.trim());
  },
  dematBoid: (value: string) => {
    // CDSL: 16 digits. NSDL: "IN" + 6 alphanumeric DP ID + 8 digit client ID.
    const v = value.replace(/[\s-]/g, '').toUpperCase();
    return /^[0-9]{16}$/.test(v) || /^IN[0-9A-Z]{6}[0-9]{8}$/.test(v);
  },
  nomineeDob: (value: string) => {
    const d = parseLocalDate(value);
    if (!d) return false;
    return d.getTime() <= Date.now() && ageOn(d) <= 120; // not in the future
  },
  isMinorDob: (value: string) => {
    const d = parseLocalDate(value);
    return d ? ageOn(d) < 18 : false;
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
    const dobErr = getDobValidationError(data.dob);
    if (dobErr) {
      errs.dob = dobErr;
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
      const dematClean = (data.dematAccountNumber || '').replace(/[\s-]/g, '');
      if (!kycValidators.dematBoid(dematClean)) {
        errs.dematAccountNumber =
          'Enter a valid Demat ID: 16 digits (CDSL) or IN + 6 characters + 8 digits (NSDL).';
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
          errs[`nominee_${idx}_dob`] = 'Enter a valid nominee date of birth (cannot be in the future).';
        }
        const pct = Number(nom.allocationPercentage);
        if (isNaN(pct) || pct <= 0) {
          errs[`nominee_${idx}_pct`] = 'Allocation percentage must be greater than 0%.';
        } else {
          totalPct += pct;
        }
      });

      if (Math.abs(totalPct - 100) >= 0.01) {
        errs.nominees = `Total allocation across all nominees must equal exactly 100% (currently ${Math.round(totalPct * 100) / 100}%).`;
      }
    }
  }

  return errs;
}