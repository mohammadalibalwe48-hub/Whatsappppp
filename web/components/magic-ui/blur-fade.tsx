"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion, type MotionProps } from "motion/react";
import { cn } from "@/lib/utils";

interface BlurFadeProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  offset?: number;
  direction?: "up" | "down" | "left" | "right";
  inView?: boolean;
  duration?: number;
}

export function BlurFade({
  children,
  className,
  delay = 0,
  offset = 10,
  direction = "up",
  inView = false,
  duration = 0.45,
  ...props
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-36px" });
  const reduceMotion = useReducedMotion();
  const axis = direction === "left" || direction === "right" ? "x" : "y";
  const start = direction === "right" || direction === "down" ? -offset : offset;

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={reduceMotion ? false : { opacity: 0, filter: "blur(8px)", [axis]: start }}
      animate={reduceMotion || !inView || isInView ? { opacity: 1, filter: "blur(0px)", [axis]: 0 } : undefined}
      transition={{ duration, delay: 0.035 + delay, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
