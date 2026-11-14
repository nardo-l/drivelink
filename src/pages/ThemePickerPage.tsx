import React, { useEffect, useState } from 'react';
import { ArrowLeft, Bell, Check, Eye, Loader2 } from 'lucide-react';
import { name } from '../config/brand';
import { useNavigation } from '../context/NavigationContext';
import { notificationService } from '../services/notificationService';
import { storageService } from '../services/storage';
import type { Dealership, Vehicle } from '../types';
import { TEMPLATES_LIST, TEMPLATES_REGISTRY } from '../templates/registry';
import type { TemplateDefinition, TemplateId } from '../templates/types';
import { PreviewModal } from '../templates/common/PreviewModal';
import './ThemePickerPage.css';

const availableTemplates = TEMPLATES_LIST.filter(template => template.isAvailable);

function getSelectableTemplate(value?: string | null): TemplateId | null {
  if (!value) return null;
  const definition = TEMPLATES_REGISTRY[value as TemplateId];
  return definition?.isAvailable ? definition.id : null;
}

const ThemeThumbnail: React.FC<{ template: TemplateDefinition; dealerName: string }> = ({ template, dealerName }) => {
  const { theme } = template;
  return (
    <div className="dl-theme-thumb" style={{ backgroundColor: theme.primaryBg, color: theme.textPrimary }} aria-hidden="true">
      <div className="dl-theme-thumb-header" style={{ backgroundColor: theme.cardBg }}>
        <span>{dealerName}</span>
        <i style={{ backgroundColor: theme.defaultAccent }} />
      </div>
      <div className="dl-theme-thumb-hero" style={{ backgroundColor: theme.cardBg }}>
        <small style={{ color: theme.textMuted }}>YOUR SHOWROOM</small>
        <strong style={{ color: theme.textPrimary }}>Find your next car</strong>
        <i style={{ backgroundColor: theme.defaultAccent }} />
      </div>
      <div className="dl-theme-thumb-dots">
        <i style={{ backgroundColor: theme.defaultAccent }} />
        <i style={{ backgroundColor: theme.textMuted }} />
        <i style={{ backgroundColor: theme.textMuted }} />
      </div>
      <div className="dl-theme-thumb-inventory">
        <strong style={{ color: theme.textPrimary }}>Our Vehicles</strong>
        <div>
          <i style={{ backgroundColor: theme.cardBg, borderColor: theme.textMuted }} />
          <i style={{ backgroundColor: theme.cardBg, borderColor: theme.textMuted }} />
          <i style={{ backgroundColor: theme.cardBg, borderColor: theme.textMuted }} />
        </div>
      </div>
    </div>
  );
};

