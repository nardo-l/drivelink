import React, { useEffect, useRef, useState } from 'react';
import { Check, Eye, Lock, Sparkles, X } from 'lucide-react';
import { TEMPLATES_LIST } from '../../templates/registry';
import type { TemplateDefinition } from '../../templates/types';
import { PreviewModal } from '../../templates/common/PreviewModal';
import type { Dealership, StorefrontTemplate, Vehicle } from '../../types';
import './TemplatePickerSheet.css';

interface TemplatePickerSheetProps {
  dealer: Dealership;
  vehicles: Vehicle[];
  currentTemplate?: StorefrontTemplate | string;
  onSelect: (templateId: StorefrontTemplate) => Promise<void>;
  onClose: () => void;
}

export const TemplatePickerSheet: React.FC<TemplatePickerSheetProps> = ({
  dealer,
  vehicles,
  currentTemplate = 'signature',
  onSelect,
  onClose,
}) => {
  const [previewTemplate, setPreviewTemplate] = useState<TemplateDefinition | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const sheetRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    sheetRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !savingId && !previewTemplate) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus.current?.focus(); };
  }, [onClose, savingId, previewTemplate]);

  const handleSelect = async (templateId: string): Promise<boolean> => {
    setSavingId(templateId); setSaveError('');
    try { await onSelect(templateId as StorefrontTemplate); onClose(); return true; }
    catch (error) { console.error('Could not save showroom template:', error); setSaveError('Could not save this template. Your current template has not changed. Please try again.'); return false; }
    finally { setSavingId(null); }
  };

  return (
    <>
      <div
        className="dl-tp-scrim"
        role="presentation"
        onMouseDown={e => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <section
          className="dl-tp-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dl-tp-title"
          ref={sheetRef}
        >
          <div className="dl-tp-handle" />

          <header className="dl-tp-header">
            <div>
              <h2 id="dl-tp-title">Showroom Templates</h2>
              <p>Choose an authentic style for your public showroom</p>
            </div>
            <button
              type="button"
              className="dl-tp-close"
              onClick={onClose}
              aria-label="Close template picker"
            >
              <X size={18} />
            </button>
          </header>

          <div className="dl-tp-content">
            {saveError && <p className="dl-tp-error" role="alert">{saveError}</p>}
            {TEMPLATES_LIST.map(template => {
              const isActive =
                currentTemplate === template.id ||
                (!currentTemplate && template.id === 'prestige');
              const isAvailable = template.isAvailable;
              const isSaving = savingId === template.id;

              return (
                <div
                  key={template.id}
                  className={`dl-tp-card ${isActive ? 'is-active' : ''} ${
                    !isAvailable ? 'is-disabled' : ''
                  }`}
                >
                  {/* Visual Preview Header */}
                  <div
                    className="dl-tp-card-preview"
                    style={{
                      backgroundColor: template.theme.primaryBg,
                      color: template.theme.textPrimary,
                    }}
                  >
                    <span className="dl-tp-preview-badge">{template.badge}</span>
                    <div className="flex items-center gap-1.5 text-xs font-bold opacity-80">
                      <Sparkles size={14} style={{ color: template.theme.defaultAccent }} />
                      <span>{template.tagline}</span>
                    </div>
                  </div>

                  {/* Body & Actions */}
                  <div className="dl-tp-card-body">
                    <div className="dl-tp-card-title">
                      <h3>{template.name}</h3>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <Check size={12} /> Active
                        </span>
                      )}
                    </div>

                    <p className="dl-tp-card-desc">{template.description}</p>

                    <div className="dl-tp-card-actions">
                      {isAvailable ? (
                        <>
                          <button
                            type="button"
                            className="dl-tp-preview-btn"
                            onClick={() => setPreviewTemplate(template)}
                          >
                            <Eye size={15} /> Preview
                          </button>

                          {isActive ? (
                            <button
                              type="button"
                              className="dl-tp-select-btn is-active-btn"
                              disabled
                            >
                              <Check size={15} /> Current
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="dl-tp-select-btn"
                              disabled={Boolean(savingId)}
                              onClick={() => void handleSelect(template.id)}
                            >
                              {isSaving ? 'Applying…' : 'Select'}
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="w-full flex items-center justify-between py-1">
                          <span className="flex items-center gap-1 text-xs text-slate-500 font-semibold">
                            <Lock size={13} /> Available in upcoming batch
                          </span>
                          <span className="dl-tp-soon-badge">Coming soon</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Real In-Memory Preview Modal */}
      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          dealer={{ ...dealer, template: previewTemplate.id }}
          vehicles={vehicles}
          onApply={() => { void handleSelect(previewTemplate.id).then(saved => { if (saved) setPreviewTemplate(null); }); }}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </>
  );
};
