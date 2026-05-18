"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function AdminThemeController({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // Check if we are in admin section
    if (pathname?.startsWith("/admin")) {
      // Remove dark class explicitly when entering admin
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = 'light';
    } else {
      // If leaving admin, restore based on theme
      const savedTheme = localStorage.getItem("theme");
      document.documentElement.style.colorScheme = '';
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      }
    }
  }, [pathname]);

  return <>{children}</>;
}
