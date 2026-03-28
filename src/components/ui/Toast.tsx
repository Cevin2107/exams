'use client'

import * as React from "react"
import { cn } from "@/lib/utils"
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react"

export interface ToastProps {
  id?: string
  title?: string
  description?: string
  variant?: "default" | "success" | "error" | "warning" | "info"
  duration?: number
  onClose?: () => void
}

interface ToastContextValue {
  toasts: ToastProps[]
  addToast: (toast: Omit<ToastProps, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([])

  const addToast = React.useCallback((toast: Omit<ToastProps, 'id'>) => {
    const id = Math.random().toString(36).substring(7)
    const newToast = { ...toast, id }
    setToasts((prev) => [...prev, newToast])

    // Auto remove after duration
    const duration = toast.duration ?? 3000
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

function ToastContainer({ toasts, onClose }: { toasts: ToastProps[], onClose: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={() => toast.id && onClose(toast.id)} />
      ))}
    </div>
  )
}

function Toast({ title, description, variant = "default", onClose }: ToastProps) {
  const icons = {
    default: Info,
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  }

  const Icon = icons[variant]

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "pointer-events-auto relative flex items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-sm animate-slide-up",
        {
          "bg-white/95 border-slate-200": variant === "default",
          "bg-emerald-50/95 border-emerald-200": variant === "success",
          "bg-red-50/95 border-red-200": variant === "error",
          "bg-amber-50/95 border-amber-200": variant === "warning",
          "bg-blue-50/95 border-blue-200": variant === "info",
        }
      )}
    >
      <Icon
        className={cn("h-5 w-5 flex-shrink-0 mt-0.5", {
          "text-slate-600": variant === "default",
          "text-emerald-600": variant === "success",
          "text-red-600": variant === "error",
          "text-amber-600": variant === "warning",
          "text-blue-600": variant === "info",
        })}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        {title && (
          <div
            className={cn("font-semibold text-sm", {
              "text-slate-900": variant === "default",
              "text-emerald-900": variant === "success",
              "text-red-900": variant === "error",
              "text-amber-900": variant === "warning",
              "text-blue-900": variant === "info",
            })}
          >
            {title}
          </div>
        )}
        {description && (
          <div
            className={cn("text-sm mt-1", {
              "text-slate-600": variant === "default",
              "text-emerald-700": variant === "success",
              "text-red-700": variant === "error",
              "text-amber-700": variant === "warning",
              "text-blue-700": variant === "info",
            })}
          >
            {description}
          </div>
        )}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className={cn(
            "flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5",
            {
              "text-slate-400 hover:text-slate-600": variant === "default",
              "text-emerald-400 hover:text-emerald-600": variant === "success",
              "text-red-400 hover:text-red-600": variant === "error",
              "text-amber-400 hover:text-amber-600": variant === "warning",
              "text-blue-400 hover:text-blue-600": variant === "info",
            }
          )}
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
