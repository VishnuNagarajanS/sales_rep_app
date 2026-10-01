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