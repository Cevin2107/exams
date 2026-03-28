import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
  size?: "sm" | "md" | "lg"
}

function Badge({ className, variant = "default", size = "md", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold transition-all",
        {
          "border-transparent bg-slate-900 text-slate-50": variant === "default",
          "border-transparent bg-slate-100 text-slate-900": variant === "secondary",
          "border-transparent bg-red-50 text-red-700 ring-1 ring-red-200": variant === "destructive",
          "border-slate-300 text-slate-700 bg-white": variant === "outline",
          "border-transparent bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200": variant === "success",
          "border-transparent bg-amber-50 text-amber-700 ring-1 ring-amber-200": variant === "warning",
          "border-transparent bg-blue-50 text-blue-700 ring-1 ring-blue-200": variant === "info",
          "px-2 py-0.5 text-xs": size === "sm",
          "px-2.5 py-0.5 text-xs": size === "md",
          "px-3 py-1 text-sm": size === "lg",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
