import React, { useState } from 'react';
import { X, Send, MessageCircle, Phone, CheckCircle2 } from 'lucide-react';
import { storageService } from '../../services/storage';
import { Vehicle } from '../../types';
import { useNavigation } from '../../context/NavigationContext';

interface EnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle?: Vehicle;
}

export const EnquiryModal: React.FC<EnquiryModalProps> = ({ isOpen, onClose, vehicle }) => {
  const { showToast } = useNavigation();
  const dealership = storageService.getDealership();

  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [message, setMessage] = useState(
    vehicle
      ? `Hi ${dealership.name}, I am interested in the ${vehicle.year} ${vehicle.make} ${vehicle.model} listed at $${vehicle.price.toLocaleString()}. Is it still available for inspection?`
      : `Hi ${dealership.name}, I would like to inquire about vehicle availability in your showroom.`
  );
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim() || !buyerPhone.trim()) {
      showToast('Please provide your name and phone/WhatsApp number.');
      return;
    }

    storageService.createEnquiryAsync({
      dealershipId: dealership.id,
      vehicleId: vehicle ? vehicle.id : null,
      buyerName: buyerName.trim(),
      buyerPhone: buyerPhone.trim(),
      buyerEmail: buyerEmail.trim() || undefined,
      message,
      stage: 'new',
      source: 'form',
      notes: `Direct web form inquiry for ${vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'general showroom'}.`,
    });

    setSubmitted(true);
    showToast('Enquiry submitted! The dealer will follow up with you.');
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 2000);
  };

  const handleDirectWhatsApp = () => {
    const encoded = encodeURIComponent(message);
    const cleanNumber = dealership.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanNumber}?text=${encoded}`, '_blank');
    // Record lead in background with source 'whatsapp'
    storageService.createEnquiryAsync({
      dealershipId: dealership.id,
      vehicleId: vehicle ? vehicle.id : null,
      buyerName: buyerName.trim() || 'WhatsApp Buyer',
      buyerPhone: buyerPhone.trim() || 'WhatsApp Link Click',
      buyerEmail: buyerEmail.trim() || undefined,
      message,
      stage: 'new',
      source: 'whatsapp',
      notes: 'Buyer clicked WhatsApp contact link from storefront.',
    });
    showToast('Opening WhatsApp with dealer contact details...');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 text-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg leading-tight">Enquire About Vehicle</h3>
            <p className="text-xs text-slate-500">Contact {dealership.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-lg text-slate-900">Enquiry Received!</h4>
            <p className="text-xs text-slate-600 max-w-xs">
              Thank you {buyerName}. The team at {dealership.name} will reach out to you shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {vehicle && (
              <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">
                <img
                  src={vehicle.photos[0]}
                  alt={`${vehicle.make} ${vehicle.model}`}
                  className="w-14 h-11 object-cover rounded-lg bg-slate-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs truncate">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </p>
                  <p className="text-xs font-bold text-slate-900">
                    ${vehicle.price.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Tendai Moyo / Sipho Ndlovu"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp or Phone Number *
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. +263 77 123 4567 or +27 82 000 0000"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Message
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-slate-900 focus:outline-none resize-none"
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleDirectWhatsApp}
                className="w-full py-2.5 px-4 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>Chat Instantly on WhatsApp</span>
              </button>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Dealer Enquiry</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
