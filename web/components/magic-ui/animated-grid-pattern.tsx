"use client";

import { useCallback, useEffect, useId, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

interface Square { id: number; position: [number, number]; iteration: number }

interface AnimatedGridPatternProps extends ComponentPropsWithoutRef<"svg"> {
  cellSize?: number;
  squareCount?: number;
}

export function AnimatedGridPattern({ cellSize = 38, squareCount = 24, className, ...props }: AnimatedGridPatternProps) {
  const id = useId();
  const ref = useRef<SVGSVGElement>(null);
  const reduceMotion = useReducedMotion();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [squares, setSquares] = useState<Square[]>([]);

  const randomPosition = useCallback((): [number, number] => [
    Math.floor((Math.random() * dimensions.width) / cellSize),
    Math.floor((Math.random() * dimensions.height) / cellSize)
  ], [cellSize, dimensions.height, dimensions.width]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      setDimensions((current) => current.width === next.width && current.height === next.height ? current : next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;
    setSquares(Array.from({ length: squareCount }, (_, index) => ({ id: index, position: randomPosition(), iteration: 0 })));
  }, [dimensions.height, dimensions.width, randomPosition, squareCount]);

  const rerollSquare = useCallback((squareId: number) => {
    setSquares((current) => current.map((square) => square.id === squareId
      ? { ...square, position: randomPosition(), iteration: square.iteration + 1 }
      : square));
  }, [randomPosition]);

  return (
    <svg ref={ref} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 h-full w-full fill-primary/20 stroke-primary/15", className)} {...props}>
      <defs><pattern id={id} width={cellSize} height={cellSize} patternUnits="userSpaceOnUse"><path d={`M.5 ${cellSize}V.5H${cellSize}`} fill="none" /></pattern></defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
      {!reduceMotion && <svg x="0" y="0" className="overflow-visible">{squares.map(({ id: squareId, position: [x, y], iteration }) => (
        <motion.rect
          key={`${squareId}-${iteration}`}
          width={cellSize - 1}
          height={cellSize - 1}
          x={x * cellSize + 1}
          y={y * cellSize + 1}
          fill="currentColor"
          strokeWidth="0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.45 }}
          transition={{ duration: 1.4, repeat: 1, repeatType: "reverse", delay: squareId * 0.08, repeatDelay: 1.2 }}
          onAnimationComplete={() => rerollSquare(squareId)}
        />
      ))}</svg>}
    </svg>
  );
}
