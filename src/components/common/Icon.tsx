/**
 * Shared DriveLink icon system.
 * Use Lucide only; default to 20px, 1.75 stroke, rounded caps/joins and currentColor.
 * Inline/chip icons should use 16px; header/empty-state icons may use 24px or 32px.
 * Standalone meaningful icons must receive ariaLabel; decorative icons stay aria-hidden.
 */
import type { LucideProps } from 'lucide-react';
import {
  Activity, AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight,
  Bell, Calendar, Camera, Car, Check, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, Clock, Copy, Eye, FileText, Filter, Fuel, Gauge, Heart, Image,
  Info, Link2, Lock, MapPin, Menu, MessageCircle, MoreHorizontal, Pencil,
  Phone, Plus, RefreshCw, Search, Settings2, Share2, ShieldCheck, Sparkles,
  Star, Tag, Trash2, Upload, User, X, XCircle, type LucideIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';

export const ICONS = {
  activity: Activity, alert: AlertTriangle, arrowDown: ArrowDown, arrowLeft: ArrowLeft,
  arrowRight: ArrowRight, arrowUpRight: ArrowUpRight, bell: Bell, calendar: Calendar,
  camera: Camera, car: Car, check: Check, checkCircle: CheckCircle2,
  chevronDown: ChevronDown, chevronLeft: ChevronLeft, chevronRight: ChevronRight,
  clock: Clock, copy: Copy, eye: Eye, fileText: FileText, filter: Filter,
  fuel: Fuel, gauge: Gauge, heart: Heart, image: Image, info: Info, link: Link2,
  lock: Lock, mapPin: MapPin, menu: Menu, message: MessageCircle,
  more: MoreHorizontal, pencil: Pencil, phone: Phone, plus: Plus,
  refresh: RefreshCw, search: Search, settings: Settings2, share: Share2,
  shieldCheck: ShieldCheck, sparkles: Sparkles, star: Star, tag: Tag,
  trash: Trash2, upload: Upload, user: User, close: X, error: XCircle,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;
type IconProps = Omit<LucideProps, 'ref' | 'size' | 'strokeWidth' | 'color'> & {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  ariaLabel?: string;
};

export function Icon({
  name, size = 20, strokeWidth = 1.75, ariaLabel, className, ...props
}: IconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      {...props}
      size={size}
      strokeWidth={strokeWidth}
      color="currentColor"
      className={className}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      focusable="false"
      style={{ flexShrink: 0, ...(props.style as CSSProperties | undefined) }}
    />
  );
}

export default Icon;
