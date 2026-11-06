import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";

const reading = localFont({ src: "./fonts/instrument-sans-latin.woff2", weight: "400 700", display: "swap", variable: "--font-reading" });
const display = localFont({ src: "./fonts/host-grotesk-latin.woff2", weight: "400 700", display: "swap", variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "OtpWave — WhatsApp messaging and OTP workspace",
  description:
    "Manage WhatsApp conversations, send OTPs, and connect your AI tools from one workspace.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${reading.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background font-sans">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          <Toaster theme="system" position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
