"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

interface ShineBorderProps {
  borderWidth?: number;
  /** Seconds per sweep. */
  duration?: number;
  color?: string | string[];
  className?: string;
}

/**
 * Shine Border from 21st.dev (magicui), reworked as an overlay for Tailwind v4:
 * drop it inside any `relative` rounded container.
 */
export function ShineBorder({
  borderWidth = 1,
  duration = 14,
  color = "#ffffff",
  className,
}: ShineBorderProps) {
  const colors = Array.isArray(color) ? color.join(",") : color;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] will-change-[background-position] motion-safe:animate-[shine_var(--shine-duration)_infinite_linear]",
        className
      )}
      style={
        {
          "--shine-duration": `${duration}s`,
          padding: borderWidth,
          backgroundImage: `radial-gradient(transparent, transparent, ${colors}, transparent, transparent)`,
          backgroundSize: "300% 300%",
          mask: "linear-gradient(#fff 0 0) content-box exclude, linear-gradient(#fff 0 0)",
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
        } as CSSProperties
      }
    />
  );
}
