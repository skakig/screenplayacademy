// Character Bible PDF — portrait-driven character dossier + full world tiers
// (locations, factions, events, artifacts, rules, threads, timeline).
// Portrait A4, browser-only (jsPDF).

import { jsPDF } from "jspdf";
import { format } from "date-fns";
import type {
  BibleExportPayload,
  BibleExportWorldEntity,
} from "@/lib/importation/character-bible-export.functions";

const PAGE = { w: 595.28, h: 841.89 }; // A4 portrait, pt
const M = 48;
const CONTENT_W = PAGE.w - M * 2;

// ---- Portrait fetch → base64 (browser only) ----
async function fetchImageDataUrl(
  url: string,
): Promise<{ dataUrl: string; format: "JPEG" | "PNG" } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const format =
      blob.type.includes("png") || url.toLowerCase().endsWith(".png")
        ? "PNG"
        : "JPEG";
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return { dataUrl, format };
  } catch {
    return null;
  }
}

// ---- Shared page helpers ----
function footer(doc: jsPDF, label: string, page: number, total: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(label, M, PAGE.h - 20);
  doc.text(`${page} / ${total}`, PAGE.w - M, PAGE.h - 20, { align: "right" });
  doc.setTextColor(0);
}

function ensureRoom(doc: jsPDF, y: number, needed: number, header: () => void) {
  if (y + needed > PAGE.h - M - 24) {
    doc.addPage();
    header();
    return M + 60;
  }
  return y;
}

// ---- Cover ----
function drawCover(doc: jsPDF, payload: BibleExportPayload) {
  doc.setFillColor(20, 20, 28);
  doc.rect(0, 0, PAGE.w, PAGE.h, "F");
  doc.setFillColor(210, 170, 90);
  doc.rect(0, PAGE.h - 8, PAGE.w, 8, "F");

  doc.setTextColor(210, 170, 90);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("CHARACTER BIBLE", M, M + 8);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  const titleLines = doc.splitTextToSize(
    payload.project.title ?? "Untitled Project",
    CONTENT_W,
  );
  doc.text(titleLines, M, M + 70);

  if (payload.universe.name) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(14);
    doc.setTextColor(210, 170, 90);
    doc.text(
      `Universe · ${payload.universe.name}`,
      M,
      M + 70 + titleLines.length * 38 + 6,
    );
  }

  doc.setTextColor(220, 220, 220);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    `Version v${payload.bible.version} · Generated ${format(new Date(payload.bible.created_at), "MMMM d, yyyy")}`,
    M,
    PAGE.h / 2 - 20,
  );

  if (payload.bible.summary) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(12);
    doc.setTextColor(230, 230, 230);
    const lines = doc.splitTextToSize(payload.bible.summary, CONTENT_W - 20);
    doc.text(lines, M, PAGE.h / 2);
  }

  doc.setTextColor(180, 180, 180);
  doc.setFontSize(9);
  const counts = [
    `${payload.bible.entries.length} character${payload.bible.entries.length === 1 ? "" : "s"}`,
    `${payload.world.locations.length} locations`,
    `${payload.world.factions.length} factions`,
    `${payload.world.events.length} events`,
  ].join("  ·  ");
  doc.text(counts, M, PAGE.h - 40);
  doc.setTextColor(0);
}

// ---- Section header ----
function drawSectionHeader(doc: jsPDF, title: string) {
  doc.setFillColor(245, 243, 238);
  doc.rect(0, 0, PAGE.w, 56, "F");
  doc.setFillColor(210, 170, 90);
  doc.rect(M, 44, 40, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 28);
  doc.text(title, M, 32);
  doc.setTextColor(0);
}

