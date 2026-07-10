/**
 * Accessibility tests for AuthorshipRail.
 *
 * We render the component to static markup and assert on the ARIA surface:
 *   - blind rows expose the "hidden until results" aria-label and MUST NOT
 *     wrap the identity chip in a focusable Popover trigger (there's nothing
 *     to reveal, so no keyboard-actionable button should exist for identity).
 *   - revealed rows expose a "Written by <name>" aria-label, wrap the chip in
 *     a real <button type="button"> so keyboard users can open the details
 *     popover, and that button carries focus-visible styling.
 *   - the role chip renders the localized role label when revealed and is
 *     omitted while blind.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthorshipRail } from "./AuthorshipRail";
import { NEUTRAL_AUTHORSHIP_COLOR, buildAuthorshipPalette } from "./authorshipPalette";
import { t } from "@/lib/i18n/t";
import { roleLabel } from "@/components/writers-room/roles";

const SESSION_ID = "session-a11y";
const USER_ID = "user-1";
const palette = buildAuthorshipPalette(SESSION_ID, [USER_ID]);
const color = palette.get(USER_ID)!;

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

describe("AuthorshipRail accessibility", () => {
  it("blind entry uses the hidden aria-label and does not expose a keyboard trigger", () => {
    const html = render(
      <AuthorshipRail
        color={color}
        displayName="Alice Hart"
        role="co_writer"
        anonymousLabel={t("arena.identity.anonymousLabel", { n: 2 })}
        blind
      >
        <p>entry body</p>
      </AuthorshipRail>,
    );

    // Anonymous label is what sighted users see.
    expect(html).toContain("Writer #2");
    // Screen readers get the hidden-writer sentence.
    expect(html).toContain(`aria-label="${t("arena.identity.hiddenAria")}"`);
    // Real name and role must not leak while blind.
    expect(html).not.toContain("Alice Hart");
    expect(html).not.toContain(roleLabel("co_writer"));
    // No focusable button around the identity chip — nothing to reveal.
    expect(html).not.toMatch(/<button[^>]*type="button"/);
    // Rail collapses to neutral color while blind.
    expect(html).toContain(NEUTRAL_AUTHORSHIP_COLOR.rail);
    expect(html).not.toContain(color.rail);
  });

  it("revealed entry exposes name aria-label, keyboard-focusable trigger, and role chip", () => {
    const html = render(
      <AuthorshipRail
        color={color}
        displayName="Alice Hart"
        avatarUrl={null}
        role="co_writer"
      >
        <p>entry body</p>
      </AuthorshipRail>,
    );

    const expectedAria = t("arena.identity.byAria", { name: "Alice Hart" });
    expect(html).toContain(`aria-label="${expectedAria}"`);
    expect(html).toContain("Alice Hart");
    expect(html).toContain(roleLabel("co_writer"));

    // Popover trigger renders as a real button so Tab/Enter/Space work.
    const triggerMatch = html.match(/<button[^>]*type="button"[^>]*>/);
    expect(triggerMatch, "expected a <button type=\"button\"> around the chip").not.toBeNull();
    // And carries visible focus styling for keyboard users.
    expect(triggerMatch![0]).toMatch(/focus-visible:ring/);
    expect(triggerMatch![0]).toMatch(/focus:outline-none/);

    // Rail uses the writer's assigned hue, not the neutral fallback.
    expect(html).toContain(color.rail);
    expect(html).not.toContain(NEUTRAL_AUTHORSHIP_COLOR.rail);
  });

  it("self view renders the 'You' label instead of the writer's name", () => {
    const html = render(
      <AuthorshipRail
        color={color}
        displayName="Alice Hart"
        role="co_writer"
        isSelf
      >
        <p>entry body</p>
      </AuthorshipRail>,
    );

    const expectedAria = t("arena.identity.byAria", { name: t("arena.identity.you") });
    expect(html).toContain(`aria-label="${expectedAria}"`);
    // Chip label is "You"; initials still come from the real name (AH).
    expect(html).toContain(">You<");
    expect(html).toContain(">AH<");
  });

  it("blind → revealed transition with missing identity falls back to i18n 'Unknown writer' / 'Project member'", () => {
    // Simulate an entry whose profile lookup failed: no displayName, no role,
    // no avatar. This happens when a member was removed from the project
    // between submission and finalize, or when the identity RPC returns a
    // partial row. The rail must still transition cleanly from blind to
    // revealed without leaking placeholder English or crashing.
    const unknownFallback = t("arena.identity.unknown");
    const roleUnknownFallback = t("arena.identity.roleUnknown");
    const anonymousLabel = t("arena.identity.anonymousLabel", { n: 3 });

    // ---- Blind phase: identity is redacted regardless of missing profile.
    const blindHtml = render(
      <AuthorshipRail
        color={color}
        displayName=""
        role={null}
        anonymousLabel={anonymousLabel}
        blind
      >
        <p>entry body</p>
      </AuthorshipRail>,
    );
    expect(blindHtml).toContain(anonymousLabel);
    expect(blindHtml).toContain(`aria-label="${t("arena.identity.hiddenAria")}"`);
    // Fallbacks must not leak while blind — the anonymous label is the only
    // identity string sighted users see.
    expect(blindHtml).not.toContain(unknownFallback);
    expect(blindHtml).not.toContain(roleUnknownFallback);
    // Rail stays muted/neutral.
    expect(blindHtml).toContain(NEUTRAL_AUTHORSHIP_COLOR.rail);

    // ---- Revealed phase: identity resolves to i18n fallbacks, not blank
    // or raw English literals in JSX.
    const revealedHtml = render(
      <AuthorshipRail
        color={color}
        displayName=""
        role={null}
        avatarUrl={null}
      >
        <p>entry body</p>
      </AuthorshipRail>,
    );

    // Chip label uses the localized "Unknown writer" string.
    expect(revealedHtml).toContain(unknownFallback);
    // Aria-label mirrors it via the byAria template.
    expect(revealedHtml).toContain(
      `aria-label="${t("arena.identity.byAria", { name: unknownFallback })}"`,
    );
    // Role slot in the chip is intentionally omitted when role is null (the
    // popover detail surfaces the localized "Project member" fallback on
    // hover/focus; it isn't rendered in static markup until opened).
    expect(revealedHtml).not.toContain(roleUnknownFallback);
    expect(revealedHtml).not.toMatch(/co_writer|producer|director/);
    // markup — the transition swaps identity cleanly.
    expect(revealedHtml).not.toContain(anonymousLabel);
    // Rail switches from neutral to the writer's assigned hue.
    expect(revealedHtml).toContain(color.rail);
    expect(revealedHtml).not.toContain(NEUTRAL_AUTHORSHIP_COLOR.rail);
    // Keyboard trigger is still present so the (empty-profile) row is
    // navigable and doesn't break the reveal interaction.
    expect(revealedHtml).toMatch(/<button[^>]*type="button"[^>]*focus-visible:ring/);
  });
});
