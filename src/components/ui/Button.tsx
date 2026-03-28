import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"
import { Spinner } from "./Spinner"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "brand"
  size?: "default" | "sm" | "lg" | "icon"
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-slate-900 text-slate-50 hover:bg-slate-800 active:scale-95 shadow-sm focus-visible:ring-slate-900": variant === "default",
            "bg-red-500 text-slate-50 hover:bg-red-600 active:scale-95 shadow-sm focus-visible:ring-red-500": variant === "destructive",
            "border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 active:scale-95 focus-visible:ring-slate-900": variant === "outline",
            "bg-slate-100 text-slate-900 hover:bg-slate-200 active:scale-95": variant === "secondary",
            "hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200": variant === "ghost",
            "text-slate-900 underline-offset-4 hover:underline": variant === "link",
            "brand-gradient text-white shadow-md hover:shadow-lg active:scale-95 focus-visible:ring-indigo-500": variant === "brand",
            "h-10 px-4 py-2": size === "default",
            "h-9 rounded-lg px-3 text-xs": size === "sm",
            "h-11 rounded-xl px-8 text-base": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      >
        {loading && <Spinner className="h-4 w-4" />}
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button }
