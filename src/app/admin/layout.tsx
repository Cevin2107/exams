import { AdminThemeController } from "@/features/admin/components/AdminThemeController";

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminThemeController>{children}</AdminThemeController>;
}