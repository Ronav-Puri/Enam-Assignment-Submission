import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthGate } from "@/components/AuthGate";
import { BottomNav } from "@/components/BottomNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FINN",
  description: "What changed in your portfolio, why it matters, and who can explain it.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-neutral-950 text-neutral-100 antialiased`}>
        <AuthGate>
          <main className="mx-auto min-h-dvh max-w-md px-4 pb-28 pt-6">{children}</main>
          <BottomNav />
        </AuthGate>
      </body>
    </html>
  );
}