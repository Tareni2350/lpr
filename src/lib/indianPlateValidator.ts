import type { PlateValidationResult, ValidationCheck } from '../types/lpr';

export const INDIAN_STATE_CODES: Record<string, string> = {
  AN: 'Andaman and Nicobar Islands',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CG: 'Chhattisgarh',
  CH: 'Chandigarh',
  DD: 'Dadra and Nagar Haveli and Daman and Diu',
  DL: 'Delhi',
  DN: 'Dadra and Nagar Haveli and Daman and Diu',
  GA: 'Goa',
  GJ: 'Gujarat',
  HP: 'Himachal Pradesh',
  HR: 'Haryana',
  JH: 'Jharkhand',
  JK: 'Jammu and Kashmir',
  KA: 'Karnataka',
  KL: 'Kerala',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  MH: 'Maharashtra',
  ML: 'Meghalaya',
  MN: 'Manipur',
  MP: 'Madhya Pradesh',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OD: 'Odisha',
  OR: 'Odisha (Legacy Code)',
  PB: 'Punjab',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TG: 'Telangana',
  TN: 'Tamil Nadu',
  TR: 'Tripura',
  TS: 'Telangana',
  UA: 'Uttarakhand (Legacy Code)',
  UK: 'Uttarakhand',
  UP: 'Uttar Pradesh',
  WB: 'West Bengal',
};

const STANDARD_PATTERN = /^([A-Z]{2})([0-9]{2})([A-Z]{1,3})([0-9]{4})$/;
const DELHI_SINGLE_RTO_PATTERN = /^(DL)([0-9]{1})([A-Z]{1,3})([0-9]{4})$/;
const BH_SERIES_PATTERN = /^([0-9]{2})(BH)([0-9]{4})([A-HJ-NP-Z]{1,2})$/;

