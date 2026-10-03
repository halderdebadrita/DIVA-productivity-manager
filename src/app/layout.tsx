import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Diva", template: "%s · Diva" },
  description: "Personal productivity command centre",
};
export const viewport: Viewport = { themeColor: "#0d0e12", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans text-[14px]">
        {children}
        <Toaster theme="dark" position="top-center" toastOptions={{ style: { background: "rgb(26 28 35)", border: "1px solid rgb(40 42 52)", color: "rgb(236 235 230)" } }} />
      </body>
    </html>
  );
}
