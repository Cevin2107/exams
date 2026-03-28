'use client'

import * as React from "react"
import { cn } from "@/lib/utils"

interface TooltipProps {
  content: string
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  className?: string
}

export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const [position, setPosition] = React.useState({ x: 0, y: 0 })
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const tooltipRef = React.useRef<HTMLDivElement>(null)

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const gap = 8

    let x = 0
    let y = 0

    switch (side) {
      case "top":
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
        y = triggerRect.top - tooltipRect.height - gap
        break
      case "bottom":
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
        y = triggerRect.bottom + gap
        break
      case "left":
        x = triggerRect.left - tooltipRect.width - gap
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
        break
      case "right":
        x = triggerRect.right + gap
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
        break
    }

    setPosition({ x, y })
  }, [side])

  React.useEffect(() => {
    if (isVisible) {
      updatePosition()
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    }
  }, [isVisible, updatePosition])

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="inline-block"
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={cn(
            "fixed z-50 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg shadow-lg pointer-events-none animate-fade-in",
            className
          )}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          {content}
          <div
            className={cn("absolute w-2 h-2 bg-slate-900 transform rotate-45", {
              "bottom-[-4px] left-1/2 -translate-x-1/2": side === "top",
              "top-[-4px] left-1/2 -translate-x-1/2": side === "bottom",
              "right-[-4px] top-1/2 -translate-y-1/2": side === "left",
              "left-[-4px] top-1/2 -translate-y-1/2": side === "right",
            })}
          />
        </div>
      )}
    </>
  )
}
