import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { AuthRouteGuard } from "@/components/auth-route-guard";
import { ChatLauncher } from "@/components/chat-launcher";
import { OfflineStatus } from "@/components/offline-status";
import { ReportCommentNotifier } from "@/components/report-comment-notifier";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://engplatform2-web.vercel.app"),
  title: "BuildCore Engineering",
  description: "Construction project management for the field and the office",
  manifest: "/manifest.webmanifest",
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
      <body><a className="skip-to-content" href="#main-content">Skip to main content</a><AuthProvider><div id="main-content" tabIndex={-1}><AuthRouteGuard>{children}</AuthRouteGuard></div><ServiceWorkerRegistration /><OfflineStatus /><ChatLauncher /><ReportCommentNotifier /></AuthProvider></body>
    </html>
  );
}
