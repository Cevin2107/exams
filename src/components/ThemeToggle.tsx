"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-xl transition-colors ${
        theme === "dark" 
          ? "bg-slate-800 text-amber-400 hover:bg-slate-700" 
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      } ${className || ""}`}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
