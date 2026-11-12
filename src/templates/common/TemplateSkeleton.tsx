import React from 'react';

export const TemplateSkeleton: React.FC<{ isDark?: boolean }> = ({ isDark = true }) => {
  return (
    <div
      className={`min-h-[100dvh] w-full animate-pulse px-4 py-6 ${
        isDark ? 'bg-[#0B0D13] text-white' : 'bg-[#F8F9FA] text-[#0A0F1E]'
      }`}
      aria-label="Loading showroom template…"
    >
      <div className="mx-auto max-w-md space-y-5">
        {/* Top bar skeleton */}
        <div className="flex items-center justify-between">
          <div className={`h-6 w-28 rounded-md ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
          <div className="flex gap-2">
            <div className={`h-8 w-8 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
            <div className={`h-8 w-8 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
          </div>
        </div>

        {/* Hero headline skeleton */}
        <div className="space-y-2 pt-4">
          <div className={`h-10 w-3/4 rounded-xl ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
          <div className={`h-10 w-1/2 rounded-xl ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
          <div className={`h-4 w-2/3 rounded ${isDark ? 'bg-white/5' : 'bg-slate-100'}`} />
        </div>

        {/* Hero CTA skeleton */}
        <div className={`h-11 w-44 rounded-full ${isDark ? 'bg-white/20' : 'bg-slate-300'}`} />

        {/* Stat badges */}
        <div className="flex gap-3 pt-2">
          <div className={`h-12 flex-1 rounded-2xl ${isDark ? 'bg-white/5' : 'bg-slate-100'}`} />
          <div className={`h-12 flex-1 rounded-2xl ${isDark ? 'bg-white/5' : 'bg-slate-100'}`} />
        </div>

        {/* Vehicle card skeletons */}
        <div className="space-y-4 pt-4">
          <div className={`h-56 w-full rounded-3xl ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
          <div className={`h-56 w-full rounded-3xl ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
        </div>
      </div>
    </div>
  );
};
