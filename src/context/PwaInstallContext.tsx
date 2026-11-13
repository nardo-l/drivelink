import '../components/layout/PwaInstallSheet.css';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Share, Smartphone, Plus } from 'lucide-react';
import { storageService } from '../services/storage';
import { isSupabaseConfigured } from '../lib/supabase';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> };
type PwaContextValue = { canInstall:boolean; isInstalled:boolean; isIos:boolean; busy:boolean; sheet:'install'|'success'|null; openInstall:()=>void; closeInstall:()=>void; promptInstall:()=>Promise<void> };
const PwaContext = createContext<PwaContextValue | null>(null);
let deferredPrompt: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const getPwaPath = () => {
  const hash = window.location.hash;
  return hash.startsWith('#/') ? hash.slice(1).split('?')[0] : window.location.pathname;
};

export function capturePwaInstallEvents() {
  if (typeof window === 'undefined' || (window as any).__lotlePwaEventsCaptured) return;
  (window as any).__lotlePwaEventsCaptured = true;
  installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('lotle:pwa-analytics',{detail:{event:'installed'}}));
    notify();
  });
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', event => {
    if (event.matches) { installed = true; notify(); }
  });
}

export const usePwaInstall = () => {
  const value = useContext(PwaContext);
  if (!value) throw new Error('usePwaInstall must be used inside PwaInstallProvider');
  return value;
};

