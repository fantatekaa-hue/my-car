export interface PlateValidationResult {
  valid: boolean;
  normalized: string;
  lettersPart: string;
  digitsPart: string;
  script: 'AR' | 'EN' | 'INVALID';
  error?: string;
}

const ARABIC_DIGITS_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

const ARABIC_LETTER_REGEX = /^[\u0621-\u064A]$/;
const ENGLISH_LETTER_REGEX = /^[A-Za-z]$/;
const ASCII_DIGIT_REGEX = /^[0-9]$/;

function normalizeDigit(ch: string): string {
  return ARABIC_DIGITS_MAP[ch] ?? ch;
}

/**
 * Validates Egyptian license plates:
 * - Accepts 2 to 3 letters AND 2 to 4 digits (min 2 letters + 2 digits, max 3 letters + 4 digits)
 * - Supports Arabic and English letters
 * - Accepts optional spaces anywhere
 */
export function validateEgyptianPlate(rawInput: string): PlateValidationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      valid: false,
      normalized: '',
      lettersPart: '',
      digitsPart: '',
      script: 'INVALID',
      error: 'يرجى إدخال رقم اللوحة المصرية (من 2 إلى 3 حروف ومن 2 إلى 4 أرقام).',
    };
  }

  // Remove spaces, dashes, and Arabic tatweel (e.g., هـ -> ه)
  const compact = trimmed.replace(/[\s\-\u0640]+/g, '');
  const chars = Array.from(compact).map(normalizeDigit);

  const arLetters: string[] = [];
  const enLetters: string[] = [];
  const digits: string[] = [];
  const unknown: string[] = [];

  for (const ch of chars) {
    if (ARABIC_LETTER_REGEX.test(ch)) {
      arLetters.push(ch);
    } else if (ENGLISH_LETTER_REGEX.test(ch)) {
      enLetters.push(ch.toUpperCase());
    } else if (ASCII_DIGIT_REGEX.test(ch)) {
      digits.push(ch);
    } else {
      unknown.push(ch);
    }
  }

  if (unknown.length > 0) {
    return {
      valid: false,
      normalized: '',
      lettersPart: '',
      digitsPart: '',
      script: 'INVALID',
      error: 'رقم اللوحة يحتوي على رموز غير مسموحة. المسموح: حروف عربية أو إنجليزية وأرقام فقط.',
    };
  }

  if (arLetters.length > 0 && enLetters.length > 0) {
    return {
      valid: false,
      normalized: '',
      lettersPart: '',
      digitsPart: '',
      script: 'INVALID',
      error: 'لا تخلط بين الحروف العربية والإنجليزية في نفس اللوحة.',
    };
  }

  const letters = arLetters.length > 0 ? arLetters : enLetters;
  const script: 'AR' | 'EN' = arLetters.length > 0 ? 'AR' : 'EN';

  if (letters.length < 2 || letters.length > 3 || digits.length < 2 || digits.length > 4) {
    return {
      valid: false,
      normalized: '',
      lettersPart: '',
      digitsPart: '',
      script: 'INVALID',
      error:
        'صيغة اللوحة المصرية: من 2 إلى 3 حروف مع من 2 إلى 4 أرقام (مثال: س ب 12 أو س ب ع 1234 أو AB 123).',
    };
  }

  // Ensure letters are grouped together and digits grouped together
  const joined = chars.join('');
  const patternAR = /^([\u0621-\u064A]{2,3}[0-9]{2,4}|[0-9]{2,4}[\u0621-\u064A]{2,3})$/;
  const patternEN = /^([A-Za-z]{2,3}[0-9]{2,4}|[0-9]{2,4}[A-Za-z]{2,3})$/;

  if (!patternAR.test(joined) && !patternEN.test(joined)) {
    return {
      valid: false,
      normalized: '',
      lettersPart: '',
      digitsPart: '',
      script: 'INVALID',
      error: 'يجب أن تكون الحروف متصلة والأرقام متصلة (مثال: ق م ر 4521 أو س ب 12).',
    };
  }

  const lettersPart = letters.join(' ');
  const digitsPart = digits.join('');

  return {
    valid: true,
    normalized: `${lettersPart} - ${digitsPart}`,
    lettersPart,
    digitsPart,
    script,
  };
}

export function splitPlateToSlots(plateRaw: string): {
  letterSlots: [string, string, string];
  digitSlots: [string, string, string, string];
} {
  const compact = plateRaw.replace(/[\s\-\u0640]+/g, '');
  const letters: string[] = [];
  const digits: string[] = [];
  for (const ch of Array.from(compact).map(normalizeDigit)) {
    if (ARABIC_LETTER_REGEX.test(ch) || ENGLISH_LETTER_REGEX.test(ch)) {
      if (letters.length < 3) letters.push(ENGLISH_LETTER_REGEX.test(ch) ? ch.toUpperCase() : ch);
    } else if (ASCII_DIGIT_REGEX.test(ch)) {
      if (digits.length < 4) digits.push(ch);
    }
  }
  return {
    letterSlots: [letters[0] ?? '', letters[1] ?? '', letters[2] ?? ''],
    digitSlots: [digits[0] ?? '', digits[1] ?? '', digits[2] ?? '', digits[3] ?? ''],
  };
}
