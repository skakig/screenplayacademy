import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

type OpenCheckoutOptions = {
  priceId: string;
  quantity?: number;
  customerEmail?: string;
  customData?: Record<string, string>;
  successUrl?: string;
};

/**
 * Loading is cleared only when Paddle emits `checkout.closed` or `checkout.completed`
 * (or setup throws). This prevents the previous race where `loading` returned to
 * `false` inside a `finally` block before the overlay was even open, allowing
 * double-click submissions.
 */
export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: OpenCheckoutOptions) => {
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(options.priceId);

      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: options.quantity ?? 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: options.customData,
        settings: {
          displayMode: "overlay",
          successUrl: options.successUrl || `${window.location.origin}/checkout/success`,
          allowLogout: false,
          variant: "one-page",
        },
        eventCallback: (evt: { name?: string } | undefined) => {
          const name = evt?.name;
          if (name === "checkout.closed" || name === "checkout.completed" || name === "checkout.error") {
            setLoading(false);
          }
        },
      });
    } catch (e) {
      // Setup failed (bad token, price not found, network) — release the button.
      setLoading(false);
      throw e;
    }
  };

  return { openCheckout, loading };
}