export const PwaInstallProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [revision,setRevision] = useState(0);
  const [sheet,setSheet] = useState<'install'|'success'|null>(null);
  const [busy,setBusy] = useState(false);
  const [manual,setManual] = useState(false);
  const [currentPath,setCurrentPath] = useState(getPwaPath);
  const session = storageService.getUserSession();
  const accountId = session.userId || session.dealershipId;
  const accountKey = accountId ? 'lotle_pwa_' + accountId : '';
  const canInstall = !!deferredPrompt;
  const isIos = (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && /safari/i.test(navigator.userAgent) && !/(crios|fxios|edgios)/i.test(navigator.userAgent) && !(window as any).MSStream;
  const isMobileDevice = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
  const isInstalled = installed || window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  const successShown = useRef(false);
  const installedSeen = useRef(isInstalled);
  const visitCounted = useRef(false);

  const closeInstall = useCallback(() => { setSheet(null); setBusy(false); setManual(false); },[]);
  const openInstall = useCallback(() => {
    if (!/^\/app(?:\/(?:analytics|vehicles|enquiries|more|settings|storefront|notifications))?\/?$/.test(currentPath)) return;
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    setManual(true);
    if (accountKey) sessionStorage.setItem(accountKey + '_shown_session','1');
    setSheet('install');
  },[accountKey,currentPath]);

  useEffect(() => {
    const update = () => setRevision(v => v + 1);
    const countEvent = (event:Event) => {
      const name = (event as CustomEvent<{event?:string}>).detail?.event;
      if (!name || !accountKey) return;
      try {
        const key = accountKey + '_analytics';
        const counts = JSON.parse(localStorage.getItem(key) || '{}');
        counts[name] = Number(counts[name] || 0) + 1;
        localStorage.setItem(key,JSON.stringify(counts));
      } catch {}
    };
    const markMoment = () => { if (accountKey) localStorage.setItem(accountKey + '_value_moment','1'); update(); };
    listeners.add(update);
    window.addEventListener('lotle:session-updated',update);
    window.addEventListener('lotle:pwa-analytics',countEvent);
    window.addEventListener('lotle:vehicle-published',markMoment);
    window.addEventListener('lotle:enquiry-arrived',markMoment);
    return () => {
      listeners.delete(update);
      window.removeEventListener('lotle:session-updated',update);
      window.removeEventListener('lotle:pwa-analytics',countEvent);
      window.removeEventListener('lotle:vehicle-published',markMoment);
      window.removeEventListener('lotle:enquiry-arrived',markMoment);
    };
  },[accountKey]);

  useEffect(() => {
    const onPath = () => setCurrentPath(getPwaPath());
    window.addEventListener('popstate',onPath);
    const originalPush = history.pushState;
    history.pushState = function(...args) { originalPush.apply(this,args); onPath(); };
    return () => { window.removeEventListener('popstate',onPath); history.pushState = originalPush; };
  },[]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt || busy) return;
    const event = deferredPrompt;
    window.dispatchEvent(new CustomEvent('lotle:pwa-analytics',{detail:{event:'install_tapped'}}));
    setBusy(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      deferredPrompt = null;
      notify();
      if (choice.outcome === 'accepted') {
        installed = true;
        successShown.current = true;
        setSheet('success');
        if (accountKey) localStorage.setItem(accountKey + '_success','1');
        window.dispatchEvent(new CustomEvent('lotle:pwa-analytics',{detail:{event:'accepted'}}));
      } else {
        if (accountKey) {
          const count = Number(localStorage.getItem(accountKey + '_dismissals') || 0) + 1;
          localStorage.setItem(accountKey + '_dismissals',String(count));
          localStorage.setItem(accountKey + '_until',String(Date.now() + 14*24*60*60*1000));
        }
        window.dispatchEvent(new CustomEvent('lotle:pwa-analytics',{detail:{event:'dismissed'}}));
        closeInstall();
      }
    } catch { closeInstall(); }
    finally { setBusy(false); }
  },[busy,accountKey,closeInstall]);

  useEffect(() => {
    if (!isInstalled) { installedSeen.current = false; return; }
    if (installedSeen.current) return;
    installedSeen.current = true;
    if (!successShown.current && (!accountKey || localStorage.getItem(accountKey + '_success') !== '1')) {
      successShown.current = true;
      setSheet('success');
      if (accountKey) localStorage.setItem(accountKey + '_success','1');
    } else if (sheet === 'install') closeInstall();
  },[isInstalled,accountKey,sheet,closeInstall]);

  useEffect(() => {
    if (manual || sheet || !accountId || !session.isLoggedIn || !session.dealershipId || !isSupabaseConfigured() || isInstalled) return;
    if (!/^\/app(?:\/(?:analytics|vehicles|enquiries|more|settings|storefront|notifications))?\/?$/.test(currentPath)) {
      visitCounted.current = false;
      return;
    }
    const shownKey = accountKey + '_shown_session';
    const visitsKey = accountKey + '_visits';
    let visits = Number(localStorage.getItem(visitsKey) || 0);
    if (!visitCounted.current) {
      visitCounted.current = true;
      visits += 1;
      localStorage.setItem(visitsKey,String(visits));
    }
    if (sessionStorage.getItem(shownKey)) return;
    let active = true;
    let checking = false;
    let retryTimer: number | undefined;
    const checkMoment = async () => {
      if (checking) return;
      checking = true;
      try {
        const [vehicles,enquiries] = await Promise.all([storageService.getVehiclesAsync(),storageService.getEnquiriesAsync()]);
        const momentKey = accountKey + '_value_moment';
        const snapshot = {
          vehicles: vehicles.filter(vehicle => vehicle.status === 'available').length,
          enquiries: enquiries.length,
        };
        const baselineKey = accountKey + '_baseline';
        const baseline = localStorage.getItem(baselineKey);
        if (!baseline) {
          localStorage.setItem(baselineKey,JSON.stringify(snapshot));
        } else {
          try {
            const previous = JSON.parse(baseline);
            if (snapshot.vehicles > previous.vehicles || snapshot.enquiries > previous.enquiries) localStorage.setItem(momentKey,'1');
            localStorage.setItem(baselineKey,JSON.stringify({
              vehicles:Math.max(snapshot.vehicles,previous.vehicles || 0),
              enquiries:Math.max(snapshot.enquiries,previous.enquiries || 0),
            }));
          } catch { localStorage.setItem(baselineKey,JSON.stringify(snapshot)); }
        }
        // Offer the install sheet as soon as a signed-in dealer lands on the dashboard.
        // Dismissal limits, the 14-day snooze and once-per-session still apply.
        const hasMoment = true;
        const dismissals = Number(localStorage.getItem(accountKey + '_dismissals') || 0);
        const until = Number(localStorage.getItem(accountKey + '_until') || 0);
        if (!active || !hasMoment || (!canInstall && !isIos && !isMobileDevice) || dismissals >= 3 || Date.now() < until) return;
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
          retryTimer = window.setTimeout(() => { void checkMoment(); },700);
          return;
        }
        if (sessionStorage.getItem(shownKey)) return;
        sessionStorage.setItem(shownKey,'1');
        window.dispatchEvent(new CustomEvent('lotle:pwa-analytics',{detail:{event:'shown'}}));
        setSheet('install');
      } catch {} finally { checking = false; }
    };
    void checkMoment();
    const poll = window.setInterval(() => { if (localStorage.getItem(accountKey + '_value_moment') !== '1') void checkMoment(); },30000);
    return () => { active = false; window.clearInterval(poll); if (retryTimer) window.clearTimeout(retryTimer); };
  },[currentPath,accountId,session.isLoggedIn,session.dealershipId,accountKey,canInstall,isIos,isMobileDevice,isInstalled,manual,sheet,revision]);

  const dismiss = useCallback(() => {
    if (accountKey) {
      const count = Number(localStorage.getItem(accountKey + '_dismissals') || 0) + 1;
      localStorage.setItem(accountKey + '_dismissals',String(count));
      localStorage.setItem(accountKey + '_until',String(Date.now() + 14*24*60*60*1000));
    }
    window.dispatchEvent(new CustomEvent('lotle:pwa-analytics',{detail:{event:'dismissed'}}));
    closeInstall();
  },[accountKey,closeInstall]);

  const value = useMemo(() => ({canInstall,isInstalled,isIos,busy,sheet,openInstall,closeInstall,promptInstall}),[canInstall,isInstalled,isIos,busy,sheet,openInstall,closeInstall,promptInstall]);
  return <PwaContext.Provider value={value}>{children}<PwaInstallSheet onDismiss={dismiss} onClose={closeInstall}/></PwaContext.Provider>;
};

