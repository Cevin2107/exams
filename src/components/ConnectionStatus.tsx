'use client'

import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

interface ConnectionStatusProps {
  isConnected: boolean;
  className?: string;
}

export function ConnectionStatus({ isConnected, className }: ConnectionStatusProps) {
  const [show, setShow] = useState(true);

  // Auto-hide after 5 seconds if connected
  useEffect(() => {
    if (isConnected) {
      const timeout = setTimeout(() => setShow(false), 5000);
      return () => clearTimeout(timeout);
    } else {
      setShow(true);
    }
  }, [isConnected]);

  if (!show && isConnected) return null;

  return (
    <div className={`fixed bottom-6 left-6 z-30 animate-slide-up ${className}`}>
      <div
        className={`
          flex items-center gap-2 px-4 py-2 rounded-full shadow-lg backdrop-blur-sm text-sm font-semibold transition-all
          ${
            isConnected
              ? 'bg-emerald-50/95 border border-emerald-200 text-emerald-700'
              : 'bg-amber-50/95 border border-amber-200 text-amber-700 animate-pulse'
          }
        `}
      >
        {isConnected ? (
          <>
            <Wifi className="h-4 w-4" />
            <span>Đang kết nối trực tiếp</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span>Mất kết nối</span>
          </>
        )}
      </div>
    </div>
  );
}
