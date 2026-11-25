import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CarFront, Check, ExternalLink, MessageCircle, X } from 'lucide-react';
import type { Dealership, Vehicle } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { storageService } from '../../services/storage';
import { isSupabaseConfigured } from '../../lib/supabase';
import { cleanLocalDigits, getWhatsAppDirectUrl, toE164, validatePhoneNumber } from '../../utils/phoneUtils';
import './CustomerEnquiryAssistant.css';

type EnquiryChoice =
  | 'Is it still available?'
  | 'Book a test drive'
  | 'Make an offer'
  | 'How do I pay a deposit?';

type Screen = 'choice' | 'details' | 'success';

interface Props {
  dealership: Dealership;
  vehicle?: Vehicle | null;
  onClose: () => void;
  preview?: boolean;
}

const choices: EnquiryChoice[] = [
  'Is it still available?',
  'Book a test drive',
  'Make an offer',
  'How do I pay a deposit?',
];

const formatLocalPhone = (digits: string): string => {
  if (!digits) return '';
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 9)]
    .filter(Boolean)
    .join(' ');
};

const rateLimitKey = (vehicleId: string, dealershipId: string, identifier: string): string => {
  const source = [vehicleId || dealershipId, identifier].join(':');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  }
  return 'lotle:enquiry-limit:' + (hash >>> 0).toString(36);
};

