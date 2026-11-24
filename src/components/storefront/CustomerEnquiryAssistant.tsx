import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, MessageCircle, X } from 'lucide-react';
import type { Dealership, Vehicle } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { storageService } from '../../services/storage';
import { isSupabaseConfigured } from '../../lib/supabase';
import './CustomerEnquiryAssistant.css';

interface Props {
  dealership: Dealership;
  vehicle?: Vehicle | null;
  onClose: () => void;
}

const budgetsFor = (currency: string) => { const symbol = currency === 'ZAR' ? 'R' : currency === 'ZWG' ? 'ZWG ' : '$'; return ['Under ' + symbol + '3,000', symbol + '3,000–' + symbol + '5,000', symbol + '5,000–' + symbol + '8,000', symbol + '8,000–' + symbol + '12,000', symbol + '12,000–' + symbol + '20,000', symbol + '20,000+']; };

export const CustomerEnquiryAssistant: React.FC<Props> = ({ dealership, vehicle, onClose }) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [budget, setBudget] = useState('');
  const [timeline, setTimeline] = useState('');
  const [requirements, setRequirements] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const vehicleName = vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') : '';
  const dealerNumber = (dealership.whatsapp || dealership.phone || '').replace(/\D/g, '');
  const progress = ((step + 1) / 4) * 100;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = ''; };
  }, [onClose, saving]);

  const canContinue = useMemo(() => {
    if (step === 0) return name.trim().length >= 2;
    if (step === 3) return phone.replace(/\D/g, '').length >= 7;
    return true;
  }, [step, name, phone]);

  const openWhatsApp = async () => {
    if (saving) return;
    setError('');
    setSaving(true);
    const details = [
      budget ? 'My budget is ' + budget + '.' : '',
      timeline ? 'I am hoping to buy: ' + timeline.toLowerCase() + '.' : '',
      requirements.trim() ? 'Other requirements: ' + requirements.trim() : '',
    ].filter(Boolean).join(' ');
    const message = [
      'Hi, my name is ' + name.trim() + '.',
      vehicleName ? 'I am interested in the ' + vehicleName + ' listed on your Lotlé showroom.' : 'I am interested in finding a car from ' + dealership.name + '.',
      details,
      'My WhatsApp number is ' + phone.trim() + '.',
      'I would love to know more. Thank you!',
    ].filter(Boolean).join('\\n\\n');

    try {
      const enquiry = {
        dealershipId: dealership.id,
        ...(vehicle?.id ? { vehicleId: vehicle.id } : {}),
        buyerName: name.trim(),
        buyerPhone: phone.trim(),
        message,
        stage: 'new' as const,
        source: 'whatsapp' as const,
        // Public enquiry RLS requires notes to remain empty.
      };
      if (isSupabaseConfigured()) {
        await supabaseService.createEnquiry(enquiry);
      } else {
        storageService.saveDealership(dealership);
        storageService.createEnquiry(enquiry);
      }
      const url = 'https://wa.me/' + dealerNumber + '?text=' + encodeURIComponent(message);
      window.location.assign(url);
    } catch (submitError) {
      console.error('Customer WhatsApp enquiry could not be saved:', submitError);
      setError('We could not save your enquiry just yet. Please check your connection and try again.');
      setSaving(false);
    }
  };

  const next = () => {
    if (!canContinue) return;
    setError('');
    setStep(current => Math.min(3, current + 1));
  };

  return (
    <div className="lotle-enquiry-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section className="lotle-enquiry-dialog" role="dialog" aria-modal="true" aria-labelledby="lotle-enquiry-title">
        <header className="lotle-enquiry-header">
          <div><span className="lotle-enquiry-eyebrow">A QUICK INTRODUCTION</span><span className="lotle-enquiry-step">Step {step + 1} of 4</span></div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close enquiry"><X size={20}/></button>
        </header>
        <div className="lotle-enquiry-progress"><span style={{ width: progress + '%' }}/></div>
        <div className="lotle-enquiry-content">
          {vehicleName && <div className="lotle-enquiry-vehicle"><span>ASKING ABOUT</span><strong>{vehicleName}</strong></div>}
          {step === 0 && <>
            <h2 id="lotle-enquiry-title">Let's get you closer to your next car.</h2>
            <p>First, what should we call you?</p>
            <label>Your name<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Tendai" autoComplete="name" maxLength={120}/></label>
          </>}
          {step === 1 && <>
            <h2 id="lotle-enquiry-title">What's your budget looking like?</h2>
            <p>Choose whichever feels closest. You can skip this if you're still deciding.</p>
            <div className="lotle-enquiry-options">
              {budgetsFor(dealership.currency).map(option => <button type="button" key={option} className={budget === option ? 'selected' : ''} onClick={() => setBudget(option)}>{option}{budget === option && <Check size={16}/>}</button>)}
            </div>
            <button type="button" className="lotle-enquiry-skip" onClick={next}>I'll decide later</button>
          </>}
          {step === 2 && <>
            <h2 id="lotle-enquiry-title">When are you hoping to buy?</h2>
            <p>No pressure. This just helps the dealer understand your plans.</p>
            <div className="lotle-enquiry-options">
              {['As soon as possible', 'Within a month', 'Within 3 months', 'Just exploring'].map(option => <button type="button" key={option} className={timeline === option ? 'selected' : ''} onClick={() => setTimeline(option)}>{option}{timeline === option && <Check size={16}/>}</button>)}
            </div>
            <label className="lotle-enquiry-extra">Anything else the dealer should know? <textarea value={requirements} onChange={event => setRequirements(event.target.value)} placeholder="e.g. Automatic, low mileage…" rows={2} maxLength={500}/></label>
            <button type="button" className="lotle-enquiry-skip" onClick={next}>Skip for now</button>
          </>}
          {step === 3 && <>
            <h2 id="lotle-enquiry-title">Where can the dealer reach you?</h2>
            <p>Add your WhatsApp number so the dealer knows who they're speaking to.</p>
            <label>WhatsApp number<input autoFocus value={phone} onChange={event => setPhone(event.target.value)} placeholder="+263 77 123 4567" autoComplete="tel" inputMode="tel" maxLength={40}/></label>
            <p className="lotle-enquiry-privacy">Your details are shared with {dealership.name} to help with your enquiry.</p>
          </>}
          {error && <p className="lotle-enquiry-error" role="alert">{error}</p>}
        </div>
        <footer className="lotle-enquiry-footer">
          {step > 0 ? <button type="button" className="lotle-enquiry-back" disabled={saving} onClick={() => { setError(''); setStep(current => current - 1); }}><ArrowLeft size={17}/> Back</button> : <span/>}
          {step < 3
            ? <button type="button" className="lotle-enquiry-next" disabled={!canContinue} onClick={next}>Continue <ArrowRight size={17}/></button>
            : <button type="button" className="lotle-enquiry-next" disabled={!canContinue || saving || !dealerNumber} onClick={() => void openWhatsApp()}>{saving ? 'Saving enquiry…' : <>Continue to WhatsApp <MessageCircle size={17}/></>}</button>}
        </footer>
      </section>
    </div>
  );
};
