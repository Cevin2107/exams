import type { Metadata } from "next";
import { fetchAssignmentByIdAdmin } from "@/lib/supabaseHelpers";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const hasBaseUrl = Boolean(appUrl);
  const startPath = `/assignments/${id}/start`;
  
  try {
    const assignment = await fetchAssignmentByIdAdmin(id);

    if (assignment) {
      const title = `${assignment.title} - Gia sư Đào Bá Anh Quân`;
      const description = `Bài tập ${assignment.subject} ${assignment.grade}. Hoàn thành đúng hạn, được làm lại nhiều lần.`;
      
      return {
        ...(hasBaseUrl ? { metadataBase: new URL(appUrl!) } : {}),
        title,
        description,
        alternates: {
          canonical: startPath,
        },
        openGraph: {
          title,
          description,
          ...(hasBaseUrl ? { url: startPath } : {}),
          siteName: "Gia sư Đào Bá Anh Quân",
          locale: "vi_VN",
          type: "website",
        },
        twitter: {
          card: "summary",
          title,
          description,
        },
      };
    }
  } catch (error) {
    console.error("Error fetching assignment for metadata:", error);
  }

  return {
    ...(hasBaseUrl ? { metadataBase: new URL(appUrl!) } : {}),
    title: "Bài tập - Gia sư Đào Bá Anh Quân",
    description: "Hệ thống bài tập trực tuyến",
    alternates: {
      canonical: startPath,
    },
    openGraph: {
      title: "Bài tập - Gia sư Đào Bá Anh Quân",
      description: "Hệ thống bài tập trực tuyến",
      ...(hasBaseUrl ? { url: startPath } : {}),
      siteName: "Gia sư Đào Bá Anh Quân",
      locale: "vi_VN",
      type: "website",
    },
  };
}

export default function StartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
