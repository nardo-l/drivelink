import React from 'react';

interface DeviceFrameProps { children: React.ReactNode; }

export const DeviceFrame: React.FC<DeviceFrameProps> = ({ children }) => (
  <div className="dl-frame min-h-screen w-full flex justify-center selection:bg-orange-100 selection:text-slate-950">
    <div className="dl-frame-inner w-full max-w-[520px] min-h-screen bg-white shadow-[0_18px_70px_rgba(20,20,20,0.06)] sm:border-x sm:border-black/[0.04] flex flex-col relative overflow-x-hidden">
      {children}
    </div>
  </div>
);
