// Pitch Deck PDF — renders the AI-generated pitch package as a slide deck.
// Landscape A4, one section per slide, cover slide first.
// Browser-only (jsPDF).

import { jsPDF } from "jspdf";
import { format } from "date-fns";

export type PitchDeckSection = { key: string; label: string; value: string };

export type PitchDeckBibleEntry = {
  name: string;
  importance?: string | null;
  aliases?: string[];
  first_appearance?: { heading: string | null; sequence: number } | null;
  speaking_segments?: number;
  mention_segments?: number;
  top_evidence?: { excerpt: string; confidence: number }[];
};

export type PitchDeckCharacterBible = {
  version: number;
  summary: string | null;
  created_at: string;
  entries: PitchDeckBibleEntry[];
};

export type PitchDeckOptions = {
  projectTitle: string;
  projectType?: string | null;
  genre?: string | null;
  tone?: string | null;
  logline?: string | null;
  sections: PitchDeckSection[];
  generatedAt?: string | null;
  characterBible?: PitchDeckCharacterBible | null;
};

// Landscape A4 in points
const PAGE = { w: 841.89, h: 595.28 };
const M = 56;
const CONTENT_W = PAGE.w - M * 2;

function drawFooter(doc: jsPDF, projectTitle: string, page: number, total: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(projectTitle, M, PAGE.h - 24);
  doc.text(`${page} / ${total}`, PAGE.w - M, PAGE.h - 24, { align: "right" });
  doc.setTextColor(0);
}

function drawCover(doc: jsPDF, opts: PitchDeckOptions) {
  // Accent bar
  doc.setFillColor(20, 20, 28);
  doc.rect(0, 0, PAGE.w, PAGE.h, "F");
  doc.setFillColor(210, 170, 90);
  doc.rect(0, PAGE.h - 8, PAGE.w, 8, "F");

  doc.setTextColor(230, 220, 200);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("PITCH DECK", M, M + 8);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(42);
  const titleLines = doc.splitTextToSize(opts.projectTitle || "Untitled Project", CONTENT_W);
  doc.text(titleLines, M, M + 70);

  const meta = [opts.projectType, opts.genre, opts.tone].filter(Boolean).join("  ·  ");
  if (meta) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(210, 170, 90);
    doc.text(meta, M, M + 70 + titleLines.length * 44 + 8);
  }

  if (opts.logline) {
    doc.setTextColor(230, 230, 230);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(16);
    const ll = doc.splitTextToSize(opts.logline, CONTENT_W - 40);
    doc.text(ll, M, PAGE.h / 2 + 40);
  }

  doc.setTextColor(180, 180, 180);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const stamp = opts.generatedAt
    ? format(new Date(opts.generatedAt), "MMMM d, yyyy")
    : format(Date.now(), "MMMM d, yyyy");
  doc.text(stamp, M, PAGE.h - 40);
  doc.setTextColor(0);
}

function drawSectionSlide(doc: jsPDF, section: PitchDeckSection) {
  // Header band
  doc.setFillColor(245, 243, 238);
  doc.rect(0, 0, PAGE.w, 78, "F");
  doc.setFillColor(210, 170, 90);
  doc.rect(M, 62, 48, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 28);
  doc.text(section.label, M, 44);

  // Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  const body = (section.value ?? "").trim() || "—";
  const lines = doc.splitTextToSize(body, CONTENT_W);
  const lineH = 18;
  const maxLinesPerPage = Math.floor((PAGE.h - 78 - M - 40) / lineH);

  let y = 78 + 28;
  let printed = 0;
  for (let i = 0; i < lines.length; i++) {
    if (printed >= maxLinesPerPage) {
      doc.addPage();
      // continuation header
      doc.setFillColor(245, 243, 238);
      doc.rect(0, 0, PAGE.w, 78, "F");
      doc.setFillColor(210, 170, 90);
      doc.rect(M, 62, 48, 4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(20, 20, 28);
      doc.text(`${section.label} (cont.)`, M, 44);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(13);
      doc.setTextColor(30, 30, 30);
      y = 78 + 28;
      printed = 0;
    }
    doc.text(lines[i], M, y);
    y += lineH;
    printed++;
  }
  doc.setTextColor(0);
}

export function generatePitchDeckPdf(opts: PitchDeckOptions): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });

  const sections = opts.sections.filter((s) => s.value && s.value.trim().length > 0);

  drawCover(doc, opts);

  for (const section of sections) {
    doc.addPage();
    drawSectionSlide(doc, section);
  }

  // Footers on every page
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, opts.projectTitle, p, total);
  }

  return doc;
}

export function downloadPitchDeckPdf(opts: PitchDeckOptions, filename?: string) {
  const doc = generatePitchDeckPdf(opts);
  const safe = (opts.projectTitle || "pitch-deck").replace(/[^a-z0-9]+/gi, "_");
  doc.save(filename ?? `${safe}-pitch-deck.pdf`);
}
