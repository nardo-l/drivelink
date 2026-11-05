import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import './Select.css';

export type SelectOption = {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
};

export type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  title?: string;
  compact?: boolean;
  name?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
};

const isOther = (option: SelectOption) => option.value.toLowerCase() === 'other' || option.label.toLowerCase() === 'other';

export const Select: React.FC<SelectProps> = ({
  value, onChange, options, placeholder = 'Select an option', label, error, disabled = false,
  searchable = false, title, compact = false, name, id, className = '', 'aria-label': ariaLabel,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef<number | null>(null);\n  const historyEntry = useRef(false);
  const typeahead = useRef('');
  const typeaheadTimer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [above, setAbove] = useState(false);\n  const [anchor, setAnchor] = useState({ top: 0, left: 0, width: 240 });
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  const listId = React.useId();
  const selected = options.find(option => option.value === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visible = normalized ? options.filter(option => option.label.toLowerCase().includes(normalized) || option.value.toLowerCase().includes(normalized)) : options;
    return visible.filter(option => !isOther(option));
  }, [options, query]);
  const otherOption = options.find(isOther);
  const customAllowed = searchable && Boolean(otherOption);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    setQuery('');
    setCustomMode(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  const updatePosition = useCallback(() => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const flip = window.innerHeight - rect.bottom < 340 && rect.top > 340;\n    setAbove(flip);\n    setAnchor({ top: flip ? Math.max(8, rect.top - 328) : rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width: rect.width });
  }, []);

  const openMenu = () => {
    if (disabled) return;
    if (window.matchMedia('(max-width: 767px)').matches) setMobile(true);
    else { setMobile(false); updatePosition(); }
    setOpen(true);
  };

  const choose = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    close();
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    if (mobile) document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const enabled = Array.from(document.getElementById(listId)?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])') || []);
        if (!enabled.length) return;
        event.preventDefault();
        const current = enabled.indexOf(document.activeElement as HTMLElement);
        const selectedIndex = enabled.findIndex(option => option.getAttribute('aria-selected') === 'true');
        const start = current >= 0 ? current : selectedIndex;
        const nextIndex = event.key === 'ArrowDown'
          ? (start + 1 + enabled.length) % enabled.length
          : (start - 1 + enabled.length) % enabled.length;
        enabled[nextIndex].focus();
      }
      if (event.key === 'Enter') {
        const target = event.target as HTMLElement;
        if (customMode && target instanceof HTMLInputElement) {
          const nextValue = customValue.trim();
          if (nextValue) { onChange(nextValue); close(); }
          event.preventDefault();
        } else if (target.getAttribute('role') === 'option') {
          event.preventDefault();
          (target as HTMLButtonElement).click();
        } else if (searchable && filtered.length === 1) {
          event.preventDefault();
          choose(filtered[0]);
        }
      }
      if (!mobile && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        typeahead.current += event.key.toLowerCase();
        const match = options.find(option => !option.disabled && option.label.toLowerCase().startsWith(typeahead.current));
        if (match) {
          const option = Array.from(document.getElementById(listId)?.querySelectorAll<HTMLElement>('[role="option"]') || []).find(node => node.textContent?.includes(match.label));
          option?.focus();
        }
        window.clearTimeout(typeaheadTimer.current);
        typeaheadTimer.current = window.setTimeout(() => { typeahead.current = ''; }, 650);
      }
    };
    const onPopState = () => { historyEntry.current = false; close(false); };
    if (mobile) {
      window.history.pushState({ drivelinkSelect: true }, '');
      window.addEventListener('popstate', onPopState);
    }
    window.addEventListener('keydown', onKeyDown);
    if (searchable) window.setTimeout(() => searchRef.current?.focus(), 80);
    else if (!mobile) window.setTimeout(() => rootRef.current?.querySelector<HTMLElement>('[role="option"]')?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;\n      if (historyEntry.current) { historyEntry.current = false; window.history.back(); }
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('popstate', onPopState);
      window.clearTimeout(typeaheadTimer.current);
    };
  }, [open, mobile, searchable, filtered, options, value, onChange, close, customMode, customValue, listId]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const change = (event: MediaQueryListEvent) => setMobile(event.matches);
    media.addEventListener?.('change', change);
    return () => media.removeEventListener?.('change', change);
  }, []);

  useEffect(() => {
    if (open && !mobile) {
      const reposition = () => updatePosition();
      window.addEventListener('resize', reposition, { passive: true });
      window.addEventListener('scroll', reposition, { passive: true, capture: true });
      return () => {
        window.removeEventListener('resize', reposition);
        window.removeEventListener('scroll', reposition, true);
      };
    }
  }, [open, mobile, updatePosition]);

  const commitCustom = () => {
    const next = customValue.trim();
    if (!next) return;
    onChange(next);
    close();
  };

  const panel = open ? createPortal(
    <div className={`dls-layer ${mobile ? 'is-mobile' : 'is-desktop'}`} onMouseDown={event => {
      if (event.target === event.currentTarget) close();
    }}>
      {mobile && <button type="button" className="dls-overlay" aria-label="Close options" onClick={() => close()} />}
      <section
        className={`dls-panel ${mobile ? 'dls-sheet' : 'dls-popover'} ${above && !mobile ? 'is-above' : ''}`}
        role="dialog"
        aria-modal={mobile ? true : undefined}
        aria-label={title || label || placeholder}
        onTouchStart={event => { touchStartY.current = event.touches[0]?.clientY ?? null; }}
        onTouchEnd={event => {
          if (mobile && touchStartY.current !== null && event.changedTouches[0].clientY - touchStartY.current > 70) close();
          touchStartY.current = null;
        }}
      >
        {mobile && <div className="dls-sheet-heading">
          <span className="dls-handle" />
          <strong>{title || label || 'Choose an option'}</strong>
          <button type="button" className="dls-close" onClick={() => close()} aria-label="Close"><X size={19}/></button>
        </div>}
        {searchable && <div className="dls-search-wrap">
          <Search size={17} aria-hidden="true"/>
          <input ref={searchRef} value={customMode ? customValue : query} onChange={event => customMode ? setCustomValue(event.target.value) : setQuery(event.target.value)} placeholder={customMode ? 'Enter custom value' : 'Search options'} aria-label={customMode ? 'Custom value' : 'Search options'}/>
          {customMode && <button type="button" onClick={() => setCustomMode(false)} aria-label="Back to options"><X size={16}/></button>}
        </div>}
        <div className="dls-options" role="listbox" id={listId} aria-label={title || label || 'Options'}>
          {!customMode && filtered.map(option => (
            <button
              type="button"
              role="option"
              aria-selected={value === option.value}
              aria-disabled={option.disabled || undefined}
              disabled={option.disabled}
              tabIndex={0}
              className={`dls-option ${value === option.value ? 'is-selected' : ''}`}
              key={option.value}
              onClick={() => choose(option)}
            >
              {option.icon && <span className="dls-option-icon">{option.icon}</span>}
              <span className="dls-option-copy"><span>{option.label}</span>{option.description && <small>{option.description}</small>}</span>
              {value === option.value && <Check size={18} strokeWidth={2.2}/>}
            </button>
          ))}
          {customAllowed && !customMode && (!query || otherOption?.label.toLowerCase().includes(query.toLowerCase()) || 'other'.includes(query.toLowerCase())) && (
            <button type="button" className="dls-option dls-other" role="option" aria-selected={false} onClick={() => { setCustomMode(true); setCustomValue(''); window.setTimeout(() => searchRef.current?.focus(), 50); }}>
              <span className="dls-option-copy"><span>Other</span><small>Enter a custom value</small></span>
            </button>
          )}
        </div>
        {customMode && <div className="dls-custom-actions"><button type="button" disabled={!customValue.trim()} onClick={commitCustom}>Use this value</button></div>}
      </section>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={rootRef} className={`dls-root ${compact ? 'is-compact' : ''} ${className}`}>
      {label && <label className="dls-label" htmlFor={id}>{label}</label>}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel || label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        className={`dls-trigger ${open ? 'is-open' : ''} ${error ? 'has-error' : ''}`}
        onClick={() => open ? close(false) : openMenu()}
      >
        <span className={selected || value ? 'dls-value' : 'dls-placeholder'}>{selected?.label || value || placeholder}</span>
        <ChevronDown size={18} className={`dls-chevron ${open ? 'is-rotated' : ''}`} aria-hidden="true"/>
      </button>
      {error && <span className="dls-error" role="alert">{error}</span>}
      {name && <select className="dls-native" name={name} value={value} onChange={event => onChange(event.target.value)} tabIndex={-1} aria-hidden="true">
        {!value && <option value="">{placeholder}</option>}
        {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
        {value && !options.some(option => option.value === value) && <option value={value}>{value}</option>}
      </select>}
      {panel}
    </div>
  );
};

export default Select;
