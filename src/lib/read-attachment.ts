import { ATTACHMENT_LIMITS, IMAGE_TYPES, type Attachment } from "@/lib/catalog";

const TEXT_EXTENSIONS =
  /\.(txt|md|markdown|csv|tsv|json|xml|ya?ml|html?|css|jsx?|tsx?|py|java|go|rb|php|sql|log|ini|rtf|example)$/i;
const SHEET_EXTENSIONS = /\.(xlsx|xlsm|xls|ods|numbers)$/i;
const WORD_EXTENSIONS = /\.docx$/i;
const SLIDE_EXTENSIONS = /\.pptx$/i;

/** Scanned PDFs (no text layer) still go as a document if they fit this. */
const MAX_RAW_PDF_BYTES = 2_800_000;
/** Images are re-encoded down to this long edge before upload. */
const MAX_IMAGE_EDGE = 1568;

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const clip = (text: string) => {
  const clean = text.replace(/\n{3,}/g, "\n\n").trim();
  return clean.length > ATTACHMENT_LIMITS.maxTextChars
    ? `${clean.slice(0, ATTACHMENT_LIMITS.maxTextChars)}\n[… recortado: el archivo sigue]`
    : clean;
};

const textAttachment = (file: File, id: string, text: string, label: string): Attachment => ({
  id,
  name: file.name,
  size: file.size,
  kind: "text",
  mediaType: label,
  data: clip(text),
});

const readPdfText = async (file: File) => {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  let total = 0;
  for (let n = 1; n <= pdf.numPages && total < ATTACHMENT_LIMITS.maxTextChars; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
      .join("");
    pages.push(`--- Página ${n} ---\n${text}`);
    total += text.length;
  }
  return { text: pages.join("\n"), pages: pdf.numPages };
};

const readSheet = async (file: File) => {
  const XLSX = await import("xlsx");
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return book.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(book.Sheets[name], { blankrows: false });
    return `--- Hoja: ${name} ---\n${csv}`;
  }).join("\n\n");
};

const readDocx = async (file: File) => {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value;
};

const readPptx = async (file: File) => {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slides = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => Number(a.match(/\d+/g)!.pop()) - Number(b.match(/\d+/g)!.pop()));
  const out: string[] = [];
  for (const [i, path] of slides.entries()) {
    const xml = await zip.files[path].async("string");
    const runs = Array.from(xml.matchAll(/<a:t>([^<]*)<\/a:t>/g), (m) => m[1]);
    out.push(`--- Diapositiva ${i + 1} ---\n${runs.join(" ")}`);
  }
  return out.join("\n");
};

/** Shrinks big photos so they fit the request and Claude's vision limits. */
const readImage = async (file: File): Promise<{ data: string; mediaType: string }> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1_500_000) {
    bitmap.close();
    return { data: await toBase64(file), mediaType: file.type };
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/jpeg", 0.85)
  );
  return { data: await toBase64(blob), mediaType: "image/jpeg" };
};

/** Reads a dropped file into what the API needs, or explains why it can't. */
export const readAttachment = async (file: File): Promise<Attachment | string> => {
  const id = `${file.name}-${file.size}-${file.lastModified}`;
  try {
    if (IMAGE_TYPES.includes(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
      const image = await readImage(file);
      return { id, name: file.name, size: file.size, kind: "image", ...image };
    }
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const { pages, text } = await readPdfText(file);
      // A real text layer is far smaller than the PDF itself, so prefer it.
      if (text.replace(/--- Página \d+ ---/g, "").trim().length > 8) {
        return textAttachment(file, id, `PDF de ${pages} página(s)\n${text}`, "application/pdf");
      }
      if (file.size > MAX_RAW_PDF_BYTES) {
        return `«${file.name}» parece escaneado (sin texto) y pesa más de 2.8 MB. Expórtalo más liviano o como imágenes.`;
      }
      return {
        id,
        name: file.name,
        size: file.size,
        kind: "pdf",
        mediaType: "application/pdf",
        data: await toBase64(file),
      };
    }
    if (SHEET_EXTENSIONS.test(file.name)) {
      return textAttachment(file, id, await readSheet(file), "spreadsheet");
    }
    if (WORD_EXTENSIONS.test(file.name)) {
      return textAttachment(file, id, await readDocx(file), "word");
    }
    if (SLIDE_EXTENSIONS.test(file.name)) {
      return textAttachment(file, id, await readPptx(file), "slides");
    }
    if (file.type.startsWith("text/") || TEXT_EXTENSIONS.test(file.name) || file.type === "application/json") {
      return textAttachment(file, id, await file.text(), "text/plain");
    }
  } catch (error) {
    console.error("read attachment", file.name, error);
    return `No pude leer «${file.name}». ¿Está protegido con contraseña o dañado?`;
  }
  return `«${file.name}» no es compatible. Usa PDF, Excel, Word, PowerPoint, texto, código o imágenes (.doc antiguo: guárdalo como .docx).`;
};
