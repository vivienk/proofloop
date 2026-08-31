import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./enhancements.css";
import "./chat-solid-light.css";
import "./context-bubbles.css";
import "./workspace-rail.css";
import "./investigation-light.css";
import "./investigation-agent.css";
import { ClientEnhancements } from "./client-enhancements";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"),
  ),
  title: "ProofLoop Business Diagnostic Flywheel",
  description:
    "An autonomous business diagnostic agent that detects problems, investigates evidence, acts, measures outcomes, and learns.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        {children}
        <ClientEnhancements />
      </body>
    </html>
  );
}
