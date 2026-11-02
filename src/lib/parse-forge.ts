const TAGS = [
  "diagnostico",
  "puntaje_antes",
  "prompt",
  "puntaje_despues",
  "cambios",
  "config",
  "tip",
  "archivos",
] as const;

export type ForgeTag = (typeof TAGS)[number];

export interface ForgeSection {
  value: string;
  /** The closing tag has arrived. */
  done: boolean;
}

export type ForgeResult = Partial<Record<ForgeTag, ForgeSection>>;

/** Reads the tagged answer while it streams, so open sections render live. */
export const parseForge = (text: string): ForgeResult => {
  const result: ForgeResult = {};
  let cursor = 0;
  for (const tag of TAGS) {
    const open = `<${tag}>`;
    const start = text.indexOf(open, cursor);
    if (start < 0) continue;
    const bodyStart = start + open.length;
    const end = text.lastIndexOf(`</${tag}>`);
    const done = end >= bodyStart;
    result[tag] = {
      value: text.slice(bodyStart, done ? end : undefined).trim(),
      done,
    };
    cursor = done ? end : bodyStart;
  }
  return result;
};

export const parseScore = (section?: ForgeSection) => {
  const match = section?.value.match(/\d{1,3}/);
  return match ? Math.min(100, Number(match[0])) : undefined;
};

export const parseBullets = (section?: ForgeSection) =>
  (section?.value ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);

export const parseConfig = (section?: ForgeSection) =>
  parseBullets(section).map((line) => {
    const index = line.indexOf(":");
    return index > 0
      ? { key: line.slice(0, index).trim(), value: line.slice(index + 1).trim() }
      : { key: line, value: "" };
  });
