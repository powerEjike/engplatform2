import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { ChatLauncher } from "@/components/chat-launcher";
import { OfflineStatus } from "@/components/offline-status";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://engplatform2-web.vercel.app"),
  title: "BuildCore Engineering",
  description: "Construction project management for the field and the office",
  openGraph: {
    title: "BuildCore Engineering",
    description: "Construction project management for the field and the office",
    siteName: "BuildCore Engineering",
    images: [{ url: "/brand/buildcore-brand.png", width: 1536, height: 1024, alt: "BuildCore Engineering" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BuildCore Engineering",
    description: "Construction project management for the field and the office",
    images: ["/brand/buildcore-brand.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}<OfflineStatus /><ChatLauncher /></AuthProvider></body>
    </html>
  );
}
