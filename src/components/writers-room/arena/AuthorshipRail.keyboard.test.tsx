// @vitest-environment jsdom
/**
 * End-to-end keyboard navigation test for AuthorshipRail.
 *
 * We render the rail between two sentinel anchor buttons (`before-anchor` and
 * `after-anchor`), then drive real Tab presses via @testing-library/user-event
 * to assert:
 *
 *   1. BLIND mode: the identity chip is NOT in the tab order (there's nothing
 *      to reveal), so Tab goes before-anchor → after-anchor. The chip has no
 *      focusable trigger and never becomes document.activeElement.
 *
 *   2. REVEALED mode: the identity chip IS a focusable <button>. Tab order
 *      is before-anchor → rail trigger → after-anchor, and when the trigger
 *      is focused its classList carries the Tailwind focus-visible ring
 *      utilities that provide the visible focus indicator.
 *
 * Shift+Tab reverses the order in both cases.
 */
import { describe, it, expect } from "vitest";
import { render, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthorshipRail } from "./AuthorshipRail";
import { buildAuthorshipPalette } from "./authorshipPalette";
import { t } from "@/lib/i18n/t";

const SESSION_ID = "session-kbd";
const USER_ID = "writer-1";
const palette = buildAuthorshipPalette(SESSION_ID, [USER_ID]);
const color = palette.get(USER_ID)!;

function Harness({ blind }: { blind: boolean }) {
  return (
    <div>
      <button type="button" data-testid="before-anchor">before</button>
      <AuthorshipRail
        color={color}
        displayName="Alice Hart"
        role="co_writer"
        avatarUrl={null}
        anonymousLabel={t("arena.identity.anonymousLabel", { n: 2 })}
        blind={blind}
      >
        <p>entry body</p>
      </AuthorshipRail>
      <button type="button" data-testid="after-anchor">after</button>
    </div>
  );
}

describe("AuthorshipRail keyboard navigation (e2e)", () => {
  it("BLIND mode: identity chip is skipped in the tab order", async () => {
    const user = userEvent.setup();
    const { getByTestId, container } = render(<Harness blind />);
    const before = getByTestId("before-anchor");
    const after = getByTestId("after-anchor");

    // No focusable identity trigger exists while blind.
    const railButtons = within(container).queryAllByRole("button");
    expect(railButtons.map((b) => b.getAttribute("data-testid"))).toEqual([
      "before-anchor",
      "after-anchor",
    ]);

    before.focus();
    expect(document.activeElement).toBe(before);

    // Tab forward — must land on the after-anchor, not any element inside the rail.
    await user.tab();
    expect(document.activeElement).toBe(after);

    // Shift+Tab back — must return to the before-anchor, not into the rail.
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(before);

    cleanup();
  });

  it("REVEALED mode: rail trigger is focusable and carries focus-visible ring styling", async () => {
    const user = userEvent.setup();
    const { getByTestId, container } = render(<Harness blind={false} />);
    const before = getByTestId("before-anchor");
    const after = getByTestId("after-anchor");

    // Locate the identity trigger by its aria-label ("Written by Alice Hart").
    const trigger = container.querySelector(
      `[aria-label="${t("arena.identity.byAria", { name: "Alice Hart" })}"]`,
    )?.closest("button");
    expect(trigger, "expected a <button> wrapping the identity chip").not.toBeNull();

    before.focus();
    expect(document.activeElement).toBe(before);

    // Tab forward — must land on the rail trigger.
    await user.tab();
    expect(document.activeElement).toBe(trigger);

    // Visible focus indicator: the focused element carries Tailwind's
    // focus-visible ring utilities and suppresses the default outline
    // (proxy for a visible focus style under our design tokens).
    const cls = (document.activeElement as HTMLElement).className;
    expect(cls).toMatch(/focus-visible:ring-2/);
    expect(cls).toMatch(/focus-visible:ring-ring/);
    expect(cls).toMatch(/focus:outline-none/);

    // Next Tab — must move to the after-anchor.
    await user.tab();
    expect(document.activeElement).toBe(after);

    // Shift+Tab back — must return through the rail trigger, then to before.
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(trigger);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(before);

    cleanup();
  });

  it("REVEALED mode with missing identity: fallback chip stays keyboard-reachable", async () => {
    // Empty displayName + null role must still expose a focusable trigger
    // (the "Unknown writer" chip) so keyboard users can open its popover.
    const user = userEvent.setup();
    const { getByTestId, container } = render(
      <div>
        <button type="button" data-testid="before-anchor">before</button>
        <AuthorshipRail color={color} displayName="" role={null} avatarUrl={null}>
          <p>entry body</p>
        </AuthorshipRail>
        <button type="button" data-testid="after-anchor">after</button>
      </div>,
    );
    const before = getByTestId("before-anchor");
    const after = getByTestId("after-anchor");
    const trigger = container.querySelector(
      `[aria-label="${t("arena.identity.byAria", { name: t("arena.identity.unknown") })}"]`,
    )?.closest("button");
    expect(trigger).not.toBeNull();

    before.focus();
    await user.tab();
    expect(document.activeElement).toBe(trigger);
    await user.tab();
    expect(document.activeElement).toBe(after);

    cleanup();
  });
});
