import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppInit } from "@/components/AppInit";
import { BottomNav } from "@/components/BottomNav";
import { Fab } from "@/components/Fab";
import { UpdateToast } from "@/components/UpdateToast";
import { CONTENT_WIDTH_CLASS } from "@/lib/layout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "간편 가계부",
  description: "간편하게 기록하는 우리집 가계부",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "간편 가계부",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2B5BE2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppInit>
          <main className={`min-h-dvh px-4 pb-24 pt-6 ${CONTENT_WIDTH_CLASS}`}>{children}</main>
          <Fab />
          <UpdateToast />
          <BottomNav />
        </AppInit>
      </body>
    </html>
  );
}