export function validateIndianPlate(rawInput: string): PlateValidationResult {
  const cleanedInitial = (rawInput || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  let compact = cleanedInitial;
  let strippedIndPrefix = false;

  // Handle HSRP "IND" hologram mark accidentally prepended during OCR
  if (compact.startsWith('IND') && compact.length >= 11) {
    const candidate = compact.slice(3);
    if (
      STANDARD_PATTERN.test(candidate) ||
      DELHI_SINGLE_RTO_PATTERN.test(candidate) ||
      BH_SERIES_PATTERN.test(candidate) ||
      INDIAN_STATE_CODES[candidate.slice(0, 2)]
    ) {
      compact = candidate;
      strippedIndPrefix = true;
    }
  }

  // 1. Check Bharat (BH) Series: e.g., 22 BH 1234 AA
  const bhMatch = compact.match(BH_SERIES_PATTERN);
  if (bhMatch) {
    const [, year, , regNum, series] = bhMatch;
    const formattedPlate = `${year} BH ${regNum} ${series}`;
    const checks: ValidationCheck[] = [
      {
        label: 'Registration Year Prefix',
        passed: true,
        detail: `20${year} series year code (${year})`,
      },
      {
        label: 'Bharat Series Identifier',
        passed: true,
        detail: 'Matches national "BH" designation',
      },
      {
        label: '4-Digit Unique Number',
        passed: true,
        detail: `Numeric identifier ${regNum}`,
      },
      {
        label: 'Series Letters (Excl. I, O)',
        passed: true,
        detail: `Valid suffix "${series}"`,
      },
    ];

    return {
      isValid: true,
      formatType: 'Bharat (BH) Series',
      rawInput,
      normalizedCompact: compact,
      formattedPlate,
      stateCode: 'BH',
      stateName: 'Pan-India (Bharat Series)',
      rtoCode: null,
      seriesCode: series,
      registrationNumber: regNum,
      registrationYear: `20${year}`,
      strippedIndPrefix,
      checks,
      summary: 'Valid Bharat (BH) Series pan-India registration format.',
    };
  }

  // 2. Check Standard State/UT Format: e.g., KA 05 MJ 4821 / MH 12 DE 1433
  const stdMatch = compact.match(STANDARD_PATTERN);
  if (stdMatch) {
    const [, stateCode, rtoCode, series, regNum] = stdMatch;
    const stateName = INDIAN_STATE_CODES[stateCode] ?? null;
    const isStateValid = Boolean(stateName);
    const isNumNonZero = regNum !== '0000';
    const formattedPlate = `${stateCode} ${rtoCode} ${series} ${regNum}`;

    const checks: ValidationCheck[] = [
      {
        label: 'State / UT Code',
        passed: isStateValid,
        detail: isStateValid
          ? `${stateCode} — ${stateName}`
          : `"${stateCode}" is not an active Indian State/UT RTO code`,
      },
      {
        label: 'RTO District Code',
        passed: true,
        detail: `2-digit district code "${rtoCode}"`,
      },
      {
        label: 'Series Alphabets',
        passed: true,
        detail: `${series.length}-letter series "${series}"`,
      },
      {
        label: '4-Digit Registration Number',
        passed: isNumNonZero,
        detail: isNumNonZero
          ? `Valid sequence "${regNum}"`
          : '0000 is not a valid registration number',
      },
    ];

    const isValid = isStateValid && isNumNonZero;

    return {
      isValid,
      formatType: isValid ? 'Standard State/UT RTO' : 'Invalid / Non-Standard',
      rawInput,
      normalizedCompact: compact,
      formattedPlate,
      stateCode,
      stateName,
      rtoCode,
      seriesCode: series,
      registrationNumber: regNum,
      registrationYear: null,
      strippedIndPrefix,
      checks,
      summary: isValid
        ? `Valid Indian State/UT license plate registered in ${stateName}.`
        : !isStateValid
          ? `Format matches AA 00 AA 0000, but "${stateCode}" is not a recognized Indian State/UT code.`
          : 'Registration sequence 0000 is invalid.',
    };
  }

  // 3. Check Delhi single-digit RTO variant: e.g., DL 1C AA 1234 -> DL 1C AA 1234
  const dlMatch = compact.match(DELHI_SINGLE_RTO_PATTERN);
  if (dlMatch) {
    const [, stateCode, rtoDigit, series, regNum] = dlMatch;
    const isNumNonZero = regNum !== '0000';
    const formattedPlate = `${stateCode} ${rtoDigit}${series.slice(0, 1)} ${series.slice(1) ? series.slice(1) + ' ' : ''}${regNum}`.replace(
      /\s+/g,
      ' '
    );

    const checks: ValidationCheck[] = [
      {
        label: 'State / UT Code',
        passed: true,
        detail: 'DL — Delhi',
      },
      {
        label: 'RTO District Code',
        passed: true,
        detail: `Single-digit Delhi RTO "${rtoDigit}"`,
      },
      {
        label: 'Series Alphabets',
        passed: true,
        detail: `Series "${series}"`,
      },
      {
        label: '4-Digit Registration Number',
        passed: isNumNonZero,
        detail: isNumNonZero ? `Valid sequence "${regNum}"` : '0000 is invalid',
      },
    ];

    return {
      isValid: isNumNonZero,
      formatType: isNumNonZero
        ? 'Delhi Legacy / Single-Digit RTO'
        : 'Invalid / Non-Standard',
      rawInput,
      normalizedCompact: compact,
      formattedPlate,
      stateCode: 'DL',
      stateName: 'Delhi',
      rtoCode: rtoDigit,
      seriesCode: series,
      registrationNumber: regNum,
      registrationYear: null,
      strippedIndPrefix,
      checks,
      summary: isNumNonZero
        ? 'Valid Delhi single-digit RTO registration format.'
        : 'Registration sequence 0000 is invalid.',
    };
  }

  // 4. Invalid / Non-standard fallback with diagnostic checklist
  const candidateState = compact.slice(0, 2);
  const hasStatePrefix = Boolean(INDIAN_STATE_CODES[candidateState]);
  const hasLength = compact.length >= 8 && compact.length <= 11;
  const endsWithFourDigits = /[0-9]{4}$/.test(compact);

  const checks: ValidationCheck[] = [
    {
      label: 'Standard / BH Pattern Match',
      passed: false,
      detail: compact
        ? `"${compact}" does not match AA 00 AA 0000 or 00 BH 0000 AA`
        : 'No alphanumeric characters extracted',
    },
    {
      label: 'State / UT Prefix',
      passed: hasStatePrefix,
      detail: hasStatePrefix
        ? `${candidateState} — ${INDIAN_STATE_CODES[candidateState]}`
        : candidateState
          ? `"${candidateState}" is not a recognized Indian State/UT code`
          : 'Missing 2-letter State/UT prefix',
    },
    {
      label: 'Character Length (8–11)',
      passed: hasLength,
      detail: `Extracted ${compact.length} alphanumeric character${compact.length === 1 ? '' : 's'}`,
    },
    {
      label: '4-Digit Trailing Sequence',
      passed: endsWithFourDigits,
      detail: endsWithFourDigits
        ? 'Ends with 4 digits'
        : 'Expected 4 trailing registration digits',
    },
  ];

  return {
    isValid: false,
    formatType: 'Invalid / Non-Standard',
    rawInput,
    normalizedCompact: compact,
    formattedPlate: compact || 'UNREADABLE',
    stateCode: hasStatePrefix ? candidateState : null,
    stateName: hasStatePrefix ? INDIAN_STATE_CODES[candidateState] : null,
    rtoCode: null,
    seriesCode: null,
    registrationNumber: null,
    registrationYear: null,
    strippedIndPrefix,
    checks,
    summary: compact
      ? `Extracted "${compact}" does not conform to standard Indian RTO or BH-Series rules.`
      : 'No valid license plate text could be extracted.',
  };
}
