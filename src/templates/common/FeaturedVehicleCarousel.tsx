import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dealership, Vehicle } from '../../types';
import { pickShowcaseVehicles } from '../utils/featuredVehicles';
import './FeaturedVehicleCarousel.css';

type CarouselVariant = 'classic' | 'prestige' | 'minimalist';
interface FeaturedVehicleCarouselProps {
  dealer: Dealership;
  vehicles: Vehicle[];
  onVehicleClick: (vehicleId: string) => void;
  variant: CarouselVariant;
}

export const FeaturedVehicleCarousel: React.FC<FeaturedVehicleCarouselProps> = ({ dealer, vehicles, onVehicleClick, variant }) => {
  const slides = useMemo(() => pickShowcaseVehicles(vehicles), [vehicles]);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  const pauseUntilRef = useRef(0);
  const draggingRef = useRef(false);
  const hoveringRef = useRef(false);
  const focusedRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [tabVisible, setTabVisible] = useState(() => typeof document === 'undefined' || !document.hidden);

  const scrollToSlide = useCallback((index: number) => {
    const track = trackRef.current;
    const slide = track?.children[index] as HTMLElement | undefined;
    if (!track || !slide) return;
    activeIndexRef.current = index;
    setActiveIndex(index);
    track.scrollTo({ left: slide.offsetLeft, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [reducedMotion]);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(motionQuery.matches);
    const updateVisibility = () => setTabVisible(!document.hidden);
    updateMotion();
    updateVisibility();
    motionQuery.addEventListener?.('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      motionQuery.removeEventListener?.('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  useEffect(() => {
    const safeIndex = Math.min(activeIndexRef.current, Math.max(slides.length - 1, 0));
    activeIndexRef.current = safeIndex;
    setActiveIndex(safeIndex);
    if (slides.length > 0) scrollToSlide(safeIndex);
  }, [slides.length, scrollToSlide]);

  useEffect(() => {
    if (slides.length < 2 || reducedMotion || !tabVisible) return;
    const timer = window.setInterval(() => {
      if (Date.now() < pauseUntilRef.current || draggingRef.current || hoveringRef.current || focusedRef.current) return;
      scrollToSlide((activeIndexRef.current + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [slides.length, reducedMotion, tabVisible, scrollToSlide]);

  useEffect(() => {
    const finishPointerInteraction = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      pauseUntilRef.current = Date.now() + 3000;
    };
    window.addEventListener('pointerup', finishPointerInteraction);
    window.addEventListener('pointercancel', finishPointerInteraction);
    return () => {
      window.removeEventListener('pointerup', finishPointerInteraction);
      window.removeEventListener('pointercancel', finishPointerInteraction);
    };
  }, []);

  const syncActiveSlide = (event: React.UIEvent<HTMLDivElement>) => {
    const track = event.currentTarget;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    Array.from(track.children).forEach((child, index) => {
      const distance = Math.abs((child as HTMLElement).offsetLeft - track.scrollLeft);
      if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
    });
    if (activeIndexRef.current !== nearestIndex) {
      activeIndexRef.current = nearestIndex;
      setActiveIndex(nearestIndex);
    }
  };

  const pause = () => { pauseUntilRef.current = Number.POSITIVE_INFINITY; };
  const resume = () => { pauseUntilRef.current = Date.now() + 3000; };
  const handlePointerDown = () => { draggingRef.current = true; pause(); };
  const handlePointerUp = () => { draggingRef.current = false; resume(); };
  const handleMouseEnter = () => { hoveringRef.current = true; pause(); };
  const handleMouseLeave = () => { hoveringRef.current = false; resume(); };
  const handleFocus = () => { focusedRef.current = true; pause(); };
  const handleBlur = (event: React.FocusEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    focusedRef.current = false;
    resume();
  };

  const formatPrice = (vehicle: Vehicle) => {
    if (vehicle.price == null || Number(vehicle.price) <= 0) return 'Price on request';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: vehicle.currency || dealer.currency, maximumFractionDigits: 0 }).format(vehicle.price);
  };
  const autoplayActive = slides.length > 1 && !reducedMotion && tabVisible;

  if (slides.length === 0) {
    return <section className={'dl-shared-carousel dl-shared-carousel--' + variant} aria-label="Featured vehicles"><p className="dl-shared-carousel__empty">No vehicles listed yet</p></section>;
  }

  return (
    <section className={'dl-shared-carousel dl-shared-carousel--' + variant} role="region" aria-roledescription="carousel" aria-label="Featured vehicles"
      onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
      onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} onFocusCapture={handleFocus} onBlurCapture={handleBlur}>
      <div className="dl-shared-carousel__heading">
        <h2>Featured vehicles</h2>
        {slides.length > 1 && <div className="dl-shared-carousel__arrows">
          <button type="button" onClick={() => scrollToSlide((activeIndex - 1 + slides.length) % slides.length)} aria-label="Previous vehicle"><span aria-hidden="true">‹</span></button>
          <button type="button" onClick={() => scrollToSlide((activeIndex + 1) % slides.length)} aria-label="Next vehicle"><span aria-hidden="true">›</span></button>
        </div>}
      </div>
      <div className="dl-shared-carousel__track" ref={trackRef} onScroll={syncActiveSlide}>
        {slides.map((vehicle, index) => {
          const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle';
          const specs = [
            vehicle.mileageKm != null && Number(vehicle.mileageKm) > 0 ? Number(vehicle.mileageKm).toLocaleString() + ' km' : '',
            vehicle.transmission || '',
            vehicle.fuel || '',
          ].filter(Boolean).slice(0, 3);
          const href = '/' + encodeURIComponent(dealer.slug) + '/vehicle/' + encodeURIComponent(vehicle.id);
          return <a key={vehicle.id} className="dl-shared-carousel__slide" href={href} aria-roledescription="slide" aria-label={(index + 1) + ' of ' + slides.length}
            onClick={event => {
              if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                event.preventDefault();
                onVehicleClick(vehicle.id);
              }
            }}>
            <div className="dl-shared-carousel__photo">
              {vehicle.photos?.[0] ? <img src={vehicle.photos[0]} alt={title} loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'auto'} decoding="async" /> : <div className="dl-shared-carousel__no-photo">Photo unavailable</div>}
              <span className={'dl-shared-carousel__status is-' + vehicle.status}>{vehicle.status === 'reserved' ? 'Reserved' : 'Available'}</span>
            </div>
            <div className="dl-shared-carousel__body">
              <h3>{title}</h3>
              <strong className="dl-shared-carousel__price">{formatPrice(vehicle)}</strong>
              {specs.length > 0 && <div className="dl-shared-carousel__specs">{specs.map(spec => <span key={spec}>{spec}</span>)}</div>}
            </div>
          </a>;
        })}
      </div>
      {slides.length > 1 && <div className="dl-shared-carousel__dots" role="group" aria-label="Choose a vehicle">
        {slides.map((vehicle, index) => <button key={vehicle.id} type="button" className={index === activeIndex ? 'is-active' : ''} aria-label={'Go to slide ' + (index + 1)} aria-current={index === activeIndex ? 'true' : undefined} onClick={() => scrollToSlide(index)} />)}
      </div>}
      <p className="dl-shared-carousel__sr-only" aria-live={autoplayActive ? 'off' : 'polite'} aria-atomic="true">Slide {activeIndex + 1} of {slides.length}</p>
    </section>
  );
};

export default FeaturedVehicleCarousel;