export const CustomerEnquiryAssistant: React.FC<Props> = ({
  dealership,
  vehicle,
  onClose,
  preview = false,
}) => {
  const [screen, setScreen] = useState<Screen>('choice');
  const [choice, setChoice] = useState<EnquiryChoice | null>(null);
  const [name, setName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [whatsAppUrl, setWhatsAppUrl] = useState('');
  const dialogRef = useRef<HTMLElement>(null);

  const vehicleName = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
    : '';
  const title = vehicleName || 'Showroom enquiry';
  const photo = vehicle?.photos?.[0] || dealership.coverUrl || dealership.logoUrl || '';
  const dealerNumber = (dealership.whatsapp || dealership.phone || '').replace(/\D/g, '');
  const countryDialCode = dealership.country === 'South Africa' ? '+27' : '+263';
  const countryDigits = countryDialCode.replace(/\D/g, '');
  const priceLabel = vehicle && vehicle.price > 0
    ? new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: vehicle.currency || dealership.currency,
        maximumFractionDigits: 0,
      }).format(vehicle.price)
    : 'Price on request';

  const phoneValidation = useMemo(
    () => validatePhoneNumber(countryDialCode, phoneDigits),
    [countryDialCode, phoneDigits],
  );
  const formattedPhone = formatLocalPhone(phoneDigits);
  const nameError = nameTouched && name.trim().length < 2
    ? 'Please enter at least 2 characters for your name.'
    : '';
  const phoneError = phoneTouched && !phoneValidation.isValid
    ? phoneValidation.error || 'Please enter a valid WhatsApp number.'
    : '';
  const canSubmit = name.trim().length >= 2 && phoneValidation.isValid && !saving;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFirst = () => {
      const target = dialogRef.current?.querySelector<HTMLElement>(
        screen === 'choice'
          ? '.lotle-enquiry-choice'
          : screen === 'details'
            ? '#lotle-enquiry-name'
            : '.lotle-enquiry-open-whatsapp',
      );
      target?.focus();
    };
    focusFirst();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(element => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose, screen]);

  const updatePhone = (value: string) => {
    let digits = cleanLocalDigits(value);
    if (digits.startsWith(countryDigits)) digits = digits.slice(countryDigits.length);
    setPhoneDigits(digits.slice(0, countryDialCode === '+263' ? 10 : 9));
    setPhoneTouched(false);
  };

  const buildMessage = (anonymous: boolean): string => {
    const lines = [
      anonymous ? 'Hello, I am enquiring about this vehicle.' : 'Hi, my name is ' + name.trim() + '.',
      vehicleName
        ? 'I am interested in the ' + vehicleName + (vehicle && vehicle.price > 0 ? ' (' + priceLabel + ')' : '') + '.'
        : 'I am enquiring about vehicles at ' + dealership.name + '.',
      'My question: ' + choice,
      choice === 'Book a test drive' && preferredTime.trim()
        ? 'Preferred day and time: ' + preferredTime.trim()
        : '',
    ];
    return lines.filter(Boolean).join('\n\n');
  };

  const persistEnquiry = async (payload: {
    dealershipId: string;
    vehicleId?: string;
    buyerName: string;
    buyerPhone: string;
    message: string;
    stage: 'new';
    source: 'whatsapp';
  }) => {
    if (isSupabaseConfigured()) {
      await supabaseService.createEnquiry(payload);
    } else {
      storageService.saveDealership(dealership);
      storageService.createEnquiry(payload);
    }
  };

  const submitEnquiry = async (anonymous: boolean) => {
    if (saving) return;
    setError('');
    setSaveNotice('');

    if (preview) {
      setError('This is a showroom preview. Enquiries cannot be sent from here.');
      return;
    }
    if (honeypot.trim()) {
      setError('We could not process that request. Please try again.');
      return;
    }
    if (!dealerNumber) {
      setError('This dealership has not added a WhatsApp number yet.');
      return;
    }
    if (!anonymous) {
      setNameTouched(true);
      setPhoneTouched(true);
      if (name.trim().length < 2 || !phoneValidation.isValid) {
        setError('Please check your name and WhatsApp number.');
        return;
      }
    }
    if (!choice) return;

    const buyerPhone = anonymous ? '' : toE164(countryDialCode, phoneDigits);
    const identifier = anonymous ? 'anonymous' : buyerPhone;
    const limitKey = rateLimitKey(vehicle?.id || '', dealership.id, identifier);
    try {
      const previousAttempt = Number(localStorage.getItem(limitKey) || 0);
      if (previousAttempt && Date.now() - previousAttempt < 120000) {
        setError('You have just sent an enquiry about this car. Please wait a couple of minutes before sending another.');
        return;
      }
      localStorage.setItem(limitKey, String(Date.now()));
    } catch {
      // Storage restrictions should not prevent a genuine enquiry.
    }

    const message = buildMessage(anonymous);
    const payload = {
      dealershipId: dealership.id,
      ...(vehicle?.id ? { vehicleId: vehicle.id } : {}),
      buyerName: anonymous ? 'Anonymous buyer' : name.trim(),
      buyerPhone,
      message,
      stage: 'new' as const,
      source: 'whatsapp' as const,
    };
    const url = getWhatsAppDirectUrl(dealerNumber, message);
    setWhatsAppUrl(url);

    // Open a blank tab synchronously within the click so popup blockers do not
    // discard the WhatsApp navigation while the enquiry save is in progress.
    let popup: Window | null = null;
    try {
      popup = window.open('about:blank', '_blank');
      if (popup) popup.opener = null;
    } catch {
      popup = null;
    }

    setSaving(true);
    try {
      await persistEnquiry(payload);
    } catch (submitError) {
      console.error('Customer WhatsApp enquiry could not be saved:', submitError);
      setSaveNotice('WhatsApp is ready. We could not save your enquiry yet, so we will retry once in the background.');
      window.setTimeout(() => {
        void persistEnquiry(payload).catch(retryError => {
          console.error('Background enquiry retry failed:', retryError);
        });
      }, 1200);
    }

    if (popup && !popup.closed) {
      try {
        popup.location.href = url;
      } catch {
        // The on-sheet fallback remains available if the browser blocks navigation.
      }
    }
    setSaving(false);
    setScreen('success');
  };

  const openWhatsAppFallback = () => {
    if (!whatsAppUrl) return;
    window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="lotle-enquiry-backdrop" onMouseDown={handleBackdropClick}>
      <section
        ref={dialogRef}
        className="lotle-enquiry-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lotle-enquiry-title"
      >
        <header className="lotle-enquiry-header">
          <div className="lotle-enquiry-car">
            <div className="lotle-enquiry-car-photo">
              {photo ? <img src={photo} alt="" /> : <CarFront size={25} aria-hidden="true" />}
            </div>
            <div className="lotle-enquiry-car-copy">
              <strong>{title}</strong>
              <span>{vehicle ? priceLabel : dealership.name}</span>
            </div>
          </div>
          <button type="button" className="lotle-enquiry-close" onClick={onClose} aria-label="Close enquiry">
            <X size={20} />
          </button>
        </header>

        {screen === 'choice' && (
          <div className="lotle-enquiry-content">
            <h2 id="lotle-enquiry-title">What would you like to do?</h2>
            <p>Choose what you would like to ask the dealership.</p>
            <div className="lotle-enquiry-choices">
              {choices.map(item => (
                <button
                  type="button"
                  className="lotle-enquiry-choice"
                  key={item}
                  onClick={() => {
                    setChoice(item);
                    setError('');
                    setScreen('details');
                  }}
                >
                  <span>{item}</span>
                  <span className="lotle-enquiry-choice-arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
            {error && <p className="lotle-enquiry-error" role="alert">{error}</p>}
          </div>
        )}

        {screen === 'details' && (
          <form
            className="lotle-enquiry-form"
            onSubmit={event => {
              event.preventDefault();
              void submitEnquiry(false);
            }}
          >
            <div className="lotle-enquiry-content">
              <h2 id="lotle-enquiry-title">Where should {dealership.name} reply?</h2>
              <p className="lotle-enquiry-selected">{choice}</p>

              <label htmlFor="lotle-enquiry-name">Your name</label>
              <input
                id="lotle-enquiry-name"
                value={name}
                onChange={event => setName(event.target.value)}
                onBlur={() => setNameTouched(true)}
                placeholder="Your name"
                autoComplete="name"
                maxLength={120}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? 'lotle-enquiry-name-error' : undefined}
              />
              {nameError && <p className="lotle-enquiry-field-error" id="lotle-enquiry-name-error">{nameError}</p>}

              <label htmlFor="lotle-enquiry-phone">WhatsApp number</label>
              <div className="lotle-enquiry-phone">
                <span className="lotle-enquiry-country-code" aria-label={'Country code ' + countryDialCode}>{countryDialCode}</span>
                <input
                  id="lotle-enquiry-phone"
                  value={formattedPhone}
                  onChange={event => updatePhone(event.target.value)}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder={countryDialCode === '+263' ? '77 123 4567' : '82 123 4567'}
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={14}
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={phoneError ? 'lotle-enquiry-phone-error' : undefined}
                />
              </div>
              {phoneError && <p className="lotle-enquiry-field-error" id="lotle-enquiry-phone-error">{phoneError}</p>}

              {choice === 'Book a test drive' && (
                <>
                  <label htmlFor="lotle-enquiry-preferred-time">Preferred day and time <span>(optional)</span></label>
                  <input
                    id="lotle-enquiry-preferred-time"
                    value={preferredTime}
                    onChange={event => setPreferredTime(event.target.value)}
                    placeholder="e.g. Saturday morning"
                    maxLength={100}
                  />
                </>
              )}

              <p className="lotle-enquiry-privacy">Your number is shared only with {dealership.name}.</p>

              <div className="lotle-enquiry-honeypot" aria-hidden="true">
                <label htmlFor="lotle-enquiry-website">Website</label>
                <input
                  id="lotle-enquiry-website"
                  value={honeypot}
                  onChange={event => setHoneypot(event.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
              {error && <p className="lotle-enquiry-error" role="alert">{error}</p>}
              {saveNotice && <p className="lotle-enquiry-save-notice" role="status">{saveNotice}</p>}
            </div>
            <footer className="lotle-enquiry-footer">
              <button type="button" className="lotle-enquiry-back" onClick={() => { setError(''); setScreen('choice'); }} aria-label="Back to choices">
                <ArrowLeft size={19} />
              </button>
              <div className="lotle-enquiry-submit-actions">
                <button type="submit" className="lotle-enquiry-submit" disabled={!canSubmit || !dealerNumber}>
                  {saving ? 'Saving enquiry…' : 'Send on WhatsApp'}
                  <MessageCircle size={18} />
                </button>
                <button type="button" className="lotle-enquiry-skip" onClick={() => void submitEnquiry(true)} disabled={saving || !dealerNumber}>
                  Just open WhatsApp
                </button>
              </div>
            </footer>
          </form>
        )}

        {screen === 'success' && (
          <div className="lotle-enquiry-content lotle-enquiry-success">
            <div className="lotle-enquiry-success-icon"><Check size={25} /></div>
            <h2 id="lotle-enquiry-title">Sent. {dealership.name} will reply on WhatsApp.</h2>
            <p>Your message is ready in WhatsApp. Send it there to start the conversation.</p>
            {saveNotice && <p className="lotle-enquiry-save-notice" role="status">{saveNotice}</p>}
            <button type="button" className="lotle-enquiry-submit lotle-enquiry-open-whatsapp" onClick={openWhatsAppFallback} disabled={!whatsAppUrl}>
              Open WhatsApp <ExternalLink size={17} />
            </button>
            <button type="button" className="lotle-enquiry-close-finish" onClick={onClose}>Close</button>
          </div>
        )}
      </section>
    </div>
  );
};
