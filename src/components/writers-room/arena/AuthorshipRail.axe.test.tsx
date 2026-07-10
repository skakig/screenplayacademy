/**
 * Automated axe-core accessibility checks for AuthorshipRail.
 *
 * We render the component to static HTML, wrap it in a jsdom Document with
 * a proper landmark + heading scaffold (so axe doesn't fire spurious
 * page-level rules against a bare fragment), and run axe against the rail
 * subtree in both blind and revealed states — including the initials chip
 * and the role chip / role fallback.
 *
 * Runs under vitest's default `environment: "node"` by spinning up jsdom
 * on demand, so we don't have to flip the whole suite to jsdom.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import axe from "axe-core";
import { AuthorshipRail } from "./AuthorshipRail";
import { buildAuthorshipPalette } from "./authorshipPalette";
import { t } from "@/lib/i18n/t";

const SESSION_ID = "session-axe";
const USER_IDS = ["writer-1", "writer-2"];
const palette = buildAuthorshipPalette(SESSION_ID, USER_IDS);
const color = palette.get("writer-1")!;

function mountForAxe(markup: string): { dom: JSDOM; target: Element } {
  // A minimal valid page: single <main>, an <h1>, and our subtree inside.
  // This keeps landmark/heading rules from flagging the harness instead of
  // the component we're actually auditing.
  const dom = new JSDOM(
    `<!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>axe harness</title></head>
      <body>
        <main>
          <h1>Arena entry</h1>
          <div id="rail-root">${markup}</div>
        </main>
      </body>
    </html>`,
  );
  const target = dom.window.document.getElementById("rail-root")!;
  return { dom, target };
}

async function runAxe(markup: string): Promise<axe.AxeResults> {
  const { dom, target } = mountForAxe(markup);
  // axe-core reads window/document from the passed context.
  // Inject axe into the jsdom window so it uses the right globals.
  const win = dom.window as unknown as Window & typeof globalThis;
  // @ts-expect-error — axe uses its own global detection when run in node.
  return await axe.run(target, {
    // Keep the audit focused on the widget contract. Region/landmark rules
    // are validated by the harness scaffold above, not the component itself.
    resultTypes: ["violations"],
    rules: {
      region: { enabled: false },
    },
    // Pin context to the jsdom document to avoid leaking into vitest's env.
    // @ts-expect-error — internal option accepted by axe-core.
    ownerDocument: win.document,
  });
}

describe("AuthorshipRail axe-core audit", () => {
  it("has no accessibility violations in the BLIND state (initials hidden, anonymous label)", async () => {
    const html = renderToStaticMarkup(
      <AuthorshipRail
        color={color}
        displayName="Alice Hart"
        role="co_writer"
        anonymousLabel={t("arena.identity.anonymousLabel", { n: 2 })}
        blind
      >
        <p>entry body — blind</p>
      </AuthorshipRail>,
    );
    const results = await runAxe(html);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  it("has no accessibility violations in the REVEALED state (initials + role chip visible)", async () => {
    const html = renderToStaticMarkup(
      <AuthorshipRail
        color={color}
        displayName="Alice Hart"
        avatarUrl={null}
        role="co_writer"
      >
        <p>entry body — revealed</p>
      </AuthorshipRail>,
    );
    const results = await runAxe(html);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  it("has no accessibility violations in the REVEALED state with missing identity (i18n fallbacks)", async () => {
    // Empty displayName + null role exercises the "Unknown writer" /
    // "Project member" fallbacks and the empty-initials edge case.
    const html = renderToStaticMarkup(
      <AuthorshipRail
        color={color}
        displayName=""
        role={null}
        avatarUrl={null}
      >
        <p>entry body — unknown identity</p>
      </AuthorshipRail>,
    );
    const results = await runAxe(html);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  it("has no accessibility violations in the SELF-view revealed state", async () => {
    const html = renderToStaticMarkup(
      <AuthorshipRail
        color={color}
        displayName="Alice Hart"
        role="co_writer"
        isSelf
      >
        <p>entry body — self</p>
      </AuthorshipRail>,
    );
    const results = await runAxe(html);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
