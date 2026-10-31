"use client";

import { useCallback } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, type MotionProps } from "motion/react";
import { cn } from "@/lib/utils";

interface MagicCardProps extends MotionProps {
  children?: React.ReactNode;
  className?: string;
  gradientSize?: number;
  gradientColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
}

export function MagicCard({
  children,
  className,
  gradientSize = 260,
  gradientColor = "hsl(var(--primary) / 0.11)",
  gradientFrom = "#f0ae96",
  gradientTo = "#6c493d",
  ...props
}: MagicCardProps) {
  const x = useMotionValue(-gradientSize);
  const y = useMotionValue(-gradientSize);
  const springX = useSpring(x, { stiffness: 240, damping: 30, mass: 0.55 });
  const springY = useSpring(y, { stiffness: 240, damping: 30, mass: 0.55 });

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    x.set(event.clientX - bounds.left);
    y.set(event.clientY - bounds.top);
  }, [x, y]);

  const border = useMotionTemplate`linear-gradient(hsl(var(--card)) 0 0) padding-box, radial-gradient(${gradientSize}px circle at ${springX}px ${springY}px, ${gradientFrom}, ${gradientTo}, hsl(var(--border)) 100%) border-box`;
  const glow = useMotionTemplate`radial-gradient(${gradientSize}px circle at ${springX}px ${springY}px, ${gradientColor}, transparent 100%)`;

  return (
    <motion.div
      className={cn("group relative isolate overflow-hidden rounded-[inherit] border border-transparent", className)}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => { x.set(-gradientSize); y.set(-gradientSize); }}
      style={{ background: border }}
      {...props}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-px z-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: glow }}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