export const ThemePickerPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [dealer, setDealer] = useState<Dealership | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [savedTemplate, setSavedTemplate] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateDefinition | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const currentDealer = await storageService.getDealershipAsync();
        const [currentVehicles, unread] = await Promise.all([
          storageService.getVehiclesAsync().catch(error => {
            console.warn('Could not load vehicles for theme preview:', error);
            return [];
          }),
          notificationService.unreadCount(currentDealer.id).catch(() => 0),
        ]);
        if (!active) return;
        setDealer(currentDealer);
        setVehicles(currentVehicles);
        setSavedTemplate(currentDealer.template || null);
        setSelectedTemplate(getSelectableTemplate(currentDealer.template));
        setUnreadNotifications(unread);
      } catch (error) {
        console.error('Could not load showroom theme settings:', error);
        if (active) setLoadError('We could not load your showroom. Please go back and try again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const savedSelection = getSelectableTemplate(savedTemplate);
  const hasChanges = selectedTemplate !== savedSelection;

  const selectTheme = (templateId: TemplateId) => {
    setSelectedTemplate(templateId);
    setSaveError('');
    setSuccessMessage('');
  };

  const handleRadioKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, templateId: TemplateId) => {
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    const currentIndex = availableTemplates.findIndex(template => template.id === templateId);
    const nextIndex = (currentIndex + direction + availableTemplates.length) % availableTemplates.length;
    const nextTemplate = availableTemplates[nextIndex];
    selectTheme(nextTemplate.id);
    document.getElementById('dl-theme-radio-' + nextTemplate.id)?.focus();
  };

  const applyTheme = async () => {
    if (!dealer || !selectedTemplate || !hasChanges || saving) return;
    setSaving(true);
    setSaveError('');
    setSuccessMessage('');
    try {
      const updated = await storageService.updateDealershipAsync({ template: selectedTemplate });
      setDealer(updated);
      setSavedTemplate(updated.template || null);
      setSelectedTemplate(getSelectableTemplate(updated.template));
      setSuccessMessage('Theme updated.');
      window.setTimeout(() => setSuccessMessage(''), 2400);
    } catch (error) {
      console.error('Could not save showroom theme:', error);
      setSelectedTemplate(getSelectableTemplate(savedTemplate));
      setSaveError('Could not save your theme. Your previous theme is unchanged. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="dl-theme-page">
      <div className="dl-theme-loading" role="status"><Loader2 size={20} className="dl-theme-spin" /> Loading your showroom…</div>
    </main>;
  }

  if (loadError || !dealer) {
    return <main className="dl-theme-page">
      <header className="dl-theme-topbar">
        <button type="button" className="dl-theme-icon-button" onClick={() => navigate('/app/settings')} aria-label="Back to Settings"><ArrowLeft size={19} /></button>
        <span className="dl-theme-wordmark">{name}</span>
        <span className="dl-theme-topbar-spacer" />
      </header>
      <p className="dl-theme-load-error" role="alert">{loadError || 'Your showroom could not be loaded.'}</p>
    </main>;
  }

  return (
    <main className="dl-theme-page">
      <header className="dl-theme-topbar">
        <button type="button" className="dl-theme-icon-button" onClick={() => navigate('/app/settings')} aria-label="Back to Settings"><ArrowLeft size={19} /></button>
        <span className="dl-theme-wordmark">{name}</span>
        <button type="button" className="dl-theme-icon-button dl-theme-notifications" onClick={() => navigate('/app/notifications')} aria-label={unreadNotifications > 0 ? 'Notifications, ' + unreadNotifications + ' unread' : 'Notifications'}>
          <Bell size={19} />
          {unreadNotifications > 0 && <i aria-hidden="true">{unreadNotifications > 99 ? '99+' : unreadNotifications}</i>}
        </button>
      </header>

      <section className="dl-theme-content" aria-labelledby="dl-theme-title">
        <div className="dl-theme-intro">
          <span className="dl-theme-chip">Appearance</span>
          <h1 id="dl-theme-title">Choose Your Theme</h1>
          <p>Pick a theme for your dealership showroom.</p>
        </div>

        <div className="dl-theme-grid" role="radiogroup" aria-label="Showroom themes">
          {TEMPLATES_LIST.map(template => {
            const isSelected = selectedTemplate === template.id;
            const isAvailable = template.isAvailable;
            const firstAvailable = availableTemplates[0]?.id;
            return (
              <article key={template.id} className={'dl-theme-card' + (isSelected ? ' is-selected' : '') + (!isAvailable ? ' is-coming-soon' : '')}>
                <button
                  id={'dl-theme-radio-' + template.id}
                  type="button"
                  className="dl-theme-card-choice"
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={!isAvailable}
                  aria-label={template.name + ' — ' + template.tagline + (isAvailable ? '' : ', coming soon')}
                  disabled={!isAvailable || saving}
                  tabIndex={isAvailable && (isSelected || (!selectedTemplate && template.id === firstAvailable)) ? 0 : -1}
                  onClick={() => selectTheme(template.id)}
                  onKeyDown={event => handleRadioKeyDown(event, template.id)}
                >
                  <ThemeThumbnail template={template} dealerName={dealer.name} />
                  <span className="dl-theme-card-copy">
                    <span className={'dl-theme-check' + (isSelected ? ' is-checked' : '')}>{isSelected && <Check size={14} strokeWidth={3} />}</span>
                    <span className="dl-theme-card-text"><strong>{template.name}</strong><small>{template.tagline}</small></span>
                  </span>
                </button>
                <div className="dl-theme-card-footer">
                  {isAvailable ? (
                    <button type="button" className="dl-theme-preview-button" onClick={() => setPreviewTemplate(template)} disabled={saving}>
                      <Eye size={15} /> Preview
                    </button>
                  ) : <span className="dl-theme-coming-soon-label">Coming soon</span>}
                </div>
              </article>
            );
          })}
        </div>

        {saveError && <p className="dl-theme-feedback is-error" role="alert">{saveError}</p>}
        {successMessage && <p className="dl-theme-feedback is-success" role="status">{successMessage}</p>}
      </section>

      {hasChanges && selectedTemplate && (
        <div className="dl-theme-apply-dock">
          <button type="button" onClick={() => void applyTheme()} disabled={saving} className="dl-theme-apply-button">
            {saving ? <><Loader2 size={17} className="dl-theme-spin" /> Saving…</> : 'Apply theme'}
          </button>
        </div>
      )}

      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          dealer={{ ...dealer, template: previewTemplate.id }}
          vehicles={vehicles}
          onApply={() => undefined}
          onClose={() => setPreviewTemplate(null)}
          readOnly
        />
      )}
    </main>
  );
};

export default ThemePickerPage;
