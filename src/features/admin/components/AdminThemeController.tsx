"use client";

import { useLayoutEffect } from "react";

export function AdminThemeController({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    const previousColorScheme = document.documentElement.style.colorScheme;
    const hadDarkClass = document.documentElement.classList.contains("dark");

    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";

    return () => {
      const savedTheme = localStorage.getItem("theme");
      document.documentElement.style.colorScheme = previousColorScheme;

      if (savedTheme === "dark" || (savedTheme !== "light" && hadDarkClass)) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };
  }, []);

  return <>{children}</>;
}
