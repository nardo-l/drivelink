import React, { Suspense, useEffect, useRef } from 'react';
import { Check, Eye, X } from 'lucide-react';
import type { Dealership, Vehicle } from '../../types';
import type { TemplateDefinition } from '../types';
import { TemplateSkeleton } from './TemplateSkeleton';

interface PreviewModalProps {
  template: TemplateDefinition;
  dealer: Dealership;
  vehicles: Vehicle[];
  onApply: () => void;
  onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  template,
  dealer,
  vehicles,
  onApply,
  onClose,
}) => {
  const Component = template.Component;
  const isDark = template.theme.isDark;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus.current?.focus(); };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[150] flex flex-col bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
      ref={dialogRef}
    >
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0A0F1E] border-b border-white/10 text-white z-20 shrink-0">
        <div className="flex items-center gap-2">
          <Eye size={18} className="text-[#A78BFA]" />
          <div>
            <h2 id="preview-title" className="text-xs font-extrabold tracking-wide">
              Previewing {template.name}
            </h2>
            <p className="text-[10px] text-gray-400">
              Showing your real dealership stock · No changes saved yet
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onApply}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition shadow-sm"
          >
            <Check size={14} />
            Use Template
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 transition"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Preview Viewport */}
      <div className="flex-1 overflow-y-auto">
        <Suspense fallback={<TemplateSkeleton isDark={isDark} />}>
          <Component
            dealer={dealer}
            vehicles={vehicles}
            showPoweredBy={true}
            onVehicleClick={() => {}}
            onContactClick={() => {}}
            onWhatsAppClick={() => {}}
            onShare={() => {}}
            isPreview
          />
        </Suspense>
      </div>
    </div>
  );
};
