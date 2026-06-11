import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SourceType = z.enum(["fdx", "pdf", "docx", "rtf"]);

const Input = z.object({
  sourceType: SourceType,
  fileName: z.string().max(255),
  // base64-encoded file bytes
  base64: z.string().min(1).max(50_000_000),
});

const MAX_BYTES = 20 * 1024 * 1024; // 20MB

export const extractFileText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const bytes = decodeBase64(data.base64);
    if (bytes.byteLength > MAX_BYTES) {
      throw new Error("File is larger than 20 MB.");
    }
    const {
      extractDocx,
      extractPdf,
      extractFdx,
      extractRtf,
    } = await import("./extractors.server");

    let rawText = "";
    try {
      switch (data.sourceType) {
        case "docx":
          rawText = await extractDocx(bytes);
          break;
        case "pdf":
          rawText = await extractPdf(bytes);
          break;
        case "fdx":
          rawText = await extractFdx(bytes);
          break;
        case "rtf":
          rawText = extractRtf(bytes);
          break;
      }
    } catch (e: any) {
      // Surface a friendly message; log internally for diagnosis.
      console.error(`extractFileText[${data.sourceType}]`, e?.message ?? e);
      throw new Error(
        `Couldn't read this ${data.sourceType.toUpperCase()} file. Try exporting it again or pasting the text.`,
      );
    }

    if (!rawText.trim()) {
      throw new Error(
        "We couldn't find any text in this file. If it's a scanned PDF, run OCR first or paste the text.",
      );
    }
    return { rawText, charCount: rawText.length };
  });

function decodeBase64(b64: string): Uint8Array {
  // Atob is available in workerd runtime.
  const clean = b64.includes(",") ? b64.split(",", 2)[1] : b64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
