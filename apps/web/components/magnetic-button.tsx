"use client";

import type { ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

export function MagneticButton({
  href,
  children,
  variant = "primary"
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const x = useSpring(rawX, { stiffness: 180, damping: 18 });
  const y = useSpring(rawY, { stiffness: 180, damping: 18 });

  return (
    <motion.a
      href={href}
      style={{ x, y }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const relX = event.clientX - rect.left - rect.width / 2;
        const relY = event.clientY - rect.top - rect.height / 2;

        rawX.set(relX * 0.16);
        rawY.set(relY * 0.16);
      }}
      onPointerLeave={() => {
        rawX.set(0);
        rawY.set(0);
      }}
      className={variant === "primary" ? "magnetic-button primary" : "magnetic-button secondary"}
    >
      {children}
    </motion.a>
  );
}
