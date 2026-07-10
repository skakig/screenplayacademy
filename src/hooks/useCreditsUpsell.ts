import { create } from "zustand";
import type { CreditFeature } from "@/lib/creditPacks";
import { upsellFeatureFor } from "@/lib/creditPacks";

interface CreditsUpsellState {
  open: boolean;
  focus: CreditFeature | null;
  openDialog: (focus?: CreditFeature | null) => void;
  closeDialog: () => void;
  /**
   * Parse a `USAGE_LIMIT: <feature> ...` server error and, if it matches a
   * feature that credits can resolve, open the buy dialog focused on the
   * right tab. Returns true when the upsell was surfaced.
   */
  offerFromError: (message: string) => boolean;
}

const USAGE_LIMIT_RE = /USAGE_LIMIT:\s*(\w+)/i;

export const useCreditsUpsell = create<CreditsUpsellState>((set) => ({
  open: false,
  focus: null,
  openDialog: (focus = null) => set({ open: true, focus: focus ?? null }),
  closeDialog: () => set({ open: false }),
  offerFromError: (message: string) => {
    const match = USAGE_LIMIT_RE.exec(message ?? "");
    if (!match) return false;
    const feature = upsellFeatureFor(match[1]);
    if (!feature) return false;
    set({ open: true, focus: feature });
    return true;
  },
}));
