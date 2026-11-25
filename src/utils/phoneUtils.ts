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
 * Converts escaped newline text from older enquiry records into real line breaks.
 * Keeps paragraph spacing tidy without changing the stored database value.
 */
export function normalizeWhatsAppMessage(message: string | null | undefined): string {
  if (typeof message !== 'string') return '';
  return message
    .replace(/\\+r\\+n/g, '\n')
    .replace(/\\+n/g, '\n')
    .replace(/\\+r/g, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n')
    .replace(/^\n+|\n+$/g, '')
    .trim();
}

export type BuyerEnquiryChoice =
  | 'Is it still available?'
  | 'Book a test drive'
  | 'Make an offer'
  | 'How do I pay a deposit?';

export interface BuyerEnquiryMessageInput {
  dealershipName?: string | null;
  buyerName?: string | null;
  buyerPhone?: string | null;
  vehicleName?: string | null;
  price?: string | null;
  choice?: BuyerEnquiryChoice | null;
  preferredTime?: string | null;
  buyingTimeframe?: string | null;
}

function cleanMessagePart(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/g, '') : '';
}

function buyingTimeframeSentence(value: string | null | undefined): string {
  const timeframe = cleanMessagePart(value);
  if (!timeframe) return '';
  if (/^(just browsing|only browsing)$/i.test(timeframe)) return "I'm just browsing.";
  if (/^(not sure|undecided)$/i.test(timeframe)) return "I'm not sure about my buying timeframe yet.";
  if (/^(i'm hoping to buy|i am hoping to buy)\s+/i.test(timeframe)) {
    return timeframe.charAt(0).toUpperCase() + timeframe.slice(1) + '.';
  }
  const hasTimingPrefix = /^(within|in|this|next|by|as soon as possible|immediately|today|tomorrow)\b/i.test(timeframe);
  return "I'm hoping to buy " + (hasTimingPrefix ? timeframe : 'within ' + timeframe) + '.';
}

/** Builds the buyer-facing introduction using real newlines and omits missing details. */
export function buildBuyerEnquiryMessage(input: BuyerEnquiryMessageInput): string {
  const dealershipName = cleanMessagePart(input.dealershipName);
  const buyerName = cleanMessagePart(input.buyerName);
  const buyerPhone = cleanMessagePart(input.buyerPhone);
  const vehicleName = cleanMessagePart(input.vehicleName);
  const price = cleanMessagePart(input.price);
  const preferredTime = cleanMessagePart(input.preferredTime);
  const greeting = dealershipName ? 'Hi ' + dealershipName + ',' : 'Hi,';
  const interest = vehicleName
    ? "I'm interested in the " + vehicleName + (price ? ' listed at ' + price : '') + ' on your Lotlé showroom.'
    : "I'm interested in vehicles on your Lotlé showroom.";
  const introduction = (buyerName ? 'My name is ' + buyerName + '. ' : '') + interest;

  let choiceLine = '';
  if (input.choice === 'Is it still available?') choiceLine = 'Is it still available?';
  if (input.choice === 'Book a test drive') {
    choiceLine = "I'd like to book a test drive." + (preferredTime ? ' Preferred time: ' + preferredTime + '.' : '');
  }
  if (input.choice === 'Make an offer') choiceLine = "I'd like to make an offer.";
  if (input.choice === 'How do I pay a deposit?') choiceLine = 'Where can I send a deposit?';

  const paragraphs = [
    greeting,
    introduction,
    choiceLine,
    buyingTimeframeSentence(input.buyingTimeframe),
    buyerPhone ? 'My WhatsApp number is ' + buyerPhone + '.' : '',
    'Thank you!',
  ].filter(Boolean);
  return normalizeWhatsAppMessage(paragraphs.join('\n\n'));
}

/** Builds and encodes a WhatsApp direct-chat URL exactly once. */
export function buildWhatsAppUrl(e164OrRaw: string, message?: string): string {
  const digits = e164OrRaw.replace(/\D/g, '');
  if (!digits) return '#';
  const base = 'https://wa.me/' + digits;
  const normalized = normalizeWhatsAppMessage(message);
  return normalized ? base + '?text=' + encodeURIComponent(normalized) : base;
}

/** Builds a WhatsApp share URL when the recipient is selected by WhatsApp. */
export function buildWhatsAppShareUrl(message: string): string {
  return 'https://api.whatsapp.com/send?text=' + encodeURIComponent(normalizeWhatsAppMessage(message));
}

export function getWhatsAppDirectUrl(e164OrRaw: string, message?: string): string {
  return buildWhatsAppUrl(e164OrRaw, message);
}
