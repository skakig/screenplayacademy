// PDF generation for the revision timeline and selected takes.
// Browser-only (uses jsPDF). Keep imports inside callable fns when needed.

import { jsPDF } from "jspdf";
import { format } from "date-fns";
import type { DraftPayload } from "./draftBackup";

export type PdfTake = {
  id: string;
  name: string;
  capturedAt: number;
  blockCount: number;
  wordCount: number;
  payload?: DraftPayload;
};

const PAGE = { w: 595.28, h: 841.89 }; // A4 pts
const M = 56;

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE.h - M) {
    doc.addPage();
    return M;
  }
  return y;
}

function header(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, M, M);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(subtitle, M, M + 16);
    doc.setTextColor(0);
  }
}

function renderTimeline(doc: jsPDF, takes: PdfTake[], startY: number): number {
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Revision Timeline", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`${takes.length} take(s) captured`, M, y);
  doc.setTextColor(0);
  y += 14;

  takes.forEach((t, i) => {
    y = ensureSpace(doc, y, 28);
    const num = String(takes.length - i).padStart(2, "0");
    doc.setDrawColor(180);
    doc.line(M, y, PAGE.w - M, y);
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`TAKE ${num}  ·  ${t.name}`, M, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    y += 12;
    doc.text(
      `${format(t.capturedAt, "MMM d, yyyy · HH:mm")}   ${t.wordCount.toLocaleString()} words   ${t.blockCount} lines`,
      M,
      y,
    );
    doc.setTextColor(0);
    y += 14;
  });

  return y;
}

function renderTake(doc: jsPDF, take: PdfTake, startY: number): number {
  let y = startY;
  y = ensureSpace(doc, y, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Take · ${take.name}`, M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    `${format(take.capturedAt, "MMM d, yyyy · HH:mm")}   ${take.wordCount.toLocaleString()} words`,
    M,
    y,
  );
  doc.setTextColor(0);
  y += 14;

  const blocks = take.payload?.blocks ?? [];
  doc.setFont("courier", "normal");
  doc.setFontSize(10);
  const usableW = PAGE.w - M * 2;

  for (const b of blocks) {
    const type = (b.block_type ?? "action").toLowerCase();
    const content = (b.content ?? "").trim();
    if (!content) continue;

    let indent = 0;
    let upper = false;
    if (type === "character") {
      indent = 130;
      upper = true;
    } else if (type === "dialogue") {
      indent = 70;
    } else if (type === "parenthetical") {
      indent = 100;
    } else if (type === "transition") {
      indent = 280;
      upper = true;
    } else if (type === "scene_heading") {
      upper = true;
      doc.setFont("courier", "bold");
    }

    const text = upper ? content.toUpperCase() : content;
    const lines = doc.splitTextToSize(text, usableW - indent);
    for (const line of lines) {
      y = ensureSpace(doc, y, 12);
      doc.text(line, M + indent, y);
      y += 12;
    }

    if (type === "scene_heading") doc.setFont("courier", "normal");
    y += 4;
  }
  return y;
}

export type GeneratePdfOptions = {
  projectTitle: string;
  takes: PdfTake[];
  selectedTakeIds: string[]; // takes whose payloads should be fully rendered
};

export function generatePitchKitPdf(opts: GeneratePdfOptions): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  header(
    doc,
    `${opts.projectTitle} — Revision History`,
    `Generated ${format(Date.now(), "MMM d, yyyy · HH:mm")}`,
  );
  let y = M + 40;
  y = renderTimeline(doc, opts.takes, y);

  const selected = opts.takes.filter((t) => opts.selectedTakeIds.includes(t.id) && t.payload);
  if (selected.length > 0) {
    doc.addPage();
    y = M;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Selected Takes", M, y);
    y += 24;
    selected.forEach((t, idx) => {
      if (idx > 0) {
        doc.addPage();
        y = M;
      }
      y = renderTake(doc, t, y);
    });
  }

  return doc;
}

export function downloadPitchKitPdf(opts: GeneratePdfOptions, filename = "revisions.pdf") {
  const doc = generatePitchKitPdf(opts);
  doc.save(filename);
}
