import React from 'react';

interface DeviceFrameProps {
  children: React.ReactNode;
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({ children }) => {
  return (
    <div className="min-h-screen w-full bg-slate-100/70 text-slate-900 flex justify-center selection:bg-blue-100 selection:text-blue-900">
      <div className="w-full max-w-xl md:max-w-2xl min-h-screen bg-white shadow-xs sm:border-x sm:border-slate-200/60 flex flex-col relative">
        {children}
      </div>
    </div>
  );
};
