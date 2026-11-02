"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { cn } from "@/lib/utils";

interface NumberTickerProps extends React.ComponentPropsWithoutRef<"span"> {
  value: number;
  delay?: number;
  decimalPlaces?: number;
}

function formatNumber(value: number, decimalPlaces: number) {
  return Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  }).format(value);
}

export function NumberTicker({ value, delay = 0, decimalPlaces = 0, className, ...props }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 54, stiffness: 100 });
  const isInView = useInView(ref, { once: true });
  useEffect(() => {
    if (!isInView || reduceMotion) return;
    const timer = window.setTimeout(() => motionValue.set(value), delay * 1000);
    return () => window.clearTimeout(timer);
  }, [delay, isInView, motionValue, reduceMotion, value]);

  useEffect(() => {
    if (reduceMotion) return;
    return springValue.on("change", (latest) => {
      if (ref.current) ref.current.textContent = formatNumber(Number(latest.toFixed(decimalPlaces)), decimalPlaces);
    });
  }, [decimalPlaces, reduceMotion, springValue]);

  return <span ref={ref} className={cn("inline-block tabular-nums", className)} {...props}>{reduceMotion ? formatNumber(value, decimalPlaces) : "0"}</span>;
}
