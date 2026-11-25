import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, MessageCircle, X } from 'lucide-react';
import { name } from '../../config/brand';
import { notificationService } from '../../services/notificationService';
import { buildWhatsAppShareUrl } from '../../utils/phoneUtils';
import './ShareSheet.css';

export interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
  description?: string;
  dealershipId?: string;
  preview?: boolean;
}

const bioHints: Record<string, string> = {
  Instagram: 'Edit profile, then Links.',
  TikTok: 'Edit profile, then Website (or Bio).',
  Facebook: 'Page About section, then Links.',
  'WhatsApp Business': 'Business profile, then Website.',
};

export const ShareSheet: React.FC<ShareSheetProps> = ({
  isOpen, onClose, title, url, description, dealershipId, preview = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('');
  const [hint, setHint] = useState('');
  const [nativeShareAvailable, setNativeShareAvailable] = useState(
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
  );
  const sheetRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab' || !sheetRef.current) return;
      const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen]);

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  }, []);

  const track = (action: 'copy' | 'whatsapp') => {
    if (dealershipId) void notificationService.trackShareStarted(dealershipId, action)
      .catch(error => console.warn('Share activity could not be recorded:', error));
  };

  const copyPlainLink = async (bioPlatform?: string) => {
    if (preview || !url) return;
    const plainUrl = url.trim();
    const fallbackCopy = () => {
      const textarea = document.createElement('textarea');
      textarea.value = plainUrl;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const successful = document.execCommand('copy');
      textarea.remove();
      if (!successful) throw new Error('Clipboard copy was not available');
    };
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(plainUrl); } catch { fallbackCopy(); }
      } else fallbackCopy();
      track('copy');
      setCopied(true);
      setStatus('Copied. Paste it in your bio.');
      if (bioPlatform) setHint(bioHints[bioPlatform]);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => { setCopied(false); setStatus(''); }, 3000);
    } catch {
      setStatus('Could not copy automatically. Please select the link and copy it.');
    }
  };

  const shareMessage = [
    description?.trim() || `${name}, Your online car showroom is ready to explore.`,
    title.trim(),
    url.trim(),
  ].filter(Boolean).join('\n');
  const whatsappUrl = buildWhatsAppShareUrl(shareMessage);

  const openNativeShare = async () => {
    if (preview || typeof navigator === 'undefined' || typeof navigator.share !== 'function') return;
    try {
      await navigator.share({ title, text: description?.trim() || `${name}, Your online car showroom is ready to explore.`, url: url.trim() });
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') setStatus('Could not open share options.');
    }
  };

  if (!isOpen) return null;
  return (
    <div className="lotle-share-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={sheetRef} className="lotle-share-sheet" role="dialog" aria-modal="true" aria-labelledby="lotle-share-title" aria-describedby="lotle-share-description">
        <div className="lotle-share-handle" aria-hidden="true"><span /></div>
        <header className="lotle-share-header">
          <div className="lotle-share-heading">
            <h2 id="lotle-share-title">Share your showroom</h2>
            <p id="lotle-share-description">Copy the link and add it to your social bio.</p>
          </div>
          <button ref={closeRef} type="button" className="lotle-share-close" onClick={onClose} aria-label="Close share sheet"><X size={20}/></button>
        </header>
        <div className="lotle-share-link-box"><p className="lotle-share-url" title={url}>{url}</p></div>
        <button type="button" className="lotle-share-copy" onClick={() => void copyPlainLink()} disabled={preview || !url}>
          {copied ? <Check size={18}/> : <Copy size={18}/>}<span>{copied ? 'Copied' : 'Copy link'}</span>
        </button>
        {status && <p className="lotle-share-status" role="status">{status}</p>}
        <section className="lotle-share-bio" aria-labelledby="lotle-share-bio-title">
          <h3 id="lotle-share-bio-title">Put it in your bio</h3>
          <div className="lotle-share-chips">
            {Object.keys(bioHints).map(platform => <button key={platform} type="button" className="lotle-share-chip" onClick={() => void copyPlainLink(platform)} disabled={preview || !url}>{platform}</button>)}
          </div>
          {hint && <p className="lotle-share-hint">{hint}</p>}
        </section>
        <section className="lotle-share-message" aria-labelledby="lotle-share-message-title">
          <h3 id="lotle-share-message-title">Share a message</h3>
          <div className="lotle-share-message-actions">
            <a className="lotle-share-whatsapp" href={preview ? undefined : whatsappUrl} onClick={event => { if (preview) { event.preventDefault(); return; } track('whatsapp'); }} target="_blank" rel="noopener noreferrer" aria-disabled={preview}>
              <MessageCircle size={17}/><span>Send on WhatsApp</span>
            </a>
            {nativeShareAvailable && <button type="button" className="lotle-share-more" onClick={() => void openNativeShare()} disabled={preview}>More options</button>}
          </div>
        </section>
      </section>
    </div>
  );
};
