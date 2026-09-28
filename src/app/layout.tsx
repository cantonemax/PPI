import type { Metadata } from "next";
import "./globals.css";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("product.name"),
  description: t("product.tagline"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
