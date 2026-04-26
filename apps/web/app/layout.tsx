import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AnimatedBackground } from "../components/animated-background";
import { ScrollProgress } from "../components/scroll-progress";
import "./globals.css";

export const metadata: Metadata = {
  title: "Invoice Lantern - Independent E-Invoice Validation Sandbox",
  description:
    "An independent e-invoice validation and ViDA-readiness sandbox for freelancers, SMEs, students, accountants, and developers."
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
        {children}
      </body>
    </html>
  );
}
