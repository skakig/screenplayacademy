// @vitest-environment jsdom
/**
 * End-to-end blind-round leak test for the AuthorshipRail surface.
 *
 * Renders a full "voting room" — three writers with distinct names, roles,
 * and avatar URLs, wrapped in an AuthorshipRail each — and asserts that
 * during a blind round NONE of the following ever expose a name, role, or
 * avatar:
 *
 *   1. The visible chip label + subtitle (role slot).
 *   2. The chip's aria-label and aria-describedby surface.
 *   3. Any tooltip/popover triggered by hover, focus, click, or Enter/Space.
 *   4. The avatar <img alt>/<img src> pair — no profile photos leak either.
 *   5. Rail / tint / chip background colors — must collapse to the neutral
 *      slot for every writer.
 *
 * Then flips the same rows to reveal=true and asserts identities DO surface —
 * proving the blind assertions were meaningful and not passing because the
 * component happened to render nothing.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthorshipRail } from "./AuthorshipRail";
import { buildAuthorshipPalette, NEUTRAL_AUTHORSHIP_COLOR } from "./authorshipPalette";
import { roleLabel } from "@/components/writers-room/roles";
import { t } from "@/lib/i18n/t";

const SESSION_ID = "blind-e2e-session";

interface Writer {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

const WRITERS: Writer[] = [
  { id: "u-alice", name: "Alice Hart", role: "co_writer", avatar: "https://cdn.example/avatars/alice.png" },
  { id: "u-brian", name: "Brian Okafor", role: "director", avatar: "https://cdn.example/avatars/brian.png" },
  { id: "u-cora", name: "Cora Singh", role: "producer", avatar: "https://cdn.example/avatars/cora.png" },
];

const palette = buildAuthorshipPalette(
  SESSION_ID,
  WRITERS.map((w) => w.id),
);

function Room({ blind }: { blind: boolean }) {
  return (
    <div data-testid="voting-room">
      {WRITERS.map((w, i) => (
        <AuthorshipRail
          key={w.id}
          color={palette.get(w.id)!}
          displayName={w.name}
          role={w.role}
          avatarUrl={w.avatar}
          anonymousLabel={t("arena.identity.anonymousLabel", { n: i + 1 })}
          blind={blind}
        >
          <p data-testid={`entry-body-${w.id}`}>Entry body from writer {i + 1}</p>
        </AuthorshipRail>
      ))}
    </div>
  );
}

/** Every leak sentinel we assert against, per writer. */
function leakStringsFor(w: Writer): string[] {
  return [
    w.name,
    ...w.name.split(/\s+/), // first + last name tokens
    w.role,
    roleLabel(w.role),
    w.avatar,
  ];
}

afterEach(() => cleanup());