const PwaInstallSheet: React.FC<{onDismiss:()=>void;onClose:()=>void}> = ({onDismiss,onClose}) => {
  const {canInstall,isInstalled,isIos,busy,sheet,promptInstall} = usePwaInstall();
  const panel = useRef<HTMLElement>(null);
  const touchY = useRef<number|null>(null);
  useEffect(() => {
    if (!sheet) return;
    const previous = document.activeElement as HTMLElement|null;
    const onKey = (event:KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
      if (event.key === 'Tab' && panel.current) {
        const nodes = Array.from(panel.current.querySelectorAll<HTMLElement>('button,a[href]')).filter(el => !el.hasAttribute('disabled'));
        if (!nodes.length) return;
        const first=nodes[0],last=nodes[nodes.length-1];
        if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown',onKey);
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    const pop = () => onDismiss();
    history.pushState({lotleInstall:true},'','#install-app');
    window.addEventListener('popstate',pop);
    return () => {
      document.removeEventListener('keydown',onKey);
      window.removeEventListener('popstate',pop);
      if (location.hash === '#install-app') history.back();
      previous?.focus?.();
    };
  },[sheet,onDismiss]);

  if (!sheet) return null;
  const success = sheet === 'success';
  const ios = isIos && !isInstalled && !canInstall && !success;
  return <div className="lotle-pwa-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onDismiss(); }}>
    <section ref={panel} className="lotle-pwa-sheet" role="dialog" aria-modal="true" aria-labelledby="lotle-pwa-title"
      onTouchStart={event => { touchY.current=event.touches[0]?.clientY ?? null; }}
      onTouchEnd={event => { if(touchY.current!==null && (event.changedTouches[0]?.clientY ?? 0)-touchY.current>70) onDismiss(); touchY.current=null; }}>
      <div className="lotle-pwa-handle"/>
      <div className={'lotle-pwa-badge'+(success?' is-success':'')}>
        <img className="lotle-pwa-app-icon" src="/icon.svg" alt="Lotlé app icon"/>
        {success && <span className="lotle-pwa-check"><Check size={15}/></span>}
      </div>
      <h2 id="lotle-pwa-title">{success?'Lotlé is installed':ios?'Add Lotlé to your Home Screen':'Install Lotlé'}</h2>
      {success ? <p>Find it on your home screen.</p> : ios ? <div className="lotle-pwa-steps">
        <div><span>1</span><Share size={17}/>Tap the Share icon</div>
        <div><span>2</span><Smartphone size={17}/>Choose “Add to Home Screen”</div>
        <div><span>3</span><Plus size={17}/>Tap “Add”</div>
      </div> : !canInstall ? <p>Open the browser menu and choose Install app or Add to Home screen.</p> : <p>Open your showroom in one tap, get enquiry alerts, and use it like a normal app.</p>}
      <button className="lotle-pwa-primary" type="button" disabled={busy} onClick={() => {
        if (success) onClose();
        else if (ios) onDismiss();
        else if (canInstall) void promptInstall();
        else onClose();
      }}>
        {busy ? <span className="lotle-pwa-spinner"/> : success?'Done':ios?'Got it':canInstall?'Install':'Got it'}
      </button>
      {!success && !ios && <button className="lotle-pwa-later" type="button" onClick={onDismiss}>Not now</button>}
    </section>
  </div>;
};
