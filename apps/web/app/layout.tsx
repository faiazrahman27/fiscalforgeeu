import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AnimatedBackground } from "../components/animated-background";
import { CookieConsentBanner } from "../components/cookie-consent-banner";
import { NetworkStatus } from "../components/network-status";
import { PwaInstallPrompt } from "../components/pwa-install-prompt";
import { ScrollProgress } from "../components/scroll-progress";
import { ServiceWorkerRegister } from "../components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Invoice Lantern",
  title: "Invoice Lantern - Independent E-Invoice Validation Sandbox",
  description:
    "An independent e-invoice validation and ViDA-readiness sandbox for freelancers, SMEs, students, accountants, and developers.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Invoice Lantern",
    statusBarStyle: "black-translucent"
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false
  },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0f172a"
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ScrollProgress />
        <AnimatedBackground />
        <ServiceWorkerRegister />
        <NetworkStatus />
        <PwaInstallPrompt />
        <CookieConsentBanner />
        {children}
      </body>
    </html>
  );
}
