import React, { useState, useMemo } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { Enquiry, EnquiryStage } from '../types';
import { BottomNav } from '../components/layout/BottomNav';
import {
  MessageSquare,
  Search,
  Phone,
  MessageCircle,
  Clock,
  Car,
  ChevronRight,
  Edit2,
  CheckCircle,
  X,
} from 'lucide-react';

export const EnquiriesPage: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [enquiries, setEnquiries] = useState<Enquiry[]>(() => storageService.getEnquiries());
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [activeEnquiry, setActiveEnquiry] = useState<Enquiry | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [stageDraft, setStageDraft] = useState<EnquiryStage>('new');

  const refreshEnquiries = async () => {
    const list = await storageService.getEnquiriesAsync();
    setEnquiries(list);
  };

  React.useEffect(() => {
    if (storageService.isSupabaseMode()) {
      storageService.getEnquiriesAsync().then(setEnquiries).catch(() => {});
    }
  }, []);

  const handleOpenEdit = (enquiry: Enquiry) => {
    setActiveEnquiry(enquiry);
    setNotesDraft(enquiry.notes || '');
    setStageDraft(enquiry.stage);
  };

  const handleSaveEnquiry = async () => {
    if (activeEnquiry) {
      await storageService.updateEnquiryStageAsync(activeEnquiry.id, stageDraft, notesDraft);
      refreshEnquiries();
      showToast('Enquiry updated');
      setActiveEnquiry(null);
    }
  };

  const filtered = useMemo(() => {
    return enquiries.filter((e) => {
      if (stageFilter !== 'all' && e.stage !== stageFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const text = `${e.buyerName} ${e.buyerPhone} ${e.message}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [enquiries, stageFilter, search]);

  const stageBadgeClasses = {
    new: 'bg-blue-50 text-blue-700 border-blue-200',
    contacted: 'bg-purple-50 text-purple-700 border-purple-200',
    negotiating: 'bg-amber-50 text-amber-700 border-amber-200',
    sold: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    lost: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  return (
    <div className="relative min-h-full flex flex-col justify-between bg-[#F8F9FA] text-slate-900">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h1 className="text-base font-extrabold text-slate-950 tracking-tight">
            Buyer Enquiries
          </h1>
          <p className="text-[11px] text-slate-500 font-medium">
            {enquiries.length} total leads received
          </p>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 px-5 py-3 overflow-y-auto pb-24">
        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by buyer name, phone..."
            className="w-full h-10 pl-9 pr-3 text-xs rounded-xl bg-white border border-slate-200 focus:border-slate-900 focus:outline-none transition-all placeholder:text-slate-400 shadow-2xs"
          />
        </div>

        {/* Stage Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2.5 no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'new', label: 'New' },
            { id: 'contacted', label: 'Contacted' },
            { id: 'negotiating', label: 'Negotiating' },
            { id: 'sold', label: 'Sold' },
            { id: 'lost', label: 'Lost' },
          ].map((tab) => {
            const isActive = stageFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStageFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Enquiries List */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">No enquiries found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              When buyers contact you via WhatsApp or submit a form, leads appear here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((enq) => {
              const vehicle = enq.vehicleId ? storageService.getVehicleById(enq.vehicleId) : undefined;
              const cleanNumber = enq.buyerPhone.replace(/\D/g, '');
              const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(
                `Hi ${enq.buyerName}, thanks for inquiring at Prime Motors regarding ${
                  vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'our showroom'
                }.`
              )}`;

              return (
                <div
                  key={enq.id}
                  className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs flex flex-col gap-2.5 hover:border-slate-300 transition-all"
                >
                  {/* Top Line: Buyer Name & Status Badge */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-xs text-slate-900">{enq.buyerName}</h3>
                      <p className="text-[11px] text-slate-500 font-mono">{enq.buyerPhone}</p>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                        stageBadgeClasses[enq.stage]
                      }`}
                    >
                      {enq.stage}
                    </span>
                  </div>

                  {/* Associated Vehicle Banner */}
                  {vehicle && (
                    <div
                      onClick={() => navigate(`/app/vehicles/${vehicle.id}`)}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center gap-2.5 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <img
                        src={vehicle.photos[0]}
                        alt={vehicle.model}
                        className="w-10 h-8 rounded-lg object-cover bg-slate-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs text-slate-900 truncate">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </p>
                        <p className="text-[11px] font-bold text-slate-700">
                          ${vehicle.price.toLocaleString()}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  )}

                  {/* Message Body */}
                  <p className="text-xs text-slate-700 leading-relaxed italic bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                    &ldquo;{enq.message}&rdquo;
                  </p>

                  {/* Notes & Actions Bar */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenEdit(enq)}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{enq.notes ? 'Edit notes' : '+ Add note / stage'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {/* WhatsApp Button */}
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1 px-2.5 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-white" />
                        <span>Chat</span>
                      </a>

                      {/* Call Button */}
                      <a
                        href={`tel:${enq.buyerPhone}`}
                        className="py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Stage / Notes Modal */}
      {activeEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Manage Lead: {activeEnquiry.buyerName}</h3>
              <button
                onClick={() => setActiveEnquiry(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deal Stage
              </label>
              <select
                value={stageDraft}
                onChange={(e) => setStageDraft(e.target.value as EnquiryStage)}
                className="w-full h-10 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white"
              >
                <option value="new">New Lead</option>
                <option value="contacted">Contacted</option>
                <option value="negotiating">Negotiating / Viewing</option>
                <option value="sold">Sold / Deal Closed</option>
                <option value="lost">Lost / Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Internal Dealer Notes
              </label>
              <textarea
                rows={3}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="e.g. Test drive scheduled Friday, cash USD payment agreed..."
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setActiveEnquiry(null)}
                className="py-2 rounded-xl bg-slate-100 font-semibold text-xs text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEnquiry}
                className="py-2 rounded-xl bg-slate-950 font-semibold text-xs text-white"
              >
                Save Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation */}
      <BottomNav />
    </div>
  );
};
