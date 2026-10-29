/**
 * Phone and WhatsApp utility functions for Zimbabwe (+263) and South Africa (+27).
 * Ensures valid international E.164 format and consistent display.
 */

export interface PhoneValidationResult {
  isValid: boolean;
  e164: string;
  displayFormatted: string;
  error?: string;
}

/**
 * Normalizes digits and strips leading zero.
 * Example: '077 123 4567' -> '771234567'
 */
export function cleanLocalDigits(raw: string): string {
  if (!raw) return '';
  const digitsOnly = raw.replace(/\D/g, '');
  return digitsOnly.replace(/^0+/, '');
}

/**
 * Converts a country code and local number to E.164.
 * e.g. ('+263', '077 123 4567') -> '+263771234567'
 * e.g. ('+27', '082 123 4567') -> '+27821234567'
 */
export function toE164(countryDialCode: string, localNumber: string): string {
  const cleanCode = countryDialCode.replace(/\D/g, '');
  const cleanDigits = cleanLocalDigits(localNumber);
  if (!cleanDigits) return '';
  return `+${cleanCode}${cleanDigits}`;
}

/**
 * Validates whether the given phone number fits Zimbabwe or South Africa standards.
 * ZW: Mobile typically 9 digits starting with 7 (e.g. 77, 71, 73, 78); landlines 8-9 digits.
 * SA: 9 digits starting with 6, 7, 8 (mobile) or 1-5 (landline).
 */
export function validatePhoneNumber(
  countryDialCode: string,
  localNumber: string
): PhoneValidationResult {
  const digits = cleanLocalDigits(localNumber);
  const code = countryDialCode.replace(/\D/g, '');

  if (!digits) {
    return {
      isValid: false,
      e164: '',
      displayFormatted: '',
      error: 'Phone number is required.',
    };
  }

  // Zimbabwe (+263)
  if (code === '263') {
    if (digits.length < 8 || digits.length > 10) {
      return {
        isValid: false,
        e164: `+263${digits}`,
        displayFormatted: `+263 ${digits}`,
        error: 'Zimbabwe phone numbers are typically 9 digits (e.g. 77 123 4567).',
      };
    }

    // Format for display: +263 77 123 4567
    const formatted =
      digits.length === 9
        ? `+263 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`
        : `+263 ${digits}`;

    return {
      isValid: true,
      e164: `+263${digits}`,
      displayFormatted: formatted,
    };
  }

  // South Africa (+27)
  if (code === '27') {
    if (digits.length !== 9) {
      return {
        isValid: false,
        e164: `+27${digits}`,
        displayFormatted: `+27 ${digits}`,
        error: 'South African phone numbers are 9 digits without the leading 0 (e.g. 82 123 4567).',
      };
    }

    const formatted = `+27 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
    return {
      isValid: true,
      e164: `+27${digits}`,
      displayFormatted: formatted,
    };
  }

  // Generic fallback
  const isValid = digits.length >= 7 && digits.length <= 12;
  return {
    isValid,
    e164: `+${code}${digits}`,
    displayFormatted: `+${code} ${digits}`,
    error: isValid ? undefined : 'Please enter a valid phone number.',
  };
}

/**
 * Creates clean wa.me direct URL without any invalid characters.
 */
export function getWhatsAppDirectUrl(e164OrRaw: string, message?: string): string {
  const digits = e164OrRaw.replace(/\D/g, '');
  if (!digits) return '#';
  const base = `https://wa.me/${digits}`;
  if (message) {
    return `${base}?text=${encodeURIComponent(message)}`;
  }
  return base;
}
