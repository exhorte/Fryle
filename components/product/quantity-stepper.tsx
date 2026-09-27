"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  min?: number;
  max: number;
  onDecrement: () => void;
  onIncrement: () => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

export function QuantityStepper({ value, min = 1, max, onDecrement, onIncrement, label, size = "md", className }: Props) {
  const button = cn(
    "flex items-center justify-center rounded-full transition-colors hover:bg-background disabled:pointer-events-none disabled:opacity-35",
    size === "sm" ? "size-7" : "size-9",
  );
  return (
    <div
      role="group"
      aria-label={`Quantité, ${label}`}
      className={cn("inline-flex items-center gap-1 rounded-full bg-muted p-1", className)}
    >
      <button type="button" className={button} onClick={onDecrement} disabled={value <= min} aria-label="Retirer une unité">
        <Minus className="size-4" />
      </button>
      <span aria-live="polite" className={cn("text-center font-semibold tabular-nums", size === "sm" ? "w-6 text-sm" : "w-8")}>
        {value}
      </span>
      <button type="button" className={button} onClick={onIncrement} disabled={value >= max} aria-label="Ajouter une unité">
        <Plus className="size-4" />
      </button>
    </div>
  );
}
