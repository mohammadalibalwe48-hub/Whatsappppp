"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";
import { cn } from "@/lib/utils";

interface NumberTickerProps extends React.ComponentPropsWithoutRef<"span"> {
  value: number;
  delay?: number;
  decimalPlaces?: number;
}

export function NumberTicker({ value, delay = 0, decimalPlaces = 0, className, ...props }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 54, stiffness: 100 });
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const timer = window.setTimeout(() => motionValue.set(value), delay * 1000);
    return () => window.clearTimeout(timer);
  }, [delay, isInView, motionValue, value]);

  useEffect(() => springValue.on("change", (latest) => {
    if (ref.current) {
      ref.current.textContent = Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces
      }).format(Number(latest.toFixed(decimalPlaces)));
    }
  }), [decimalPlaces, springValue]);

  return <span ref={ref} className={cn("inline-block tabular-nums", className)} {...props}>0</span>;
}
