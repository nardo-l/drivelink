import React, { useState } from 'react';
import { X, Copy, Check, MessageCircle, QrCode, ExternalLink } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { notificationService } from '../../services/notificationService';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
  description?: string;
  dealershipId?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  title,
  url,
  description = 'Check out this showroom on DriveLink!',
  dealershipId,
}) => {
  const { showToast, navigate } = useNavigation();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(url);
    if (dealershipId) void notificationService.trackShareStarted(dealershipId, 'copy').catch((error) => console.warn('Share activity could not be recorded:', error));
    setCopied(true);
    showToast('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareText = encodeURIComponent(`${title}\n${description}\n${url}`);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${shareText}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl border border-slate-100 flex flex-col gap-4 text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Share Showroom</h3>
              <p className="text-xs text-slate-500">Spread your inventory link</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Link Box */}
        <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
          <input
            type="text"
            readOnly
            value={url}
            className="flex-1 bg-transparent text-xs font-mono text-slate-700 outline-none select-all"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {/* WhatsApp Direct */}
          <a
            href={whatsappUrl}
            onClick={() => { if (dealershipId) void notificationService.trackShareStarted(dealershipId, 'whatsapp').catch((error) => console.warn('Share activity could not be recorded:', error)); }}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-xs transition-colors shadow-xs"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>WhatsApp</span>
          </a>

          {/* Open Public View */}
          <button
            onClick={() => {
              onClose();
              if (dealershipId) void notificationService.trackShareStarted(dealershipId, 'open').catch((error) => console.warn('Share activity could not be recorded:', error));
              navigate(url.replace(/^https?:\/\/[^/]+/, ''));
            }}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Link</span>
          </button>
        </div>

        {/* QR Code Graphic for window stickers */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center gap-3">
          <div className="w-14 h-14 bg-white p-1 rounded-lg border border-slate-200 shrink-0 flex items-center justify-center">
            {/* Clean SVG QR code representation */}
            <svg viewBox="0 0 40 40" className="w-full h-full text-slate-900" fill="currentColor">
              <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
              <rect x="5" y="5" width="6" height="6" />
              <rect x="26" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
              <rect x="29" y="5" width="6" height="6" />
              <rect x="2" y="26" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
              <rect x="5" y="29" width="6" height="6" />
              <rect x="18" y="4" width="4" height="4" />
              <rect x="18" y="12" width="4" height="8" />
              <rect x="26" y="26" width="4" height="4" />
              <rect x="32" y="32" width="6" height="6" />
              <rect x="22" y="32" width="4" height="6" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-900">Showroom QR Code</p>
            <p className="text-[11px] text-slate-500 leading-tight">
              Print for your showroom window or car windshields in Harare / Sandton.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
