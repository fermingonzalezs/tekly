import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { SECTION_WRAP } from "@/components/marketing/ui/section-heading";
import { SITE_URL } from "@/lib/marketing/seo";

/** Centro de ayuda: público e indexable (vive en el host de marketing). Usa
 * el mismo nav/footer que la landing. La metadata por artículo la define cada
 * página; acá va la base. */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Centro de ayuda · Tekly", template: "%s · Ayuda de Tekly" },
  robots: { index: true, follow: true },
};

export default function AyudaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-tema="indigo"
      className="min-h-screen bg-[#f7f7fa] text-neutral-900"
      style={{
        backgroundImage:
          "radial-gradient(rgb(var(--accent-rgb) / 0.09) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <MarketingNav />
      {children}
      <MarketingFooter />
    </div>
  );
}
