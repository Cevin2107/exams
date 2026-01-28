"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = "info", onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-blue-600",
  }[type];

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className={`${bgColor} rounded-lg px-6 py-4 text-white shadow-lg`}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{message}</span>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
