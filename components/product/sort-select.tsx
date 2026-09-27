"use client";

import { SORT_OPTIONS, type SortValue } from "@/lib/catalog";

/** Tri : soumet le formulaire GET parent dès le changement (bouton de repli sans JavaScript). */
export function SortSelect({ value }: { value: SortValue }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Trier par</span>
      <select
        name="tri"
        defaultValue={value}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-10 rounded-full border bg-background px-4 pr-8 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