// ---- Character entry ----
async function drawCharacterEntry(
  doc: jsPDF,
  entry: BibleExportPayload["bible"]["entries"][number],
  portraitUrl: string | null,
) {
  const header = () => drawSectionHeader(doc, "Cast");
  doc.addPage();
  header();

  let y = M + 40;

  // Portrait
  const PORTRAIT_W = 160;
  const PORTRAIT_H = 200;
  const textLeft = portraitUrl ? M + PORTRAIT_W + 20 : M;
  const textWidth = portraitUrl ? CONTENT_W - PORTRAIT_W - 20 : CONTENT_W;

  if (portraitUrl) {
    const img = await fetchImageDataUrl(portraitUrl);
    if (img) {
      try {
        doc.addImage(img.dataUrl, img.format, M, y, PORTRAIT_W, PORTRAIT_H);
      } catch {
        // ignore — bad image bytes
      }
    } else {
      doc.setDrawColor(210);
      doc.rect(M, y, PORTRAIT_W, PORTRAIT_H);
      doc.setFontSize(9);
      doc.setTextColor(160);
      doc.text("Portrait unavailable", M + 20, y + PORTRAIT_H / 2);
      doc.setTextColor(0);
    }
  }

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 28);
  const nameLines = doc.splitTextToSize(entry.name, textWidth);
  doc.text(nameLines, textLeft, y + 18);
  let ty = y + 18 + nameLines.length * 22;

  if (entry.importance) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(140, 110, 60);
    doc.text(entry.importance.toUpperCase(), textLeft, ty);
    ty += 14;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  const stats = [
    `${entry.speaking_segments ?? 0} speaking`,
    `${entry.mention_segments ?? 0} mentions`,
  ];
  if (entry.first_appearance) {
    stats.push(
      `First: ${entry.first_appearance.heading ?? "—"} (seq ${entry.first_appearance.sequence})`,
    );
  }
  doc.text(stats.join("   ·   "), textLeft, ty);
  ty += 16;

  if (entry.aliases.length > 0) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(90);
    const aliasLines = doc.splitTextToSize(
      `Also known as: ${entry.aliases.join(", ")}`,
      textWidth,
    );
    doc.text(aliasLines, textLeft, ty);
    ty += aliasLines.length * 12 + 4;
  }
  doc.setTextColor(0);

  // Evidence — allowed to flow below the portrait block.
  const belowPortrait = y + PORTRAIT_H + 20;
  let ey = Math.max(ty + 10, belowPortrait);

  if (entry.top_evidence.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 28);
    ey = ensureRoom(doc, ey, 20, header);
    doc.text("EVIDENCE", M, ey);
    ey += 14;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(50);
    for (const ev of entry.top_evidence) {
      const line = `"${ev.excerpt}"  (${Math.round((ev.confidence ?? 0) * 100)}%)`;
      const lines = doc.splitTextToSize(line, CONTENT_W - 12);
      for (const l of lines) {
        ey = ensureRoom(doc, ey, 12, header);
        doc.text(l, M + 10, ey);
        ey += 12;
      }
      ey += 4;
    }
    doc.setTextColor(0);
  }
}

// ---- World section (list of entities) ----
function drawWorldSection(
  doc: jsPDF,
  title: string,
  items: BibleExportWorldEntity[],
) {
  if (items.length === 0) return;
  const header = () => drawSectionHeader(doc, title);
  doc.addPage();
  header();

  let y = M + 40;

  for (const item of items) {
    // name line
    y = ensureRoom(doc, y, 30, header);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 28);
    doc.text(item.name, M, y);

    if (item.extra) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(140);
      doc.text(item.extra, PAGE.w - M, y, { align: "right" });
    }
    y += 14;

    if (item.description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(50);
      const lines = doc.splitTextToSize(item.description, CONTENT_W);
      for (const l of lines) {
        y = ensureRoom(doc, y, 12, header);
        doc.text(l, M, y);
        y += 12;
      }
    }
    y += 8;
    doc.setTextColor(0);
  }
}

// ---- Table of Contents ----
function drawToc(doc: jsPDF, payload: BibleExportPayload) {
  doc.addPage();
  drawSectionHeader(doc, "Contents");
  let y = M + 40;
  const rows: [string, number][] = [
    ["Cast", payload.bible.entries.length],
    ["Locations", payload.world.locations.length],
    ["Factions", payload.world.factions.length],
    ["Events", payload.world.events.length],
    ["Artifacts", payload.world.artifacts.length],
    ["Rules", payload.world.rules.length],
    ["Threads", payload.world.threads.length],
    ["Timeline", payload.world.timeline.length],
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  for (const [label, count] of rows) {
    doc.setTextColor(20, 20, 28);
    doc.text(label, M, y);
    doc.setTextColor(140);
    doc.text(`${count}`, PAGE.w - M, y, { align: "right" });
    y += 20;
  }
  doc.setTextColor(0);
}

// ---- Public entry point ----
export async function generateCharacterBiblePdf(
  payload: BibleExportPayload,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

  drawCover(doc, payload);
  drawToc(doc, payload);

  const portraitById = new Map(
    payload.portraits.map((p) => [p.character_id, p.portrait_url] as const),
  );

  for (const entry of payload.bible.entries) {
    // eslint-disable-next-line no-await-in-loop
    await drawCharacterEntry(
      doc,
      entry,
      portraitById.get(entry.character_id) ?? null,
    );
  }

  drawWorldSection(doc, "Locations", payload.world.locations);
  drawWorldSection(doc, "Factions", payload.world.factions);
  drawWorldSection(doc, "Events", payload.world.events);
  drawWorldSection(doc, "Artifacts", payload.world.artifacts);
  drawWorldSection(doc, "Rules", payload.world.rules);
  drawWorldSection(doc, "Threads", payload.world.threads);
  drawWorldSection(doc, "Timeline", payload.world.timeline);

  const total = doc.getNumberOfPages();
  const label = `${payload.project.title ?? "Character Bible"} · v${payload.bible.version}`;
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    footer(doc, label, p, total);
  }

  return doc;
}

export async function downloadCharacterBiblePdf(
  payload: BibleExportPayload,
  filename?: string,
) {
  const doc = await generateCharacterBiblePdf(payload);
  const safe = (payload.project.title || "character-bible").replace(
    /[^a-z0-9]+/gi,
    "_",
  );
  doc.save(filename ?? `${safe}-character-bible-v${payload.bible.version}.pdf`);
}
