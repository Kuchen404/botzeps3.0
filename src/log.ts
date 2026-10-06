const STUFEN = ["debug", "info", "warn", "error"] as const;
type Stufe = (typeof STUFEN)[number];

let minimum: Stufe = "info";

export function setzeLogStufe(stufe: Stufe): void {
  minimum = stufe;
}

function schreibe(stufe: Stufe, nachricht: string, extra?: unknown): void {
  if (STUFEN.indexOf(stufe) < STUFEN.indexOf(minimum)) return;
  const zeile = `${new Date().toISOString()} ${stufe.toUpperCase()} ${nachricht}`;
  const ausgabe = stufe === "error" || stufe === "warn" ? console.error : console.log;
  if (extra === undefined) ausgabe(zeile);
  else ausgabe(zeile, extra);
}

export const log = {
  debug: (n: string, e?: unknown) => schreibe("debug", n, e),
  info: (n: string, e?: unknown) => schreibe("info", n, e),
  warn: (n: string, e?: unknown) => schreibe("warn", n, e),
  error: (n: string, e?: unknown) => schreibe("error", n, e),
};
