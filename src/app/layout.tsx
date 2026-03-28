import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/providers/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gia sư Đào Bá Anh Quân",
  description: "Hệ thống bài tập trực tuyến - Giao và làm bài tập, tự động chấm điểm, theo dõi tiến độ học tập",
  openGraph: {
    title: "Gia sư Đào Bá Anh Quân",
    description: "Hệ thống bài tập trực tuyến - Giao và làm bài tập, tự động chấm điểm, theo dõi tiến độ học tập",
    siteName: "Gia sư Đào Bá Anh Quân",
    type: "website",
    locale: "vi_VN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gia sư Đào Bá Anh Quân",
    description: "Hệ thống bài tập trực tuyến",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <QueryProvider>
          <ThemeProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