describe("AuthorshipRail — blind round leak audit (e2e)", () => {
  it("renders NO name, role, avatar URL, or role chip anywhere in the blind DOM", () => {
    render(<Room blind />);
    const room = screen.getByTestId("voting-room");
    const html = room.innerHTML;
    const textContent = room.textContent ?? "";

    for (const w of WRITERS) {
      for (const leak of leakStringsFor(w)) {
        expect(
          html.includes(leak),
          `blind DOM must not contain "${leak}" (writer ${w.id})`,
        ).toBe(false);
        expect(
          textContent.includes(leak),
          `blind visible text must not contain "${leak}" (writer ${w.id})`,
        ).toBe(false);
      }
    }

    // Positive assertions: anonymous labels appear, entry bodies still render.
    expect(textContent).toContain("Writer #1");
    expect(textContent).toContain("Writer #2");
    expect(textContent).toContain("Writer #3");
    for (const w of WRITERS) {
      expect(screen.getByTestId(`entry-body-${w.id}`)).toBeTruthy();
    }
  });

  it("chip aria-labels only expose the localized hidden sentence — never a name or role", () => {
    render(<Room blind />);
    const hidden = t("arena.identity.hiddenAria");
    const byAriaHead = t("arena.identity.byAria", { name: "___SENTINEL___" }).split("___SENTINEL___")[0];

    const labelled = document.querySelectorAll("[aria-label]");
    // Three writers → at least three chip aria-labels present.
    expect(labelled.length).toBeGreaterThanOrEqual(3);

    for (const el of Array.from(labelled)) {
      const label = el.getAttribute("aria-label") ?? "";
      // No writer name / role / role-label leaks into any aria-label.
      for (const w of WRITERS) {
        for (const leak of leakStringsFor(w)) {
          expect(
            label.includes(leak),
            `aria-label leaked "${leak}": "${label}"`,
          ).toBe(false);
        }
      }
    }

    // At least one aria-label is the hidden sentence and none use the
    // "Written by ..." template.
    const labels = Array.from(labelled).map((el) => el.getAttribute("aria-label") ?? "");
    expect(labels).toContain(hidden);
    expect(labels.some((l) => l.startsWith(byAriaHead))).toBe(false);
  });

  it("no profile <img> is rendered while blind — avatars fall back to the silhouette glyph", () => {
    render(<Room blind />);
    // No AvatarImage should mount for a blind row (guarded by `!blind &&`).
    expect(document.querySelectorAll("img").length).toBe(0);
    // The silhouette glyph (lucide UserRound, marked aria-hidden) is present.
    const hiddenSvgs = document.querySelectorAll('svg[aria-hidden="true"]');
    expect(hiddenSvgs.length).toBeGreaterThanOrEqual(WRITERS.length);
  });

  it("rail, tint, and chip background all collapse to the neutral slot for every writer", () => {
    render(<Room blind />);
    const html = document.body.innerHTML;
    // Neutral palette markers appear (rail + tint + chip bg).
    expect(html).toContain(NEUTRAL_AUTHORSHIP_COLOR.rail);
    expect(html).toContain(NEUTRAL_AUTHORSHIP_COLOR.tint);
    expect(html).toContain(NEUTRAL_AUTHORSHIP_COLOR.chip);
    // Assigned per-writer hues MUST NOT appear.
    for (const w of WRITERS) {
      const c = palette.get(w.id)!;
      expect(html.includes(c.rail), `rail hue leaked for ${w.id}`).toBe(false);
      expect(html.includes(c.tint), `tint hue leaked for ${w.id}`).toBe(false);
      expect(html.includes(c.chip), `chip hue leaked for ${w.id}`).toBe(false);
    }
  });

  it("hover, click, focus, Enter, and Space do NOT open a popover or reveal any name/role", async () => {
    const user = userEvent.setup();
    render(<Room blind />);
    const room = screen.getByTestId("voting-room");

    // No focusable identity trigger exists at all in blind mode.
    expect(within(room).queryAllByRole("button").length).toBe(0);

    // Try every reveal gesture on every chip and re-assert nothing surfaced.
    const chips = room.querySelectorAll('[aria-label="' + t("arena.identity.hiddenAria") + '"]');
    expect(chips.length).toBe(WRITERS.length);

    for (const chip of Array.from(chips)) {
      const el = chip as HTMLElement;
      await user.hover(el);
      await user.click(el);
      el.focus();
      await user.keyboard("{Enter}");
      await user.keyboard(" ");
      await user.unhover(el);
    }

    // Radix Popover mounts content into document.body via a portal; asserting
    // on the whole document catches any that leaked out of the room subtree.
    const docHtml = document.body.innerHTML;
    const docText = document.body.textContent ?? "";
    for (const w of WRITERS) {
      for (const leak of leakStringsFor(w)) {
        expect(
          docHtml.includes(leak),
          `post-interaction DOM leaked "${leak}"`,
        ).toBe(false);
        expect(
          docText.includes(leak),
          `post-interaction text leaked "${leak}"`,
        ).toBe(false);
      }
    }
    // And no popover role appeared anywhere in the document.
    expect(document.querySelectorAll('[role="dialog"], [data-radix-popper-content-wrapper]').length).toBe(0);
  });

  it("flipping the same rows to reveal=true DOES surface names, roles, and avatars — proving the blind assertions are meaningful", () => {
    render(<Room blind={false} />);
    const room = screen.getByTestId("voting-room");
    const text = room.textContent ?? "";
    const html = room.innerHTML;

    for (const w of WRITERS) {
      expect(text).toContain(w.name);
      expect(text).toContain(roleLabel(w.role));
      expect(html).toContain(w.avatar);
      const c = palette.get(w.id)!;
      expect(html).toContain(c.rail);
    }
    // Neutral rail no longer used as the primary hue for every row.
    expect(within(room).getAllByRole("button").length).toBe(WRITERS.length);
  });
});
