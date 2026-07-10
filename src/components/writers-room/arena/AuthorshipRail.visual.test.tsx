/**
 * Visual regression test for AuthorshipRail.
 *
 * The rail's visual output is fully driven by inline `style` values produced
 * in pure JS by `authorshipPalette` (OKLCH strings + hex initials chip). No
 * part of the rendered chrome depends on browser CSS variable resolution,
 * user-agent stylesheets, or font metrics, so a static-markup snapshot is a
 * reliable proxy for cross-browser pixel stability: if the same
 * (sessionId, userId) tuple produces the same DOM + inline colors, every
 * browser paints the same rail and chip.
 *
 * The test locks two invariants:
 *   1. Snapshot the exact markup for blind / revealed / self / unknown
 *      states. Any drift in initials, rail hue, tint, chip color, or ARIA
 *      surface fails the snapshot and needs an intentional update.
 *   2. Determinism sweep: render the same three-writer round under every
 *      permutation of the writer-id list and assert the emitted color
 *      strings are identical per writer — proving submission / display
 *      order can never shift what a browser paints.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthorshipRail } from "./AuthorshipRail";
import {
  NEUTRAL_AUTHORSHIP_COLOR,
  buildAuthorshipPalette,
} from "./authorshipPalette";
import { t } from "@/lib/i18n/t";

const SESSION_ID = "session-visual";
const HOST_ID = "user-host";
const WRITER_ID = "user-writer";
const THIRD_ID = "user-third";

const palette = buildAuthorshipPalette(SESSION_ID, [
  HOST_ID,
  WRITER_ID,
  THIRD_ID,
]);
const hostColor = palette.get(HOST_ID)!;
const writerColor = palette.get(WRITER_ID)!;

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

describe("AuthorshipRail visual regression", () => {
  it("blind entry snapshot — neutral rail, anonymous label, no identity leak", () => {
    const html = render(
      <AuthorshipRail
        color={hostColor}
        displayName="Ava Host"
        role="co_writer"
        anonymousLabel={t("arena.identity.anonymousLabel", { n: 1 })}
        blind
      >
        <p>entry body</p>
      </AuthorshipRail>,
    );
    expect(html).toMatchSnapshot();
    // Belt-and-braces guards so a snapshot update never silently leaks color.
    expect(html).toContain(NEUTRAL_AUTHORSHIP_COLOR.rail);
    expect(html).not.toContain(hostColor.rail);
  });

  it("revealed entry snapshot — writer hue, initials, keyboard trigger", () => {
    const html = render(
      <AuthorshipRail
        color={writerColor}
        displayName="Wren Writer"
        avatarUrl={null}
        role="co_writer"
      >
        <p>entry body</p>
      </AuthorshipRail>,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain(writerColor.rail);
    expect(html).toContain(writerColor.tint);
    expect(html).toContain(writerColor.chip);
    expect(html).toContain(">WW<");
  });

  it("self view snapshot — 'You' chip label with real initials preserved", () => {
    const html = render(
      <AuthorshipRail
        color={hostColor}
        displayName="Ava Host"
        role="co_writer"
        isSelf
      >
        <p>entry body</p>
      </AuthorshipRail>,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain(">You<");
    expect(html).toContain(">AH<");
  });

  it("missing-identity revealed snapshot — 'Unknown writer' fallback with hue intact", () => {
    const html = render(
      <AuthorshipRail
        color={writerColor}
        displayName=""
        role={null}
        avatarUrl={null}
      >
        <p>entry body</p>
      </AuthorshipRail>,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain(t("arena.identity.unknown"));
    expect(html).toContain(writerColor.rail);
  });

  it("deterministic palette — every writer keeps the same rendered color strings across all id-order permutations", () => {
    // Canonical rendering, natural id order.
    const canonicalPalette = buildAuthorshipPalette(SESSION_ID, [
      HOST_ID,
      WRITER_ID,
      THIRD_ID,
    ]);
    const canonicalRender = (uid: string) => {
      const color = canonicalPalette.get(uid)!;
      return render(
        <AuthorshipRail
          color={color}
          displayName={`writer-${uid}`}
          role="co_writer"
        >
          <p>{uid}</p>
        </AuthorshipRail>,
      );
    };
    const canonical: Record<string, string> = {
      [HOST_ID]: canonicalRender(HOST_ID),
      [WRITER_ID]: canonicalRender(WRITER_ID),
      [THIRD_ID]: canonicalRender(THIRD_ID),
    };

    // Snapshot the canonical set once — future runs (any browser, any OS)
    // must produce byte-identical markup for the same inputs.
    expect(canonical).toMatchSnapshot();

    // Sweep every permutation of the writer-id ordering. The rail /
    // tint / chip color strings for each writer must be identical to the
    // canonical rendering — order of submission cannot shift any pixel.
    const perms: string[][] = [
      [HOST_ID, WRITER_ID, THIRD_ID],
      [HOST_ID, THIRD_ID, WRITER_ID],
      [WRITER_ID, HOST_ID, THIRD_ID],
      [WRITER_ID, THIRD_ID, HOST_ID],
      [THIRD_ID, HOST_ID, WRITER_ID],
      [THIRD_ID, WRITER_ID, HOST_ID],
    ];
    for (const order of perms) {
      const permPalette = buildAuthorshipPalette(SESSION_ID, order);
      for (const uid of [HOST_ID, WRITER_ID, THIRD_ID]) {
        const color = permPalette.get(uid)!;
        const html = render(
          <AuthorshipRail
            color={color}
            displayName={`writer-${uid}`}
            role="co_writer"
          >
            <p>{uid}</p>
          </AuthorshipRail>,
        );
        expect(
          html,
          `perm ${order.join(">")} · ${uid} drifted from canonical`,
        ).toBe(canonical[uid]);
      }
    }
  });
});
