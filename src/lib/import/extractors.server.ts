// Server-only text extractors for screenplay imports.
// Each extractor takes raw bytes and returns plain text suitable for the
// heuristic parser. Pure-JS / Worker-safe libraries only.

export async function extractDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  // mammoth expects a Node Buffer-like object; Uint8Array works via .buffer
  const buf = Buffer.from(bytes);
  const result = await mammoth.extractRawText({ buffer: buf });
  return normalize(result.value ?? "");
}

export async function extractPdf(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return normalize(Array.isArray(text) ? text.join("\n") : text ?? "");
}

export async function extractFdx(bytes: Uint8Array): Promise<string> {
  const { XMLParser } = await import("fast-xml-parser");
  const xml = new TextDecoder("utf-8").decode(bytes);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    parseTagValue: false,
    trimValues: false,
  });
  const doc: any = parser.parse(xml);
  const paragraphs: any[] = arr(doc?.FinalDraft?.Content?.Paragraph);
  const lines: string[] = [];
  for (const p of paragraphs) {
    const type = (p?.["@_Type"] ?? "Action").toString();
    const text = collectText(p).trim();
    if (!text) {
      lines.push("");
      continue;
    }
    // Map FDX paragraph types to a fountain-ish layout so the heuristic
    // parser classifies them confidently.
    switch (type) {
      case "Scene Heading":
        lines.push("", text.toUpperCase());
        break;
      case "Character":
        lines.push("", text.toUpperCase());
        break;
      case "Parenthetical":
        lines.push(text.startsWith("(") ? text : `(${text})`);
        break;
      case "Dialogue":
        lines.push(text);
        break;
      case "Transition":
        lines.push("", text.toUpperCase());
        break;
      case "Shot":
        lines.push("", text.toUpperCase());
        break;
      case "Action":
      default:
        lines.push("", text);
        break;
    }
  }
  return normalize(lines.join("\n"));
}

export function extractRtf(bytes: Uint8Array): string {
  // Lightweight RTF stripper — no full parser needed for plain-text extraction.
  const raw = new TextDecoder("latin1").decode(bytes);
  let s = raw;
  // Drop binary blobs and font tables.
  s = s.replace(/\{\\\*?\\[^{}]+\}/g, "");
  // Translate common control words to text equivalents BEFORE stripping.
  s = s.replace(/\\par[d]?\b ?/g, "\n");
  s = s.replace(/\\line\b ?/g, "\n");
  s = s.replace(/\\tab\b ?/g, "\t");
  // Unicode escapes: \uNNNN with optional replacement char.
  s = s.replace(/\\u(-?\d+)\??/g, (_m, n) => {
    const code = parseInt(n, 10);
    return code >= 0 ? String.fromCharCode(code) : String.fromCharCode(65536 + code);
  });
  // Hex escapes \'hh
  s = s.replace(/\\'([0-9a-fA-F]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
  // Remove remaining control words.
  s = s.replace(/\\[a-zA-Z]+-?\d* ?/g, "");
  // Drop braces.
  s = s.replace(/[{}]/g, "");
  return normalize(s);
}

function collectText(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (typeof node === "object") {
    let out = "";
    if ("#text" in node) out += String(node["#text"] ?? "");
    if ("Text" in node) {
      for (const t of arr(node.Text)) {
        if (typeof t === "string") out += t;
        else if (t && typeof t === "object" && "#text" in t) out += String(t["#text"] ?? "");
      }
    }
    return out;
  }
  return "";
}

function arr<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
