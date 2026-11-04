import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, X, Check, Loader2, RefreshCw, ZoomIn } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import './ShowroomBrandingEditor.css';

type BrandingKind = 'logo' | 'banner';
type BrandingValue = { logoUrl: string | null; bannerUrl: string | null };
type AssetState = { url: string | null; busy: boolean; progress: number; error: string; pendingFile: File | null };

interface ShowroomBrandingEditorProps {
  dealershipName: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  onChange: (value: BrandingValue) => void;
  onUploadingChange?: (busy: boolean) => void;
  className?: string;
}

const emptyAsset = (url: string | null = null): AssetState => ({ url, busy: false, progress: 0, error: '', pendingFile: null });

export const ShowroomBrandingEditor: React.FC<ShowroomBrandingEditorProps> = ({
  dealershipName, logoUrl = null, bannerUrl = null, onChange, onUploadingChange, className = '',
}) => {
  const [logo, setLogo] = useState<AssetState>(() => emptyAsset(logoUrl));
  const [banner, setBanner] = useState<AssetState>(() => emptyAsset(bannerUrl));
  const latestUrls = useRef<BrandingValue>({ logoUrl: logoUrl || null, bannerUrl: bannerUrl || null });
  const [cropKind, setCropKind] = useState<BrandingKind | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [cropError, setCropError] = useState('');
  const [activeTasks, setActiveTasks] = useState(0);
  const cropRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; zoom: number; offset: { x: number; y: number }; midpoint: { x: number; y: number } } | null>(null);
  const fileInputRefs = { logo: useRef<HTMLInputElement>(null), banner: useRef<HTMLInputElement>(null) };
  const initials = useMemo(() => dealershipName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'DL', [dealershipName]);
  const cropWidth = cropRef.current?.clientWidth || (cropKind === 'banner' ? Math.min(560, window.innerWidth - 36) : Math.min(430, window.innerWidth - 36, window.innerHeight * 0.54));
  const cropHeight = cropRef.current?.clientHeight || cropWidth / (cropKind === 'logo' ? 1 : 3);

  useEffect(() => { latestUrls.current.logoUrl = logoUrl || null; setLogo(prev => ({ ...prev, url: logoUrl || null })); }, [logoUrl]);
  useEffect(() => { latestUrls.current.bannerUrl = bannerUrl || null; setBanner(prev => ({ ...prev, url: bannerUrl || null })); }, [bannerUrl]);
  useEffect(() => () => { if (cropSource) URL.revokeObjectURL(cropSource); }, [cropSource]);
  useEffect(() => { onUploadingChange?.(activeTasks > 0); }, [activeTasks, onUploadingChange]);

  const notifyChange = (kind: BrandingKind, url: string | null) => {
    latestUrls.current = { ...latestUrls.current, [kind === 'logo' ? 'logoUrl' : 'bannerUrl']: url };
    onChange(latestUrls.current);
  };
  const updateAsset = (kind: BrandingKind, patch: Partial<AssetState>) => {
    const setter = kind === 'logo' ? setLogo : setBanner;
    setter(prev => ({ ...prev, ...patch }));
  };
  const openCrop = (kind: BrandingKind, file: File) => {
    const valid = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    if (!valid) { updateAsset(kind, { error: 'Choose a JPG, PNG or WebP image.' }); return; }
    if (file.size > 5 * 1024 * 1024) { updateAsset(kind, { error: 'That file is too large. Max 5 MB.' }); return; }
    if (cropSource) URL.revokeObjectURL(cropSource);
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setCropImage(image);
      setCropSource(source);
      setCropKind(kind);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setCropError('');
    };
    image.onerror = () => { URL.revokeObjectURL(source); updateAsset(kind, { error: 'This image could not be opened. Try another file.' }); };
    image.src = source;
    updateAsset(kind, { error: '' });
  };

  const openExistingCrop = async (kind: BrandingKind) => {
    const asset = kind === 'logo' ? logo : banner;
    if (!asset.url) return;
    try {
      const response = await fetch(asset.url, { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load the current image for repositioning.');
      const blob = await response.blob();
      const file = new File([blob], kind + '-reposition.' + (blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'), { type: blob.type || 'image/jpeg' });
      openCrop(kind, file);
    } catch (error: any) { updateAsset(kind, { error: error?.message || 'Could not reopen this image. Please try again.' }); }
  };

  const clampCropOffset = (next: { x: number; y: number }, nextZoom = zoom) => {
    if (!cropRef.current || !cropImage) return next;
    const w = cropRef.current.clientWidth, h = cropRef.current.clientHeight;
    const base = Math.max(w / cropImage.naturalWidth, h / cropImage.naturalHeight);
    const maxX = Math.max(0, (cropImage.naturalWidth * base * nextZoom - w) / 2);
    const maxY = Math.max(0, (cropImage.naturalHeight * base * nextZoom - h) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, next.x)), y: Math.max(-maxY, Math.min(maxY, next.y)) };
  };

  const uploadCropped = async (kind: BrandingKind, file: File, localPreview?: string) => {
    updateAsset(kind, { busy: true, progress: 0, error: '', pendingFile: file, ...(localPreview ? { url: localPreview } : {}) });
    setActiveTasks(value => value + 1);
    try {
      const url = await supabaseService.uploadShowroomBrandingAsset(file, kind, progress => updateAsset(kind, { progress }));
      if (localPreview) URL.revokeObjectURL(localPreview);
      updateAsset(kind, { url, busy: false, progress: 100, error: '', pendingFile: null });
      notifyChange(kind, url);
    } catch (error: any) {
      updateAsset(kind, { busy: false, error: error?.message || 'Upload failed. Your image is saved here — try again.' });
    } finally { setActiveTasks(value => Math.max(0, value - 1)); }
  };

  const confirmCrop = async () => {
    if (!cropKind || !cropImage || !cropRef.current) return;
    const kind = cropKind;
    const rect = cropRef.current.getBoundingClientRect();
    const ratio = kind === 'logo' ? 1 : 3;
    const viewportW = rect.width;
    const viewportH = viewportW / ratio;
    const baseScale = Math.max(viewportW / cropImage.naturalWidth, viewportH / cropImage.naturalHeight);
    const sourceW = viewportW / (baseScale * zoom);
    const sourceH = viewportH / (baseScale * zoom);
    const centerX = cropImage.naturalWidth / 2 - offset.x / (baseScale * zoom);
    const centerY = cropImage.naturalHeight / 2 - offset.y / (baseScale * zoom);
    const sx = Math.max(0, Math.min(cropImage.naturalWidth - sourceW, centerX - sourceW / 2));
    const sy = Math.max(0, Math.min(cropImage.naturalHeight - sourceH, centerY - sourceH / 2));
    const canvas = document.createElement('canvas');
    canvas.width = kind === 'logo' ? 512 : 1500;
    canvas.height = kind === 'logo' ? 512 : 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setCropError('Could not prepare this image. Please try again.'); return; }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cropImage, sx, sy, sourceW, sourceH, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.84));
    if (!blob) { setCropError('Could not compress this image. Please try again.'); return; }
    const file = new File([blob], kind + '.webp', { type: 'image/webp', lastModified: Date.now() });
    const localPreview = URL.createObjectURL(blob);
    setCropKind(null);
    setCropImage(null);
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
    await uploadCropped(kind, file, localPreview);
  };

  const retry = (kind: BrandingKind) => {
    const asset = kind === 'logo' ? logo : banner;
    if (asset.pendingFile) void uploadCropped(kind, asset.pendingFile, asset.url?.startsWith('blob:') ? asset.url : undefined);
  };

  const remove = async (kind: BrandingKind) => {
    const asset = kind === 'logo' ? logo : banner;
    updateAsset(kind, { busy: true, error: '' });
    setActiveTasks(value => value + 1);
    try {
      await supabaseService.removeShowroomBrandingAsset(kind, asset.url);
      updateAsset(kind, { url: null, busy: false, progress: 0, pendingFile: null, error: '' });
      notifyChange(kind, null);
    } catch (error: any) {
      updateAsset(kind, { busy: false, error: error?.message || 'Could not remove this image. Please try again.' });
    } finally { setActiveTasks(value => Math.max(0, value - 1)); }
  };

  const renderUpload = (kind: BrandingKind, title: string, hint: string) => {
    const asset = kind === 'logo' ? logo : banner;
    const aspect = kind === 'logo' ? 'aspect-square w-[68px] rounded-full' : 'aspect-[3/1] w-[108px] rounded-xl';
    return <div className="sb-upload-row" key={kind}>
      <div className="sb-upload-copy"><strong>{title}</strong><span>{hint}</span></div>
      {asset.url ? <div className="sb-upload-selected">
        <div className={`sb-thumb ${aspect}`}>
          <img src={asset.url} alt={title} />
          {asset.busy && <div className="sb-progress"><span style={{ width: asset.progress ? `${asset.progress}%` : '24%' }} /></div>}
        </div>
        <div className="sb-upload-actions">
          {asset.busy ? <span className="sb-upload-status"><Loader2 size={13} className="animate-spin"/> {asset.progress}%</span> : <button type="button" onClick={() => fileInputRefs[kind].current?.click()}>Change</button>}
          {!asset.busy && <button type="button" onClick={() => void remove(kind)} className="sb-remove">Remove</button>}
          {asset.error && asset.pendingFile && <button type="button" onClick={() => retry(kind)} className="sb-retry"><RefreshCw size={12}/> Retry upload</button>}
        </div>
      </div> : <button type="button" className="sb-upload-button" onClick={() => fileInputRefs[kind].current?.click()} disabled={asset.busy}>
        <span className="sb-upload-icon"><Upload size={17}/></span><span>Upload {kind}</span>
      </button>}
      <input ref={fileInputRefs[kind]} type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) openCrop(kind, file); e.currentTarget.value = ''; }} />
      {asset.error && <p className="sb-inline-error">{asset.error}</p>}
    </div>;
  };

  return <div className={`sb-editor ${className}`}>
    <div className="sb-preview-card">
      <div className="sb-preview-banner">{banner.url ? <img src={banner.url} alt="" /> : <div className="sb-banner-empty"/>}</div>
      <div className="sb-preview-identity">
        <div className="sb-preview-logo">{logo.url ? <img src={logo.url} alt="" /> : <span>{initials}</span>}</div>
        <strong>{dealershipName || 'Your dealership'}</strong>
        <small>Showroom preview</small>
      </div>
    </div>
    <div className="sb-upload-list">
      {renderUpload('logo', 'Logo', 'Square, at least 400x400px. PNG or JPG.')}
      {renderUpload('banner', 'Banner', 'Wide image, 1500x500px works best.')}
    </div>
    {cropKind && cropImage && <div className="sb-crop-backdrop" role="dialog" aria-modal="true" aria-label={"Crop " + cropKind}>
      <div className="sb-crop-sheet">
        <div className="sb-crop-heading"><div><strong>Position your {cropKind}</strong><span>Move the image and pinch or zoom to frame it.</span></div><button type="button" onClick={() => { setCropKind(null); setCropImage(null); if (cropSource) URL.revokeObjectURL(cropSource); setCropSource(null); }} aria-label="Cancel crop"><X size={20}/></button></div>
        <div ref={cropRef} className={"sb-crop-viewport " + (cropKind === "logo" ? "is-square" : "is-banner")}
          onPointerDown={e => {
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            pointers.current.set(e.pointerId, {x:e.clientX,y:e.clientY});
            const pts=Array.from(pointers.current.values());
            if(pts.length===2){const dx=pts[1].x-pts[0].x,dy=pts[1].y-pts[0].y;pinchStart.current={distance:Math.hypot(dx,dy),zoom,offset:{...offset},midpoint:{x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2}};setDrag(null);}
            else setDrag({x:e.clientX-offset.x,y:e.clientY-offset.y});
          }}
          onPointerMove={e => {
            if(!pointers.current.has(e.pointerId)) return;
            pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
            const pts=Array.from(pointers.current.values());
            if(pts.length===2 && pinchStart.current){const dx=pts[1].x-pts[0].x,dy=pts[1].y-pts[0].y,mid={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};const z=Math.max(1,Math.min(4,pinchStart.current.zoom*Math.hypot(dx,dy)/Math.max(1,pinchStart.current.distance)));setZoom(z);setOffset(clampCropOffset({x:pinchStart.current.offset.x+mid.x-pinchStart.current.midpoint.x,y:pinchStart.current.offset.y+mid.y-pinchStart.current.midpoint.y},z));}
            else if(drag) setOffset(clampCropOffset({x:e.clientX-drag.x,y:e.clientY-drag.y}));
          }}
          onPointerUp={e=>{pointers.current.delete(e.pointerId);if(pointers.current.size<2)pinchStart.current=null;setDrag(null);}}
          onPointerCancel={e=>{pointers.current.delete(e.pointerId);pinchStart.current=null;setDrag(null);}}>
          <img draggable={false} src={cropSource || ""} alt="Crop preview" style={{width:Math.max(1,cropImage.naturalWidth*Math.max(cropWidth/cropImage.naturalWidth,cropHeight/cropImage.naturalHeight)),height:Math.max(1,cropImage.naturalHeight*Math.max(cropWidth/cropImage.naturalWidth,cropHeight/cropImage.naturalHeight)),transform:"translate(-50%, -50%) translate("+offset.x+"px, "+offset.y+"px) scale("+zoom+")"}} />
          <span className="sb-crop-frame"/>
        </div>
        <label className="sb-zoom"><ZoomIn size={17}/><span>Zoom</span><input type="range" min="1" max="4" step="0.05" value={zoom} onChange={e=>{const z=Number(e.target.value);setZoom(z);setOffset(v=>clampCropOffset(v,z));}}/></label>
        {cropError && <p className="sb-inline-error">{cropError}</p>}
        <div className="sb-crop-actions"><button type="button" className="sb-crop-cancel" onClick={()=>{setCropKind(null);setCropImage(null);if(cropSource)URL.revokeObjectURL(cropSource);setCropSource(null);}}>Cancel</button><button type="button" className="sb-crop-confirm" onClick={()=>void confirmCrop()}>Done <Check size={17}/></button></div>
      </div>
    </div>}
  </div>;
};
