import React, { useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { CAR_RAV4_SILVER, CAR_AQUA_WHITE, CAR_RANGER_WHITE, DEFAULT_DEALER_LOGO } from '../utils/carVisuals';
import { ArrowRight, ChevronRight, Check } from 'lucide-react';

export const WelcomePage: React.FC = () => {
  const { navigate } = useNavigation();
  const [activeSlide, setActiveSlide] = useState(0);

  const previewVehicles = [
    {
      year: 2022,
      make: 'Toyota',
      model: 'RAV4',
      price: '$36,990',
      status: 'Available',
      image: CAR_RAV4_SILVER,
    },
    {
      year: 2019,
      make: 'Toyota',
      model: 'Aqua',
      price: '$15,990',
      status: 'Available',
      image: CAR_AQUA_WHITE,
    },
    {
      year: 2021,
      make: 'Ford',
      model: 'Ranger',
      price: '$42,500',
      status: 'Available',
      image: CAR_RANGER_WHITE,
    },
  ];

  const currentCar = previewVehicles[activeSlide % previewVehicles.length];

  return (
    <div className="min-h-screen w-full flex flex-col justify-between px-6 py-6 bg-white text-slate-900 select-none">
      {/* Top Bar matching Screen 01 */}
      <header className="flex items-center justify-between pt-1 pb-4">
        {/* Logo and Wordmark */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-950 flex items-center justify-center text-white shadow-xs">
            {/* Clean steering/link vector mark */}
            <svg
              className="w-4 h-4 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3v6" />
              <path d="M12 15v6" />
              <path d="M3 12h6" />
              <path d="M15 12h6" />
            </svg>
          </div>
          <span className="font-extrabold text-base tracking-tight text-slate-950">
            DriveLink
          </span>
        </div>

        {/* Header Actions: Sign in */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate('/login')}
            className="min-h-[40px] px-2.5 py-1.5 text-xs font-semibold text-slate-900 hover:text-blue-600 transition-colors"
          >
            Sign in
          </button>
        </div>
      </header>

      {/* Main Content Area matching Screen 01 */}
      <div className="my-auto flex flex-col items-start text-left py-4">
        {/* Headline matching Screen 01 */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight leading-[1.16] mb-3">
          Your dealership, <br />
          online in minutes.
        </h1>

        {/* Supporting Copy matching Screen 01 */}
        <p className="text-sm font-medium text-slate-500 leading-relaxed mb-6">
          Create a showroom, showcase your inventory and make it easy for buyers to get in touch — all with one link.
        </p>

        {/* Vehicle Listing Preview Card matching Screen 01 */}
        <div className="w-full max-w-sm mx-auto">
          <div className="bg-white rounded-3xl p-4 shadow-xl shadow-slate-200/60 border border-slate-100 flex flex-col gap-3 transition-all">
            {/* Vehicle Image Container */}
            <div className="w-full aspect-16/10 rounded-2xl overflow-hidden bg-slate-50 relative flex items-center justify-center">
              <img
                src={currentCar.image}
                alt={`${currentCar.year} ${currentCar.make} ${currentCar.model}`}
                className="w-full h-full object-contain p-2"
              />
              {/* Green Available badge on top right of image */}
              <div className="absolute top-2.5 right-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-2xs">
                Available
              </div>
            </div>

            {/* Title, Price and Status row matching Screen 01 */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="font-bold text-xs text-slate-800">
                  {currentCar.year} {currentCar.make} {currentCar.model}
                </p>
                <p className="font-extrabold text-base text-slate-950 mt-0.5">
                  {currentCar.price}
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                Available
              </span>
            </div>
          </div>

          {/* Carousel Pagination Dots matching Screen 01 */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {previewVehicles.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSlide(idx)}
                className={`h-2 rounded-full transition-all ${
                  activeSlide === idx ? 'w-5 bg-slate-950' : 'w-2 bg-slate-300'
                }`}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA Area matching Screen 01 */}
      <div className="flex flex-col gap-3 pt-6 pb-2">
        <button
          onClick={() => navigate('/onboarding')}
          className="w-full h-13 rounded-full bg-slate-950 hover:bg-slate-850 text-white font-bold text-sm tracking-wide shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2 group"
        >
          <span>Get started</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button
          onClick={() => navigate('/login')}
          className="w-full py-2 text-center text-xs font-semibold text-slate-600 hover:text-slate-950 transition-colors"
        >
          I already have an account
        </button>
      </div>
    </div>
  );
};
