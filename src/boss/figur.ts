import type { BossStufe } from "../scoring/boss.js";

/**
 * Gezeichnete Bosse als SVG im Cartoon-Stil: geschwungene Formen mit Schatten unten rechts,
 * Licht oben links und kräftiger Tuschelinie. Stufe 1 hat Ärmchen und guckt überheblich,
 * Stufe 2 ist aufgepumpt. Jeder Boss hat eigene Armformen, Posen, Muskelmuster, Hände,
 * einen Gegenstand in der Hand, ein Gewicht zum Thema und eigene Effekte um sich herum. Koordinaten 0..240 (Stufe 2 ragt etwas hinaus), siehe `bossSvg`.
 */

const LINIE = "#231815";

/** Mischt eine Hex-Farbe mit Schwarz (t < 0) oder Weiß (t > 0). */
function mische(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const kanal = (v: number) => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(kanal);
  return `#${((1 << 24) | (r! << 16) | (g! << 8) | b!).toString(16).slice(1)}`;
}

/** Zeichenkontext: vergibt eindeutige ids für Masken, damit mehrere Bosse auf einer Seite gehen. */
class Stift {
  private n = 0;
  /** Farbiges Gegenlicht unten rechts (Stufe 2 im Schein der Aura) */
  rand: string | null = null;
  constructor(private readonly praefix: string) {}

  /** Weicher Schlagschatten der Fläche auf das, was dahinter liegt (Arme auf dem Körper). */
  wurf(d: string): string {
    return `<path d="${d}" fill="#1a0a08" opacity=".32" transform="translate(5 7)" filter="url(#${this.praefix}w)"/>`;
  }

  /** Weichzeichner für die Schattierungsmasken; muss einmal pro Zeichnung in die Ausgabe. */
  defs(): string {
    return `<filter id="${this.praefix}w" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="2.6"/></filter>`;
  }

  /** Attribut für weichgezeichnete Elemente (Wangenröte, Schimmer). */
  weich(): string {
    return `filter="url(#${this.praefix}w)"`;
  }

  /**
   * Fläche wie mit Pinsel und Tusche: weicher Schatten unten rechts mit dunklerem Kern,
   * Licht und Glanzkante oben links, Umriss unten rechts dick und oben links dünn.
   * `innen` (Flecken, Fell, Muster) liegt auf der Grundfarbe und unter der Schattierung,
   * `schraffur` legt feine Tuschestriche in den Schatten.
   */
  form(d: string, farbe: string, o: { linie?: number; schatten?: number; licht?: number; innen?: string; schraffur?: number } = {}): string {
    const id = `${this.praefix}m${++this.n}`;
    const linie = o.linie ?? 3.4;
    const maske = (name: string, verschiebung: string, weich: boolean) =>
      `<mask id="${id}${name}" maskUnits="userSpaceOnUse" x="-200" y="-200" width="700" height="700"><rect x="-200" y="-200" width="700" height="700" fill="#fff"/><path d="${d}" transform="translate(${verschiebung})" fill="#000"${weich ? ` filter="url(#${this.praefix}w)"` : ""}/></mask>`;
    const schatten = -(o.schatten ?? -0.22);
    const licht = o.licht ?? 0.7;
    const brauchtClip = o.innen !== undefined || o.schraffur !== undefined;
    return (
      maske("s", "-9 -8", true) +
      maske("k", "-20 -18", true) +
      maske("l", "6 7", true) +
      maske("g", "2.2 2.8", false) +
      (this.rand ? maske("r", "-2.6 -3.2", false) : "") +
      (brauchtClip ? `<clipPath id="${id}c"><path d="${d}"/></clipPath>` : "") +
      `<path d="${d}" fill="${LINIE}" stroke="${LINIE}" stroke-width="${linie}" stroke-linejoin="round" transform="translate(${linie * 0.38} ${linie * 0.5})"/>` +
      `<path d="${d}" fill="${farbe}"/>` +
      (o.innen ? `<g clip-path="url(#${id}c)">${o.innen}</g>` : "") +
      `<path d="${d}" fill="#000" opacity="${schatten}" mask="url(#${id}s)"/>` +
      `<path d="${d}" fill="#000" opacity="${schatten * 0.48}" mask="url(#${id}k)"/>` +
      (o.schraffur ? `<g mask="url(#${id}s)"><g clip-path="url(#${id}c)"><path d="${schraffurLinien(d)}" stroke="${LINIE}" stroke-width=".9" opacity="${o.schraffur}"/></g></g>` : "") +
      `<path d="${d}" fill="#fff" opacity="${licht * 0.5}" mask="url(#${id}l)"/>` +
      `<path d="${d}" fill="#fff" opacity="${licht * 0.55}" mask="url(#${id}g)"/>` +
      (this.rand ? `<path d="${d}" fill="${this.rand}" opacity=".6" mask="url(#${id}r)"/>` : "") +
      `<path d="${d}" fill="none" stroke="${LINIE}" stroke-width="${linie * 0.62}" stroke-linejoin="round" stroke-linecap="round"/>`
    );
  }

  /** Inhalt nur innerhalb der Fläche `d` zeichnen (Muster auf Armen). */
  clip(d: string, inhalt: string): string {
    const id = `${this.praefix}c${++this.n}`;
    return `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${inhalt}</g>`;
  }
}

/** Linie ohne Fläche (Falten, Adern, Knöchel). */
const strich = (d: string, breite = 2.4, farbe = LINIE) =>
  `<path d="${d}" fill="none" stroke="${farbe}" stroke-width="${breite}" stroke-linecap="round" stroke-linejoin="round"/>`;

/** Ausdehnung eines Pfads mit absoluten Koordinaten als [x0, y0, x1, y1]. */
function ausdehnung(d: string): [number, number, number, number] {
  const z = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 1 < z.length; i += 2) {
    x0 = Math.min(x0, z[i]!);
    x1 = Math.max(x1, z[i]!);
    y0 = Math.min(y0, z[i + 1]!);
    y1 = Math.max(y1, z[i + 1]!);
  }
  return [x0, y0, x1, y1];
}

/** Diagonale Schraffurlinien über die Ausdehnung eines Pfads. */
function schraffurLinien(d: string): string {
  const [x0, y0, x1, y1] = ausdehnung(d);
  const h = y1 - y0;
  let out = "";
  for (let k = x0 - h; k < x1; k += 4) out += `M${k.toFixed(1)} ${y0} l${h} ${h} `;
  return out;
}

type Punkt = readonly [number, number];

/**
 * Pinselstrich durch die Punkte (Catmull-Rom-Kurve), in der Mitte dick und an den Enden spitz,
 * wie mit dem Tuschepinsel gezogen. `anfang`/`ende` sind die Anteile, über die er an- und abschwillt
 * (0 heißt stumpf).
 */
function pinsel(pts: readonly Punkt[], breite: number, farbe = LINIE, o: { anfang?: number; ende?: number; deckung?: number; schritte?: number } = {}): string {
  const anfang = o.anfang ?? 0.35;
  const ende = o.ende ?? 0.45;
  const schritte = o.schritte ?? 6;
  const kurve: Punkt[] = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(i + 2, n - 1)]!;
    for (let k = 0; k < schritte; k++) {
      const t = k / schritte;
      const f = (a: number, b: number, c: number, e: number) =>
        0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - e) * t * t + (3 * b - a - 3 * c + e) * t * t * t);
      kurve.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  kurve.push(pts[n - 1]!);
  const m = kurve.length;
  const schwellen = (t: number, anteil: number) => (anteil <= 0 ? 1 : Math.sin(Math.min(1, t / anteil) * (Math.PI / 2)));
  const links: string[] = [];
  const rechts: string[] = [];
  for (let i = 0; i < m; i++) {
    const t = i / (m - 1);
    const a = kurve[Math.max(i - 1, 0)]!;
    const b = kurve[Math.min(i + 1, m - 1)]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const [nx, ny] = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    const w = (breite / 2) * Math.max(0.12, Math.min(schwellen(t, anfang), schwellen(1 - t, ende)));
    const [x, y] = kurve[i]!;
    const z = (v: number) => String(Math.round(v * 10) / 10);
    links.push(`${z(x + nx * w)} ${z(y + ny * w)}`);
    rechts.push(`${z(x - nx * w)} ${z(y - ny * w)}`);
  }
  return `<path d="M${links.join(" L")} L${rechts.reverse().join(" L")} Z" fill="${farbe}"${o.deckung !== undefined ? ` opacity="${o.deckung}"` : ""}/>`;
}

/** Reproduzierbarer Zufall, damit dieselbe Figur immer gleich aussieht. */
function zufall(saat: number): () => number {
  let s = saat % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Fell aus vielen kleinen, spitz zulaufenden Strähnen über der Ausdehnung von `d` (zum Beschneiden auf die Form).
 * `richtung` ist der Winkel in Grad, in den die Haare fallen (90 = nach unten). Eine Strähne ist eine
 * gebogene Linse aus zwei Kurven, alle Strähnen einer Farbe stecken in einem Pfad.
 */
function fellStriche(d: string, abstand: number, farben: readonly string[], o: { laenge?: number; breite?: number; richtung?: number; saat?: number } = {}): string {
  const [x0, y0, x1, y1] = ausdehnung(d);
  const r = zufall(o.saat ?? 7);
  const laenge = o.laenge ?? 9;
  const breite = (o.breite ?? 1.7) / 2;
  const pfade = farben.map(() => "");
  const f = (v: number) => String(Math.round(v * 10) / 10);
  let i = 0;
  for (let y = y0 - laenge; y < y1; y += abstand * 0.8) {
    for (let x = x0 + (i % 2) * (abstand / 2) - abstand; x < x1 + abstand; x += abstand) {
      const w = (((o.richtung ?? 90) + (r() - 0.5) * 40) * Math.PI) / 180;
      const l = laenge * (0.7 + r() * 0.6);
      const sx = x + (r() - 0.5) * abstand;
      const sy = y + (r() - 0.5) * abstand;
      const [ux, uy] = [Math.cos(w), Math.sin(w)];
      const [nx, ny] = [-uy, ux];
      const biege = (r() - 0.5) * 4;
      const [mx, my] = [sx + (ux * l) / 2 + nx * biege, sy + (uy * l) / 2 + ny * biege];
      const b = breite * 2;
      const k = Math.floor(r() * farben.length);
      // relativ notiert, das hält den Pfad kurz
      const [ex, ey] = [ux * l, uy * l];
      pfade[k] += `M${f(sx)} ${f(sy)}q${f(mx - sx + nx * b)} ${f(my - sy + ny * b)} ${f(ex)} ${f(ey)}q${f(mx - sx - nx * b - ex)} ${f(my - sy - ny * b - ey)} ${f(-ex)} ${f(-ey)}z`;
    }
    i++;
  }
  return pfade.map((p, k) => (p ? `<path d="${p}" fill="${farben[k]}"/>` : "")).join("");
}

/** Spiegelt einen Pfad mit absoluten Koordinaten an der senkrechten Mittelachse x = 120. */
function spiegel(d: string): string {
  return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${240 - Number(x)} ${y}`);
}

/** Spiegelt Punkte an der Mittelachse. */
const spiegelP = (pts: readonly Punkt[]): Punkt[] => pts.map(([x, y]) => [240 - x, y] as const);

/**
 * Verschiebt einen Pfad mit absoluten Koordinaten nach (x, y), dreht ihn dabei um `w` Grad um seinen Ursprung
 * und skaliert ihn mit `g`. Anders als ein transform-Attribut bleibt so die Schattierung von `Stift.form` unten rechts.
 */
function setze(d: string, x: number, y: number, w = 0, g = 1): string {
  const [c, s] = [Math.cos((w * Math.PI) / 180) * g, Math.sin((w * Math.PI) / 180) * g];
  const z = (v: number) => String(Math.round(v * 10) / 10);
  return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, a: string, b: string) => `${z(x + Number(a) * c - Number(b) * s)} ${z(y + Number(a) * s + Number(b) * c)}`);
}

/** Wie `setze`, für Punktlisten. */
function setzeP(pts: readonly Punkt[], x: number, y: number, w = 0, g = 1): Punkt[] {
  const [c, s] = [Math.cos((w * Math.PI) / 180) * g, Math.sin((w * Math.PI) / 180) * g];
  return pts.map(([u, v]) => [x + u * c - v * s, y + u * s + v * c] as const);
}

/** Dreht einen Pfad um `w` Grad um den Punkt (cx, cy). */
const drehe = (d: string, cx: number, cy: number, w: number) => setze(setze(d, -cx, -cy), cx, cy, w);
const dreheP = (pts: readonly Punkt[], cx: number, cy: number, w: number) => setzeP(setzeP(pts, -cx, -cy), cx, cy, w);

/** Ellipse als Pfad. */
function ellipse(x: number, y: number, rx: number, ry: number): string {
  const [kx, ky] = [rx * 0.55, ry * 0.55];
  return `M${x} ${y - ry} C${x + kx} ${y - ry} ${x + rx} ${y - ky} ${x + rx} ${y} C${x + rx} ${y + ky} ${x + kx} ${y + ry} ${x} ${y + ry} C${x - kx} ${y + ry} ${x - rx} ${y + ky} ${x - rx} ${y} C${x - rx} ${y - ky} ${x - kx} ${y - ry} ${x} ${y - ry} Z`;
}

interface AugeArt {
  r: number;
  iris: string;
  /** Hautfarbe des Oberlids */
  lidfarbe: string;
  /** 0 = ganz offen, 1 = zu */
  lid?: number;
  /** Lidkante schräg in Grad; positiv = innen tiefer (böse), negativ = außen tiefer (müde) */
  neigung?: number;
  /** Blickrichtung der Pupille in Vielfachen von r */
  blick?: Punkt;
  /** Tränensack unter dem Auge */
  sack?: string;
  /** rote Äderchen im Weiß */
  adern?: boolean;
}

/** Ein Auge mit Lid, Wimpernkante, Iris und Glanzlichtern; `seite` 1 ist das linke Auge im Bild. */
function auge(st: Stift, x: number, y: number, seite: 1 | -1, a: AugeArt): string {
  const { r } = a;
  const weiss = ellipse(x, y, r, r * 1.12);
  const [bx, by] = a.blick ?? [0, 0];
  const ix = x + bx * r;
  const iy = y + by * r;
  const ir = r * 0.58;
  const lidY = y - r * 1.12 + (a.lid ?? 0) * r * 2.24;
  const t = Math.tan(((a.neigung ?? 0) * Math.PI) / 180) * r * 1.4;
  const [xl, xr] = [x - r * 1.4, x + r * 1.4];
  const [yl, yr] = [lidY - seite * t, lidY + seite * t];
  const lid = `M${xl} ${y - r * 3} L${xr} ${y - r * 3} L${xr} ${yr} Q${x} ${(yl + yr) / 2 + r * 0.3} ${xl} ${yl} Z`;
  const adern = a.adern
    ? pinsel([[x - r * 0.95, y + r * 0.1], [x - r * 0.6, y + r * 0.2], [x - r * 0.4, y + r * 0.05]], 1, "#d9141c") +
      pinsel([[x + r * 0.95, y + r * 0.2], [x + r * 0.6, y + r * 0.35], [x + r * 0.45, y + r * 0.25]], 1, "#d9141c") +
      pinsel([[x - r * 0.3, y + r * 1.05], [x - r * 0.2, y + r * 0.75], [x - r * 0.25, y + r * 0.6]], 0.9, "#d9141c")
    : "";
  return (
    (a.sack ? pinsel([[x - r * 0.9, y + r * 1.2], [x, y + r * 1.55], [x + r * 0.9, y + r * 1.2]], 2, a.sack) : "") +
    st.form(weiss, "#fffdf6", { linie: 2.4, schatten: -0.1, licht: 0.2 }) +
    st.clip(
      weiss,
      adern +
        `<circle cx="${ix}" cy="${iy}" r="${ir}" fill="${a.iris}"/>` +
        `<circle cx="${ix}" cy="${iy}" r="${ir}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="${r * 0.12}"/>` +
        `<circle cx="${ix}" cy="${iy}" r="${ir * 0.48}" fill="#120808"/>` +
        `<circle cx="${ix - ir * 0.35}" cy="${iy - ir * 0.4}" r="${ir * 0.3}" fill="#fff"/>` +
        `<circle cx="${ix + ir * 0.4}" cy="${iy + ir * 0.35}" r="${ir * 0.14}" fill="#fff" opacity=".8"/>` +
        (a.lid ? `<path d="${lid}" fill="${a.lidfarbe}"/><path d="${lid}" fill="#000" opacity=".12"/>` : `<path d="${ellipse(x, y - r * 1.4, r * 1.3, r * 0.5)}" fill="#000" opacity=".1"/>`),
    ) +
    st.clip(
      ellipse(x, y, r + 1.6, r * 1.12 + 1.6),
      a.lid
        ? pinsel([[xl, yl], [x, (yl + yr) / 2 + r * 0.15], [xr, yr]], r * 0.42, LINIE, { anfang: 0, ende: 0 })
        : pinsel([[x - r * 1.1, y - r * 0.5], [x, y - r * 1.2], [x + r * 1.1, y - r * 0.5]], r * 0.36, LINIE, { anfang: 0.3, ende: 0.3 }),
    )
  );
}

/** Zottelige Umrisslinie (Fell) um eine Ellipse; `zipfel` ist die Länge der Büschel relativ zum Radius. */
function zottel(cx: number, cy: number, rx: number, ry: number, n: number, zipfel: number): string {
  const pt = (w: number, f: number) => `${(cx + Math.cos(w) * rx * f).toFixed(1)} ${(cy + Math.sin(w) * ry * f).toFixed(1)}`;
  let d = `M${pt(0, 1)}`;
  for (let i = 0; i < n; i++) {
    const w0 = (i / n) * Math.PI * 2;
    const w1 = ((i + 0.6) / n) * Math.PI * 2;
    const w2 = ((i + 1) / n) * Math.PI * 2;
    const lang = 1 + zipfel * (i % 3 === 0 ? 1.3 : 1);
    d += ` Q${pt(w0 + 0.05, 1 + zipfel * 0.5)} ${pt(w1, lang)} Q${pt(w1, 1.02)} ${pt(w2, 1)}`;
  }
  return d + " Z";
}

/** Gegenstand in einer Hand; Ursprung ist die Hand bzw. Faust. */
type Ding = (st: Stift) => string;

interface Figur {
  haut: string;
  /** Schultern links und rechts */
  schulter: readonly [number, number, number, number];
  koerper: (st: Stift, wut: boolean) => string;
  /** Gewicht in der rechten Faust (Stufe 2); Ursprung ist die Faust */
  gewicht: Ding;
  extra?: (st: Stift) => string;
  /** Stufe 1: Ärmchen links und rechts, Hand und was die linke Hand hält */
  aermchen: { form: readonly [ArmForm, ArmForm]; hand: Hand; ding?: Ding; farbe?: string; muster?: Muster };
  /** Stufe 2: Pose je Arm, Muster auf den Muskeln, Faust und was die linke Faust hält */
  pump: { pose: readonly [Pose, Pose]; muster: Muster; hand: Hand; ding: Ding; farbe?: string };
  /** Stufe 2: was um den Boss herumfliegt (statt Dampf) */
  rage: (st: Stift) => string;
  /** Farbe der Aura hinter Stufe 2 */
  aura: string;
  schwitzt?: boolean;
}

type ArmForm = "haengen" | "huefte" | "stock" | "lang";
type Pose = "bizeps" | "stemmen" | "haengen";
type Hand = "faust" | "huf" | "krallen" | "handschuh";
interface Muster {
  art: "adern" | "haare" | "fell" | "naehte" | "knister" | "aermel";
  farbe: string;
  /** zweite, hellere Farbe für Fell */
  hell?: string;
}

/** Kreis als Pfad, damit er durch `Stift.form` gehen kann. */
function kreis(x: number, y: number, r: number): string {
  const k = r * 0.55;
  return `M${x} ${y - r} C${x + k} ${y - r} ${x + r} ${y - k} ${x + r} ${y} C${x + r} ${y + k} ${x + k} ${y + r} ${x} ${y + r} C${x - k} ${y + r} ${x - r} ${y + k} ${x - r} ${y} C${x - r} ${y - k} ${x - k} ${y - r} ${x} ${y - r} Z`;
}

/** Faust: Fingerknöchel oben, Daumen quer davor; `r` ist der ungefähre Radius. */
function faust(st: Stift, haut: string, r: number): string {
  const k = r / 13;
  const p = (t: string) => t.replace(/-?\d+(\.\d+)?/g, (z) => String(Math.round(Number(z) * k * 10) / 10));
  return (
    st.form(p("M-12 6 C-14 -2 -13 -10 -8 -13 C-5 -15 -2 -14 -1 -12 C1 -15 5 -15 6 -12 C8 -14 12 -13 12 -9 C14 -4 13 4 10 8 C6 13 -6 14 -12 6 Z"), haut, { linie: 2.6 }) +
    strich(p("M-1 -12 L-1.5 -6 M6 -12 L5.5 -6"), 1.6) +
    st.form(p("M-12 4 C-8 -1 0 -2 6 0 C8 1 8 4 5 5 C0 4 -6 6 -10 9 Z"), haut, { linie: 2 })
  );
}

/**
 * Hand bzw. Faust, Knöchel zeigen nach oben (−y), gedreht um `winkel`.
 * Huf und Krallen machen aus der Hand etwas Tierisches, der Handschuh ist für Comicärmchen.
 */
function hand(st: Stift, typ: Hand, haut: string, x: number, y: number, r: number, winkel: number): string {
  let inhalt: string;
  switch (typ) {
    case "huf":
      inhalt =
        st.form(`M${-r} ${r * 0.3} C${-r * 1.1} ${-r * 1.2} ${r * 1.1} ${-r * 1.2} ${r} ${r * 0.3} C${r * 0.6} ${r * 1.1} ${-r * 0.6} ${r * 1.1} ${-r} ${r * 0.3} Z`, "#4e2a33", { linie: 2.4, licht: 0.35 }) +
        strich(`M0 ${-r * 0.85} L0 ${r * 0.2}`, 2.4);
      break;
    case "krallen":
      inhalt =
        [-0.6, 0, 0.6]
          .map((t) => st.form(`M${t * r - 3} ${-r * 0.6} Q${t * r - 3} ${-r * 1.9} ${t * r + 3} ${-r * 2.1} Q${t * r + 1} ${-r * 1.3} ${t * r + 3.5} ${-r * 0.6} Z`, "#efe6cf", { linie: 1.8 }))
          .join("") + faust(st, haut, r);
      break;
    case "handschuh":
      inhalt =
        faust(st, "#fffdf6", r) +
        st.form(`M${-r * 0.8} ${r * 0.75} Q0 ${r * 0.55} ${r * 0.8} ${r * 0.75} L${r * 0.75} ${r * 1.35} Q0 ${r * 1.2} ${-r * 0.75} ${r * 1.35} Z`, "#fffdf6", { linie: 2 });
      break;
    default:
      inhalt = faust(st, haut, r);
  }
  return `<g transform="translate(${x} ${y}) rotate(${winkel})">${inhalt}</g>`;
}

/** Ärmchen der Stufe 1, nach links gezeichnet, Schulter im Ursprung. */
const ARMFORMEN: Record<ArmForm, { d?: string; stock?: string; hand: Punkt; winkel: number; r: number; falte?: Punkt[]; glanz?: Punkt[] }> = {
  // hängend
  haengen: {
    d: "M3 -6 C-12 -4 -24 10 -27 34 L-14 37 C-14 20 -8 10 3 6 C8 3 8 -3 3 -6 Z",
    hand: [-20, 42],
    winkel: 180,
    r: 8,
    glanz: [[-6, -3], [-16, 6], [-22, 22]],
  },
  // Hand in die Hüfte gestemmt, Ellbogen raus: überheblich
  huefte: {
    d: "M3 -7 C-16 -6 -33 6 -33 20 C-33 30 -24 37 -12 40 L-7 30 C-14 28 -20 25 -20 20 C-20 13 -10 9 3 7 C9 4 9 -4 3 -7 Z",
    hand: [-6, 35],
    winkel: 110,
    r: 8,
    falte: [[-29, 14], [-25, 19], [-24, 24]],
    glanz: [[-6, -4], [-20, 0], [-29, 10]],
  },
  // Comicärmchen als Strich, wie bei Verpackungsmaskottchen
  stock: { stock: "M0 0 Q-22 6 -24 34", hand: [-24, 40], winkel: 180, r: 7 },
  // lang und schlaff bis zum Boden
  lang: {
    d: "M3 -7 C-14 -4 -26 14 -28 40 C-29 54 -28 64 -26 72 L-14 72 C-14 60 -15 48 -14 38 C-12 18 -6 8 3 5 C8 3 8 -5 3 -7 Z",
    hand: [-20, 76],
    winkel: 180,
    r: 8,
    glanz: [[-8, -2], [-20, 14], [-24, 40]],
  },
};

function aermchen(st: Stift, f: Figur, x: number, y: number, s: 1 | -1, form: ArmForm, ding: Ding | undefined): string {
  const a = ARMFORMEN[form];
  const farbe = f.aermchen.farbe ?? f.haut;
  const arm = a.d
    ? st.form(a.d, farbe, { linie: 2.8, licht: f.aermchen.muster ? 0.15 : 0.4, innen: f.aermchen.muster ? musterInnen(f.aermchen.muster, a.d) : undefined }) +
      (a.falte ? pinsel(a.falte, 2.2, mische(farbe, -0.45)) : "") +
      (a.glanz ? pinsel(a.glanz, 3, "#fff", { deckung: 0.35 }) : "")
    : strich(a.stock!, 6.4) + strich(a.stock!, 2.6, farbe);
  // Gegenstand nicht spiegeln (Schrift), daher außerhalb der gespiegelten Gruppe
  const [hx, hy] = a.hand;
  const gegenstand = ding ? `<g transform="translate(${x + s * hx} ${y + hy}) scale(.6)">${ding(st)}</g>` : "";
  return (
    `<g transform="translate(${x} ${y}) scale(${s} 1)">${a.d ? st.wurf(a.d) : ""}${arm}</g>` +
    gegenstand +
    `<g transform="translate(${x} ${y}) scale(${s} 1)">${hand(st, f.aermchen.hand, f.haut, hx, hy, a.r, a.winkel)}</g>`
  );
}

/**
 * Aufgepumpte Arme als je eine Form, nach links gezeichnet, Schulter im Ursprung.
 * Bizeps: Doppelbizeps-Pose. Stemmen: Faust über dem Kopf. Hängen: Gorillaarme bis zum Boden.
 * `linien` trennen Deltamuskel, Bizeps, Trizeps und Unterarm, `glanz` sind Lichtkanten auf den Muskelbergen.
 */
interface PoseArt {
  d: string;
  faust: Punkt;
  winkel: number;
  linien: readonly (readonly Punkt[])[];
  glanz: readonly (readonly Punkt[])[];
  adern: readonly (readonly Punkt[])[];
  gelenk: string;
}
const POSEN: Record<Pose, PoseArt> = {
  bizeps: {
    d:
      "M2 -16 C-6 -36 -22 -50 -37 -47 C-50 -44 -55 -32 -52 -20 C-54 -30 -55 -40 -56 -48 " +
      "C-55 -58 -60 -70 -71 -71 C-84 -72 -90 -60 -85 -48 C-88 -36 -88 -14 -80 0 " +
      "C-76 14 -60 20 -46 15 C-30 13 -14 16 2 13 C12 8 12 -10 2 -16 Z",
    faust: [-71, -59],
    winkel: -8,
    linien: [
      [[-10, -38], [-19, -16], [-14, 9]],
      [[-17, -2], [-32, -6], [-49, -16]],
      [[-52, -20], [-44, -13], [-33, -13], [-25, -18]],
      [[-77, -6], [-73, -26], [-68, -43]],
      [[-60, 10], [-50, 6], [-42, 9]],
    ],
    glanz: [
      [[-22, -43], [-35, -42], [-45, -33]],
      [[-84, -44], [-84, -24], [-80, -8]],
      [[-4, -26], [-8, -10], [-6, 4]],
    ],
    adern: [
      [[-8, -24], [-18, -32], [-27, -30], [-35, -37], [-44, -36]],
      [[-27, -30], [-31, -22], [-38, -22]],
      [[-66, -36], [-70, -26], [-68, -16], [-72, -6]],
    ],
    gelenk: "M-57 -46 Q-71 -41 -86 -47",
  },
  stemmen: {
    d:
      "M2 13 C-20 16 -46 8 -58 -12 C-66 -30 -64 -58 -62 -84 C-70 -92 -68 -108 -56 -110 " +
      "C-44 -114 -36 -106 -38 -94 C-40 -76 -40 -62 -36 -50 C-28 -52 -14 -44 -10 -32 C-6 -24 0 -19 2 -16 C12 -10 12 8 2 13 Z",
    faust: [-52, -99],
    winkel: 0,
    linien: [
      [[-6, -22], [-16, -6], [-13, 10]],
      [[-20, -30], [-35, -19], [-50, -6]],
      [[-36, -50], [-42, -44], [-46, -36], [-48, -26]],
      [[-56, -28], [-52, -54], [-50, -78]],
    ],
    glanz: [
      [[-14, -36], [-26, -44], [-35, -47]],
      [[-62, -38], [-62, -62], [-60, -80]],
      [[-30, 8], [-44, 2], [-54, -10]],
    ],
    adern: [
      [[-10, -24], [-22, -30], [-30, -22], [-40, -26]],
      [[-47, -30], [-52, -46], [-49, -62], [-53, -80]],
      [[-52, -46], [-58, -54]],
    ],
    gelenk: "M-63 -84 Q-50 -79 -38 -88",
  },
  haengen: {
    d:
      "M6 -14 C-14 -26 -40 -20 -46 2 C-52 18 -52 32 -46 44 C-58 56 -62 72 -56 84 " +
      "C-52 96 -36 98 -30 88 C-26 74 -26 58 -28 48 C-22 36 -18 24 -14 14 C-8 8 0 8 6 6 C14 0 14 -10 6 -14 Z",
    faust: [-44, 86],
    winkel: 180,
    linien: [
      [[-10, -20], [-22, -4], [-20, 12]],
      [[-28, 4], [-33, 22], [-40, 40]],
      [[-46, 44], [-40, 47], [-34, 48], [-28, 48]],
      [[-50, 56], [-46, 70], [-44, 80]],
    ],
    glanz: [
      [[-36, -14], [-44, 4], [-46, 24]],
      [[-56, 58], [-57, 70], [-54, 80]],
    ],
    adern: [
      [[-16, -6], [-28, 2], [-34, 16], [-40, 30]],
      [[-34, 16], [-26, 22]],
      [[-48, 54], [-52, 62], [-48, 70], [-50, 76]],
    ],
    gelenk: "M-57 76 Q-44 81 -29 76",
  },
};

/** Muster unter der Schattierung des Arms (Fell, Haare, Polster, Folie, Stickerei). */
function musterInnen(m: Muster, d: string): string {
  const raster = (schritt: number, f: (x: number, y: number, i: number) => string) => {
    let out = "";
    let i = 0;
    for (let y = -125; y < 110; y += schritt) for (let x = -110 + ((y / schritt) % 2) * (schritt / 2); x < 20; x += schritt) out += f(x, y, i++);
    return out;
  };
  switch (m.art) {
    case "haare":
      return fellStriche(d, 6, [m.farbe], { laenge: 6, breite: 1.1, richtung: 110, saat: 3 });
    case "fell":
      return fellStriche(d, 6.5, [m.farbe, m.hell ?? m.farbe], { laenge: 12, breite: 2.1, richtung: 100, saat: 11 });
    case "naehte": {
      // Chesterfield-Polster: Rautennähte mit Knöpfen an den Kreuzungen
      let linien = "";
      for (let k = -260; k < 160; k += 18) linien += `M${k} -130 l240 240 M${k + 240} -130 l-240 240 `;
      const knoepfe = raster(18, (x, y) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${m.farbe}"/>`);
      return `<path d="${linien}" stroke="${m.farbe}" stroke-width="1.4" fill="none" opacity=".8"/><g transform="translate(-1 -4)">${knoepfe}</g>`;
    }
    case "knister":
      return `<path d="${raster(14, (x, y, i) => (i % 2 ? `M${x} ${y} l4 -5 l4 5 l4 -5 ` : `M${x} ${y} l7 3 `))}" stroke="${m.farbe}" stroke-width="1.6" stroke-linejoin="round" fill="none" opacity=".8"/>`;
    case "aermel":
      return raster(16, (x, y) => `<path d="M${x} ${y - 3} l3 3 l-3 3 l-3 -3 Z" fill="${m.farbe}" opacity=".8"/>`);
    case "adern":
      return "";
  }
}

function pumparm(st: Stift, f: Figur, x: number, y: number, s: 1 | -1, pose: Pose, ding: Ding): string {
  const p = POSEN[pose];
  const { muster: m, hand: h, farbe } = f.pump;
  const [fx, fy] = p.faust;
  const dunkel = mische(farbe ?? f.haut, -0.45);
  const adern =
    m.art === "adern"
      ? p.adern.map((a) => pinsel(a, 3.2, mische(m.farbe, -0.2), { anfang: 0.15, ende: 0.3 }) + pinsel(a.map(([u, v]) => [u - 0.8, v - 1.2] as const), 1.2, "#fff", { deckung: 0.35 })).join("")
      : "";
  const aermel = m.art === "aermel" ? strich(p.gelenk, 9, LINIE) + strich(p.gelenk, 5.6, m.farbe) : "";
  // Gegenstand hinter dem Arm, damit die Faust ihn umschließt; nicht spiegeln, sonst stünde Schrift verkehrt
  const gegenstand = `<g transform="translate(${x + s * fx} ${y + fy})">${ding(st)}</g>`;
  return (
    gegenstand +
    `<g transform="translate(${x} ${y}) scale(${s} 1)">` +
    st.wurf(p.d) +
    st.form(p.d, farbe ?? f.haut, { innen: musterInnen(m, p.d), schraffur: 0.35 }) +
    p.linien.map((l) => pinsel(l, 2.8, dunkel)).join("") +
    p.glanz.map((l) => pinsel(l, 4, "#fff", { deckung: 0.4 })).join("") +
    adern +
    aermel +
    hand(st, h, f.haut, fx, fy, 14, p.winkel) +
    `</g>`
  );
}

/** Wölkchen (Staub, Dampf, Schaum). */
const wolke = (x: number, y: number, farbe: string, g = 1) =>
  `<path transform="translate(${x} ${y}) scale(${g})" d="M0 0 c-6 -2 -8 -10 -2 -13 c-1 -7 9 -9 11 -3 c6 -1 8 7 3 10 c2 6 -8 9 -12 6 Z" fill="${farbe}" stroke="${LINIE}" stroke-width="1.4"/>`;

/** Kleiner Stern als Funkeln. */
const funkeln = (x: number, y: number, r: number, farbe = "#fffdf6") =>
  `<path d="M${x} ${y - r} Q${x + r * 0.2} ${y - r * 0.2} ${x + r} ${y} Q${x + r * 0.2} ${y + r * 0.2} ${x} ${y + r} Q${x - r * 0.2} ${y + r * 0.2} ${x - r} ${y} Q${x - r * 0.2} ${y - r * 0.2} ${x} ${y - r} Z" fill="${farbe}"/>`;

// Gegenstände in der Hand
const dinge = {
  /** Gesprengte Kette, baumelt aus der Faust */
  kette: (st: Stift) =>
    [
      [-12, 4, 30],
      [-22, 12, -20],
      [-30, 23, 40],
      [-35, 36, -10],
    ]
      .map(([x, y, w], i) => {
        const glied = i === 3 ? "M-7 -2 C-7 -6 -4 -7 0 -7 C6 -7 7 -4 7 0 C7 4 4 6 2 6" : "M-7 0 C-7 -5 -4 -7 0 -7 C4 -7 7 -5 7 0 C7 5 4 7 0 7 C-4 7 -7 5 -7 0 Z";
        return `<g transform="translate(${x} ${y}) rotate(${w})"><path d="${glied}" fill="none" stroke="${LINIE}" stroke-width="5.4" stroke-linecap="round"/><path d="${glied}" fill="none" stroke="#a3a3aa" stroke-width="2.6" stroke-linecap="round"/></g>`;
      })
      .join(""),
  /** Dönermesser mit langer Klinge */
  messer: (st: Stift) =>
    st.form("M-6 -86 C-2 -92 4 -90 6 -84 L5 -22 L-5 -22 Z", "#dfe3ea", { linie: 2.4, licht: 0.9 }) +
    st.form("M-10 -24 L10 -24 L10 -18 L-10 -18 Z", "#34343a", { linie: 2 }) +
    st.form("M-5 -18 L5 -18 L5 12 L-5 12 Z", "#3a1d12", { linie: 2 }) +
    strich("M-1 -80 L-1 -30", 1.6, "#fff"),
  /** Plastikgabel vom Imbiss */
  gabel: (_st: Stift) =>
    `<path d="M0 6 L0 -26 M-6 -40 L-6 -30 Q0 -22 6 -30 L6 -40 M0 -40 L0 -26" fill="none" stroke="${LINIE}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M0 6 L0 -26 M-6 -40 L-6 -30 Q0 -22 6 -30 L6 -40 M0 -40 L0 -26" fill="none" stroke="#fffdf6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  /** Fernbedienung, ragt nach vorne raus */
  fernbedienung: (st: Stift) =>
    `<g transform="rotate(-20)">${st.form("M-40 -7 Q-42 0 -40 7 L4 7 L4 -7 Z", "#34343a", { linie: 2.4 })}` +
    `<circle cx="-33" cy="0" r="3" fill="#d9141c"/><circle cx="-24" cy="-2" r="1.8" fill="#a3a3aa"/><circle cx="-24" cy="3" r="1.8" fill="#a3a3aa"/><circle cx="-17" cy="-2" r="1.8" fill="#a3a3aa"/><circle cx="-17" cy="3" r="1.8" fill="#a3a3aa"/></g>`,
  /** Maßkrug, Schaum läuft über */
  mass: (st: Stift) =>
    st.form("M-6 -30 C6 -30 12 -24 12 -14 C12 -4 6 2 -4 2 L-4 -6 C2 -6 4 -10 4 -14 C4 -18 2 -22 -6 -22 Z", "#e8f4f8", { linie: 2.2 }) +
    st.form("M-46 -34 L-6 -34 L-8 10 Q-26 14 -44 10 Z", "#f4b400", { linie: 2.6, licht: 0.5 }) +
    strich("M-36 -26 L-37 2 M-26 -26 L-26 4 M-16 -26 L-15 2", 2, "#c98a00") +
    st.form("M-50 -32 C-54 -42 -44 -48 -38 -44 C-34 -52 -20 -52 -18 -44 C-12 -48 -2 -44 -4 -34 C-2 -30 -4 -24 -10 -26 C-10 -20 -16 -20 -18 -26 L-46 -26 C-50 -26 -52 -30 -50 -32 Z", "#fffdf6", { linie: 2.4 }),
  /** Riesenchip */
  chip: (st: Stift) => riffelchip(st, 0, -28, -12, 1.7),
  /** Handy mit Bestellung */
  handy: (st: Stift) =>
    st.form("M-13 -58 Q-13 -62 -9 -62 L9 -62 Q13 -62 13 -58 L13 -6 Q13 -2 9 -2 L-9 -2 Q-13 -2 -13 -6 Z", "#2f2f35", { linie: 2.4 }) +
    `<rect x="-9" y="-56" width="18" height="44" rx="2" fill="#ffe7a3"/>` +
    `<path d="M0 -50 L-7 -32 Q0 -29 7 -32 Z" fill="#f4c400" stroke="#c42a21" stroke-width="1.4"/><circle cx="-1" cy="-38" r="1.6" fill="#e2352b"/><circle cx="2" cy="-43" r="1.4" fill="#e2352b"/>` +
    `<rect x="-7" y="-26" width="14" height="6" rx="2" fill="#5cbf3b"/>`,
  /** Kelch mit Rotwein */
  kelch: (st: Stift) =>
    st.form("M-16 -48 L16 -48 C16 -30 8 -22 3 -20 L3 -6 L10 -2 L-10 -2 L-3 -6 L-3 -20 C-8 -22 -16 -30 -16 -48 Z", "#f4c400", { linie: 2.4 }) +
    `<path d="M-14 -44 L14 -44 C12 -32 6 -26 0 -25 C-6 -26 -12 -32 -14 -44 Z" fill="#8f0f16"/>` +
    `<circle cx="-6" cy="-36" r="2.4" fill="#d9141c"/><circle cx="7" cy="-34" r="2.4" fill="#2e58a6"/>`,
};

/** Hantel waagrecht durch die Faust. */
function hantel(st: Stift, scheibe: (x: number) => string): string {
  return st.form("M-38 -4 Q0 -6 38 -4 L38 4 Q0 6 -38 4 Z", "#a3a3aa", { linie: 2.4 }) + scheibe(-32) + scheibe(32);
}

/** Der innere Schweinehund: Sau mit Hundeohren, Hundeflecken und Halsband. */
function schweinehund(st: Stift, wut: boolean): string {
  const haut = "#f5a0b4";
  const fleck = "#9a6240";
  const falte = "#c2607a";
  const leib =
    "M120 46 C142 44 158 58 161 76 C163 88 161 98 158 105 C170 110 178 120 182 134 C192 158 193 182 183 198 " +
    "C176 208 162 212 146 212 C132 214 108 214 94 212 C78 212 64 208 57 198 C47 182 48 158 58 134 " +
    "C62 120 70 110 82 105 C79 98 77 88 79 76 C82 58 98 44 120 46 Z";
  const flecken =
    `<path d="M120 132 C146 132 168 152 170 178 C171 196 150 206 120 206 C90 206 69 196 70 178 C72 152 94 132 120 132 Z" fill="#fbd3dc" opacity=".75"/>` +
    // Hundefleck ums linke Auge und ein paar auf dem Körper
    `<path d="M84 71 C83 60 95 55 106 57 C114 58 121 65 120 73 C123 80 119 90 111 93 C103 97 92 95 87 88 C83 83 82 77 84 71 Z" fill="${fleck}"/>` +
    `<path d="M150 146 C156 137 171 139 176 149 C181 160 173 171 162 169 C153 168 146 156 150 146 Z" fill="${fleck}"/>` +
    `<path d="M57 150 C61 141 72 143 75 151 C77 160 69 167 62 164 C56 161 54 155 57 150 Z" fill="${fleck}"/>` +
    `<path d="M139 190 C143 185 152 187 153 194 C153 201 144 203 140 199 Z" fill="${fleck}"/>` +
    // Borsten
    fellStriche(leib, 16, ["#d57790"], { laenge: 4, breite: 1, richtung: 95, saat: 5 });
  const fuss = (x: number, s: 1 | -1) =>
    `<g transform="translate(${x} 0) scale(${s} 1)">` +
    st.form("M-15 198 C-21 208 -19 217 -7 219 C5 220 12 215 10 204 Z", haut, { linie: 3 }) +
    st.form("M-19 211 C-20 219 -12 223 -3 223 C6 223 12 220 11 213 C2 216 -10 216 -19 211 Z", "#5e3640", { linie: 2.4, licht: 0.9 }) +
    pinsel([[-3, 214], [-3.5, 218], [-3, 222]], 2.2) +
    `</g>`;
  const schwanz: Punkt[] = [[170, 178], [183, 178], [190, 169], [186, 160], [178, 160], [176, 167], [182, 171], [189, 165]];
  const augenArt = (lidfarbe: string, lid: number, neigung: number): AugeArt =>
    wut
      ? { r: 9.5, iris: "#d9141c", lidfarbe, lid: 0.2, neigung: 26, blick: [0, 0.12], adern: true }
      : { r: 9.5, iris: "#4a2a14", lidfarbe, lid, neigung, blick: [0.32, 0.1] };
  const brauen = wut
    ? pinsel([[89, 61], [103, 65], [118, 73]], 6.4, LINIE, { anfang: 0.1, ende: 0.5 }) + pinsel([[151, 61], [137, 65], [122, 73]], 6.4, LINIE, { anfang: 0.1, ende: 0.5 })
    : pinsel([[92, 67], [104, 65], [115, 68]], 3.8) + pinsel([[125, 62], [137, 55], [149, 60]], 3.8);
  const maul = wut
    ? st.form("M97 121 C104 115 114 118 120 119 C126 118 136 115 143 121 C144 137 133 148 120 148 C107 148 96 137 97 121 Z", "#4a0a10", { linie: 3, licht: 0.2 }) +
      `<path d="M106 140 C112 134 128 134 134 140 C130 146 110 146 106 140 Z" fill="#e85a6b"/>` +
      [104, 112, 120, 128, 136].map((x) => `<path d="M${x - 3.5} ${120 - Math.abs(x - 120) * 0.12} l3.5 7 l3.5 -7 Z" fill="#fffdf6" stroke="${LINIE}" stroke-width="1.1" stroke-linejoin="round"/>`).join("") +
      // Hauer wie beim Keiler
      st.form("M101 138 C94 131 92 120 97 110 C99 117 103 124 109 131 Z", "#f6efd9", { linie: 2.2 }) +
      st.form("M139 138 C146 131 148 120 143 110 C141 117 137 124 131 131 Z", "#f6efd9", { linie: 2.2 })
    : pinsel([[99, 123], [110, 129], [125, 128], [140, 119]], 3.6, LINIE, { anfang: 0.15, ende: 0.15 }) +
      pinsel([[137, 114], [141, 118], [140, 123]], 2.2) +
      pinsel([[112, 133], [120, 134.5], [128, 132]], 1.8, falte) +
      // Zahnstocher im Mundwinkel
      strich("M137 121 L163 112", 4.6) +
      strich("M137 121 L163 112", 2.2, "#e8cf9a");
  const halsband = wut
    ? ""
    : st.form("M80 123 C100 136 140 136 160 123 L161 133 C140 147 100 147 79 133 Z", "#d9141c", { linie: 2.6 }) +
      pinsel([[86, 132], [120, 141], [154, 132]], 1.4, "#ffb3a8", { deckung: 0.7 }) +
      `<path d="M113 146 a3.2 3.2 0 1 1 3.4 -4.4 h7.2 a3.2 3.2 0 1 1 3.4 4.4 a3.2 3.2 0 1 1 -3.4 4.4 h-7.2 a3.2 3.2 0 1 1 -3.4 -4.4 Z" fill="#f4c400" stroke="${LINIE}" stroke-width="1.8"/>` +
      `<circle cx="120" cy="139" r="2.2" fill="none" stroke="${LINIE}" stroke-width="1.4"/>`;
  return (
    pinsel(schwanz, 7.4, LINIE, { anfang: 0, ende: 0.3 }) +
    pinsel(schwanz, 4, haut, { anfang: 0, ende: 0.35 }) +
    st.form(leib, haut, { innen: flecken, schraffur: 0.22 }) +
    // Bauchrollen, Speckfalten, Doppelkinn, Nabel
    pinsel([[64, 185], [90, 201], [120, 205], [150, 201], [176, 185]], 2.8, falte) +
    pinsel([[57, 147], [66, 154], [77, 153]], 2.4, falte) +
    pinsel([[183, 147], [174, 154], [163, 153]], 2.4, falte) +
    pinsel([[62, 166], [69, 170], [77, 169]], 2, falte) +
    pinsel([[178, 166], [171, 170], [163, 169]], 2, falte) +
    pinsel([[88, 112], [104, 122], [120, 124], [136, 122], [152, 112]], 2.8, falte) +
    pinsel([[97, 119], [110, 126], [130, 126], [143, 119]], 2, falte) +
    pinsel([[116, 175], [119.5, 179], [124, 175]], 2.4, falte) +
    `<circle cx="120" cy="177" r="1.6" fill="${falte}"/>` +
    fuss(92, 1) +
    fuss(148, -1) +
    halsband +
    // links ein Schlappohr, rechts ein halb aufgestelltes mit rosa Innenseite
    st.form("M88 60 C72 54 54 64 52 86 C50 104 58 120 70 121 C80 122 84 110 82 98 C81 86 86 72 96 64 Z", "#8b5a3c", { schraffur: 0.3 }) +
    pinsel([[68, 72], [62, 88], [64, 104], [70, 114]], 2.4, "#5e3a24") +
    st.form("M146 63 C156 48 176 39 193 43 C202 45 202 54 194 58 C183 63 172 67 166 75 C160 81 153 77 150 71 Z", "#8b5a3c") +
    `<path d="M152 64 C162 53 177 47 189 49 C179 55 169 62 161 70 C158 72 154 69 152 64 Z" fill="#e98aa0"/>` +
    pinsel([[156, 66], [168, 56], [184, 50]], 1.8, "#b85a72") +
    // Borstenbüschel auf dem Kopf
    pinsel([[115, 48], [112, 40], [107, 34]], 2.6, LINIE, { anfang: 0.1 }) +
    pinsel([[120, 47], [123, 38], [130, 33]], 2.6, LINIE, { anfang: 0.1 }) +
    pinsel([[125, 48], [131, 43], [138, 42]], 2.2, LINIE, { anfang: 0.1 }) +
    `<ellipse cx="90" cy="104" rx="8" ry="5" fill="#ff5f86" opacity=".45" ${st.weich()}/><ellipse cx="150" cy="104" rx="8" ry="5" fill="#ff5f86" opacity=".45" ${st.weich()}/>` +
    auge(st, 104, 80, 1, augenArt(fleck, 0.44, -6)) +
    auge(st, 136, 80, -1, augenArt(haut, 0.36, -3)) +
    brauen +
    (wut
      ? strich("M141 49 q4 4 0 8 M153 49 q-4 4 0 8 M143 47 q4 4 8 0 M143 59 q4 -4 8 0", 2.8, "#d9141c")
      : "") +
    // Rüssel mit heller Oberseite, tiefen Nasenlöchern und Glanz
    st.form("M98 103 C97 93 107 88 120 88 C133 88 143 93 142 103 C141 113 132 118 120 118 C108 118 99 113 98 103 Z", "#ec7d98", {
      linie: 3,
      innen: `<path d="M102 98 C105 91 135 91 138 98 C135 104 105 104 102 98 Z" fill="#fff" opacity=".25"/>`,
    }) +
    `<path d="M108 99 C104 101 104 108 109 109.5 C113 110.5 114 101 108 99 Z M132 99 C136 101 136 108 131 109.5 C127 110.5 126 101 132 99 Z" fill="#3a1418"/>` +
    `<ellipse cx="110" cy="92.5" rx="4.5" ry="2" fill="#fff" opacity=".75"/>` +
    maul
  );
}

/** Graf Gemütlich: verschlafenes Faultier als Vampirgraf mit Zylinder, Monokel und Draculakragen. */
function grafGemuetlich(st: Stift, wut: boolean): string {
  const fell = "#8b684d";
  const dunkel = "#5e4330";
  const hell = "#b08d6c";
  const kragenAussen = "M94 124 C76 110 60 84 52 54 C70 66 90 82 102 100 Z";
  const kragenInnen = "M94 117 C80 105 68 86 61 66 C76 78 89 89 98 101 Z";
  const leib = zottel(120, 168, 44, 42, 26, wut ? 0.15 : 0.09);
  const kopf = zottel(120, 94, 38, 35, 22, wut ? 0.17 : 0.1);
  const bauch = zottel(120, 176, 24, 27, 18, 0.08);
  const maske = "M120 72 C140 72 155 82 154 98 C153 113 138 123 120 123 C102 123 87 113 86 98 C85 82 100 72 120 72 Z";
  const streifen = "M91 85 C97 79 110 81 115 89 C113 97 105 100 99 104 C94 108 88 109 86 105 C84 99 87 91 91 85 Z";
  const augenArt: AugeArt = wut
    ? { r: 6.8, iris: "#d9141c", lidfarbe: "#4a3426", lid: 0.12, neigung: 24, blick: [0, 0.1], adern: true, sack: "#2a1c16" }
    : { r: 6.8, iris: "#3a2416", lidfarbe: "#4a3426", lid: 0.6, neigung: -14, blick: [0, 0.15], sack: "#3a2a20" };
  const kralle = (x: number, s: 1 | -1) => {
    const k: Punkt[] = [[x, 204], [x - s * 3, 212], [x + s * 1, 219]];
    return pinsel(k, 5.6, LINIE, { anfang: 0, ende: 0.6 }) + pinsel(k, 3, "#efe6cf", { anfang: 0, ende: 0.7 });
  };
  const maul = wut
    ? st.form("M106 114 C112 111 128 111 134 114 C136 127 128 135 120 135 C112 135 104 127 106 114 Z", "#4a0a10", { linie: 2.6, licht: 0.2 }) +
      `<path d="M112 130 C116 126 124 126 128 130 C124 134 116 134 112 130 Z" fill="#e85a6b"/>` +
      `<path d="M107.5 114 L114 114 L110.5 128 Z M126 114 L132.5 114 L129.5 128 Z" fill="#fffdf6" stroke="${LINIE}" stroke-width="1.3" stroke-linejoin="round"/>`
    : pinsel([[107, 114], [113, 119], [120, 120], [127, 119], [133, 114]], 3, LINIE, { anfang: 0.15, ende: 0.15 }) +
      `<path d="M112.6 118.4 L116.4 118.8 L114.6 124.5 Z M123.6 118.8 L127.4 118.4 L125.4 124.5 Z" fill="#fffdf6" stroke="${LINIE}" stroke-width="1.1" stroke-linejoin="round"/>`;
  return (
    // Umhang mit roter Innenseite und Falten
    st.form("M84 120 C60 150 48 184 42 212 C82 222 158 222 198 212 C192 184 180 150 156 120 Z", "#25212a", {
      licht: 0.4,
      innen:
        `<path d="M86 128 C68 156 58 186 54 210 L76 212 Z M154 128 C172 156 182 186 186 210 L164 212 Z" fill="#a8131b"/>` +
        pinsel([[70, 150], [62, 180], [56, 208]], 2.6, "#4a4452") +
        pinsel([[170, 150], [178, 180], [184, 208]], 2.6, "#4a4452"),
    }) +
    st.form(kragenAussen, "#25212a", { linie: 2.8, licht: 0.4 }) +
    st.form(spiegel(kragenAussen), "#25212a", { linie: 2.8, licht: 0.4 }) +
    st.form(kragenInnen, "#b3141c", { linie: 2, innen: pinsel([[90, 112], [74, 92], [64, 72]], 2, "#6e0b10") }) +
    st.form(spiegel(kragenInnen), "#b3141c", { linie: 2, innen: pinsel([[150, 112], [166, 92], [176, 72]], 2, "#6e0b10") }) +
    // zotteliger Leib mit hellem Bauch
    st.form(leib, fell, {
      schraffur: 0.25,
      innen:
        fellStriche(leib, 6, [dunkel, hell, dunkel], { laenge: 11, breite: 2, richtung: 92, saat: 21 }) +
        `<path d="${bauch}" fill="#c9ab8e"/>` +
        st.clip(bauch, fellStriche(bauch, 6, ["#a8876a", "#e2cdb4"], { laenge: 9, breite: 1.8, richtung: 90, saat: 4 })),
    }) +
    kralle(100, 1) +
    kralle(108, 1) +
    kralle(140, -1) +
    kralle(132, -1) +
    // Brosche am Kragen
    st.form(kreis(120, 128, 7), "#f4c400", { linie: 2.2, licht: 0.9 }) +
    st.form(kreis(120, 128, 3.6), "#d9141c", { linie: 1.4, licht: 0.9 }) +
    // zotteliger Kopf mit Faultiermaske
    st.form(kopf, fell, { innen: fellStriche(kopf, 5.5, [dunkel, hell], { laenge: 8, breite: 1.8, richtung: 95, saat: 9 }) }) +
    st.form(maske, "#e8d6bd", { licht: 0.5, innen: fellStriche(maske, 7, ["#d6bfa2"], { laenge: 5, breite: 1.1, richtung: 90, saat: 2 }) }) +
    `<path d="${streifen}" fill="#4a3426"/><path d="${spiegel(streifen)}" fill="#4a3426"/>` +
    auge(st, 104, 92, 1, augenArt) +
    auge(st, 136, 92, -1, augenArt) +
    (wut ? pinsel([[94, 80], [104, 83], [114, 88]], 4.4) + pinsel([[146, 80], [136, 83], [126, 88]], 4.4) : "") +
    // Monokel mit Glas und Kettchen
    `<circle cx="136" cy="92" r="10.5" fill="#fff" opacity=".16"/>` +
    pinsel([[130, 86], [133, 84], [137, 83.5]], 1.8, "#fff", { deckung: 0.8 }) +
    `<circle cx="136" cy="92" r="10.5" fill="none" stroke="${LINIE}" stroke-width="5"/><circle cx="136" cy="92" r="10.5" fill="none" stroke="#f4c400" stroke-width="2.6"/>` +
    `<path d="M145 97 Q152 116 125 127" fill="none" stroke="#f4c400" stroke-width="1.8" stroke-dasharray="2.4 1.4"/>` +
    // Nase
    st.form("M111 101 C111 96 129 96 129 101 C129 107 124 110 120 110 C116 110 111 107 111 101 Z", "#2a1c16", { linie: 2.2, licht: 0.9 }) +
    `<ellipse cx="116" cy="100" rx="3" ry="1.6" fill="#fff" opacity=".6"/>` +
    maul +
    // Haarbüschel unter dem Hut
    pinsel([[96, 66], [90, 60], [86, 62]], 2.6, dunkel) +
    pinsel([[144, 66], [151, 61], [155, 64]], 2.6, dunkel) +
    // Zylinder, schief und etwas eingedrückt
    `<g transform="rotate(9 120 62)">` +
    st.form("M98 62 C94 48 96 34 100 24 C112 20 128 20 140 24 C142 36 146 48 142 62 Z", "#25212a", {
      licht: 0.35,
      innen: pinsel([[104, 28], [102, 42], [104, 56]], 4, "#fff", { deckung: 0.18 }) + `<path d="M97 49 C112 46 128 46 143 49 L143 58 C128 55 112 55 97 58 Z" fill="#a8131b"/>`,
    }) +
    st.form("M113 47 L127 47 L127 57 L113 57 Z", "#f4c400", { linie: 1.6, licht: 0.8 }) +
    `<rect x="116.5" y="50" width="7" height="4" fill="#a8131b"/>` +
    st.form("M78 64 C92 56 148 56 162 64 C164 70 152 72 120 70 C88 72 76 70 78 64 Z", "#25212a", { licht: 0.35 }) +
    `</g>`
  );
}

/** Pommes, Ursprung am unteren Ende, zeigt bei `w` = 0 nach oben. */
function pommes(st: Stift, x: number, y: number, w: number, l = 26): string {
  const d = setze(`M-4.4 2 L-4.8 ${-l} Q0 ${-l - 2.6} 4.6 ${-l} L4.2 2 Z`, x, y, w);
  const spitze = setze(`M-7 ${-l - 5} L7 ${-l - 5} L7 ${-l + 4} L-7 ${-l + 2} Z`, x, y, w);
  return (
    st.form(d, "#ffcc3a", { linie: 2, licht: 0.5, schatten: -0.1, innen: `<path d="${spitze}" fill="#d0801c" opacity=".75"/>` }) +
    pinsel(setzeP([[-1.8, -3], [-2, -l + 5]], x, y, w), 1.4, "#fff", { deckung: 0.55 })
  );
}

/** Pinselfetzen mit Tuschekante (Salat, Rotkohl, Haarlocken). */
const fetzen = (pts: readonly Punkt[], farbe: string, breite = 4) =>
  pinsel(pts, breite, LINIE, { anfang: 0.2, ende: 0.3 }) + pinsel(pts, breite * 0.55, farbe, { anfang: 0.2, ende: 0.35 });

/** Herablaufender Tropfen (Soße, Schaum) ab (x, y), `l` lang. */
function tropfen(st: Stift, x: number, y: number, l: number, farbe: string): string {
  return st.form(
    `M${x - 2.6} ${y} C${x - 2.2} ${y + l * 0.5} ${x - 4.2} ${y + l * 0.72} ${x - 3.8} ${y + l * 0.9} C${x - 3.2} ${y + l + 1.6} ${x + 3.2} ${y + l + 1.6} ${x + 3.8} ${y + l * 0.9} C${x + 4.2} ${y + l * 0.72} ${x + 2.2} ${y + l * 0.5} ${x + 2.6} ${y} Z`,
    farbe,
    { linie: 2, licht: 0.9, schatten: -0.12 },
  );
}

/** Spitze Zähne im Maul, oben (nach unten zeigend) entlang `y`. */
const zaehne = (xs: readonly number[], y: number, h = 8, mitte = 120) =>
  xs.map((x) => `<path d="M${x - 4} ${y - Math.abs(x - mitte) * 0.1} l4 ${h} l4 ${-h} Z" fill="#fffdf6" stroke="${LINIE}" stroke-width="1.1" stroke-linejoin="round"/>`).join("");

/** Der Dönerteller XXL: Berg aus Dönerspänen mit Eisbergsalat, Rotkohl, Tomate, Zwiebel und Knoblauchsoße, dazu Fladenbrot, Pommes, Ketchup und Peperoni. */
function doenerteller(st: Stift, wut: boolean): string {
  const kruste = "#4e2208";
  const weiss = "#fbf6ea";
  const teller = "M24 204 C24 190 78 182 120 182 C162 182 216 190 216 204 C216 219 162 226 120 226 C78 226 24 219 24 204 Z";
  const fladen = "M80 124 C66 110 54 90 50 66 C49 58 55 54 62 57 C78 62 94 78 102 96 Z";
  const huegel =
    "M58 200 C50 194 50 184 56 180 C48 170 48 154 54 144 C50 134 56 122 66 118 C64 104 76 92 92 90 C98 80 112 74 124 78 " +
    "C136 74 150 80 152 92 C166 92 178 104 176 118 C186 124 190 136 186 146 C192 158 192 172 184 180 C190 186 190 196 182 200 " +
    "C150 208 90 208 58 200 Z";
  const salat = "M70 106 C64 96 72 86 82 89 C84 78 98 72 107 79 C113 69 129 68 134 78 C144 71 159 78 157 89 C167 86 176 96 170 106 C150 113 90 113 70 106 Z";
  // Schichtkanten der Dönerspäne
  const schichten: Punkt[][] = [
    [[66, 118], [88, 123], [110, 120], [132, 124], [154, 120], [176, 118]],
    [[54, 144], [64, 149], [79, 147]],
    [[186, 146], [176, 150], [161, 148]],
    [[56, 180], [80, 185], [104, 182], [128, 186], [152, 182], [184, 180]],
  ];
  const grill: Punkt[][] = [
    [[40, 84], [100, 62]],
    [[44, 100], [106, 78]],
    [[52, 116], [110, 94]],
  ];
  const blasen: Punkt[] = [[60, 72], [70, 92], [80, 104], [58, 84]];
  const fladenInnen = (s: 1 | -1) => {
    const p = (q: Punkt[]) => (s === 1 ? q : spiegelP(q));
    return (
      `<path d="${s === 1 ? fladen : spiegel(fladen)}" fill="none" stroke="#b5722e" stroke-width="9" opacity=".5"/>` +
      grill.map((l) => pinsel(p(l), 3.4, "#7a4416", { anfang: 0.1, ende: 0.1, deckung: 0.75 })).join("") +
      p(blasen).map(([x, y]) => `<path d="${ellipse(x, y, 2.6, 1.5)}" fill="#fff4d8" opacity=".7"/>`).join("")
    );
  };
  const fleisch =
    fellStriche(huegel, 6.5, ["#7a3a12", "#c98446", "#94501f"], { laenge: 15, breite: 2.6, richtung: 4, saat: 17 }) +
    schichten.map((l) => pinsel(l.map(([x, y]) => [x, y - 2.8] as const), 2.4, "#eaa86a", { deckung: 0.6 }) + pinsel(l, 3.4, kruste)).join("") +
    `<path d="${huegel}" fill="none" stroke="${kruste}" stroke-width="8" opacity=".3"/>` +
    // Fettglanz
    pinsel([[70, 128], [66, 142], [68, 158]], 4, "#fff", { deckung: 0.4 }) +
    pinsel([[60, 186], [64, 194]], 3, "#fff", { deckung: 0.35 });
  const tomate = (x: number, y: number, w: number) =>
    st.form(setze(ellipse(0, 0, 11, 7), x, y, w), "#e2352b", {
      linie: 2.4,
      licht: 0.8,
      innen:
        `<path d="${setze(ellipse(0, 0, 8, 4.8), x, y, w)}" fill="#ff7a5c"/>` +
        ([[-4, -1], [4, -1], [0, 2.2]] as const).map(([u, v]) => `<path d="${setze(ellipse(u, v, 2.6, 1.5), x, y, w)}" fill="#ffd2a6"/>`).join("") +
        `<path d="${setze(ellipse(0, 0, 1.6, 1.1), x, y, w)}" fill="#fff0da"/>`,
    });
  const zwiebel = (x: number, y: number) =>
    `<path d="${ellipse(x, y, 9, 5.4)}" fill="none" stroke="${LINIE}" stroke-width="5.2"/><path d="${ellipse(x, y, 9, 5.4)}" fill="none" stroke="#c88ade" stroke-width="3"/><path d="${ellipse(x, y, 8.3, 4.7)}" fill="none" stroke="#f6eafb" stroke-width="1"/>`;
  const garnitur =
    st.form(salat, "#7fcf4a", { linie: 2.8, innen: fellStriche(salat, 5, ["#4f9e2c", "#c8f2a0", "#68b83a"], { laenge: 11, breite: 1.9, richtung: -12, saat: 8 }) }) +
    fetzen([[74, 104], [70, 112], [72, 119]], "#b6e88a") +
    fetzen([[166, 104], [171, 111], [169, 118]], "#b6e88a") +
    fetzen([[100, 108], [98, 116]], "#9ad86a") +
    // Rotkohl
    fetzen([[88, 86], [95, 81], [102, 84]], "#9b3794") +
    fetzen([[124, 73], [131, 77], [138, 75]], "#9b3794") +
    fetzen([[151, 97], [157, 93], [164, 96]], "#9b3794") +
    fetzen([[110, 96], [116, 100]], "#9b3794") +
    tomate(94, 92, -14) +
    tomate(146, 88, 12) +
    zwiebel(120, 84) +
    zwiebel(80, 98);
  // Knoblauchsoße im Zickzack, Tropfen laufen übers Fleisch, darauf Chiliflocken
  const zickzack: Punkt[] = [[71, 104], [82, 112], [93, 102], [105, 112], [117, 102], [129, 112], [141, 102], [153, 112], [167, 104]];
  const flocken: Punkt[] = [[88, 106], [112, 104], [124, 109], [146, 104], [100, 96], [136, 92], [160, 100], [118, 90]];
  const sosse =
    tropfen(st, 83, 108, 18, weiss) +
    tropfen(st, 107, 110, 6, weiss) +
    tropfen(st, 140, 105, 13, weiss) +
    pinsel(zickzack, 8.6, LINIE, { anfang: 0.08, ende: 0.08 }) +
    pinsel(zickzack, 5.6, weiss, { anfang: 0.08, ende: 0.1 }) +
    pinsel(zickzack.map(([x, y]) => [x - 0.6, y - 1.3] as const), 1.8, "#fff", { deckung: 0.9 }) +
    flocken.map(([x, y], i) => `<path d="M${x} ${y} l2.2 -1 l0.6 2 l-2 1 Z" fill="${i % 2 ? "#c2160c" : "#7a0a06"}"/>`).join("");
  const augenArt: AugeArt = wut
    ? { r: 10, iris: "#d9141c", lidfarbe: "#8a4a1c", lid: 0.18, neigung: 26, blick: [0, 0.1], adern: true }
    : { r: 10, iris: "#5a2f12", lidfarbe: "#8a4a1c", lid: 0.34, neigung: -8, blick: [0.28, 0.25] };
  const brauen = wut
    ? pinsel([[86, 119], [101, 123], [116, 131]], 6.4, kruste, { anfang: 0.1, ende: 0.5 }) + pinsel([[154, 119], [139, 123], [124, 131]], 6.4, kruste, { anfang: 0.1, ende: 0.5 })
    : pinsel([[90, 123], [102, 119], [114, 122]], 4.2, kruste) + pinsel([[126, 118], [138, 112], [151, 116]], 4.2, kruste);
  const maul = wut
    ? st.form("M94 152 C102 146 112 150 120 151 C128 150 138 146 146 152 C148 170 136 184 120 184 C104 184 92 170 94 152 Z", "#4a0a10", { linie: 3, licht: 0.2 }) +
      `<path d="M104 176 C110 168 130 168 136 176 C130 183 110 183 104 176 Z" fill="#e85a6b"/>` +
      zaehne([101, 110.5, 120, 129.5, 139], 151) +
      `<path d="M106 179 l3 -7 l3 7 Z M128 179 l3 -7 l3 7 Z" fill="#fffdf6" stroke="${LINIE}" stroke-width="1.1" stroke-linejoin="round"/>` +
      // Soße sabbert aus dem Maul
      tropfen(st, 110, 180, 14, weiss) +
      tropfen(st, 131, 181, 9, weiss)
    : pinsel([[97, 158], [110, 166], [126, 166], [142, 155]], 3.8, LINIE, { anfang: 0.15, ende: 0.15 }) +
      pinsel([[94, 153], [96.5, 157.5], [95.5, 162]], 2.2) +
      // leckt sich die Soße aus dem Mundwinkel
      st.form("M130 162 C133 157 142 156 145 162 C148 168 142 173 137 170 C134 168 131 166 130 162 Z", "#e85a6b", { linie: 2.2, licht: 0.6 }) +
      pinsel([[137, 161], [138.5, 167]], 1.2, "#b03040") +
      `<path d="${ellipse(148, 157, 3, 2.4)}" fill="${weiss}" stroke="${LINIE}" stroke-width="1.2"/>`;
  return (
    st.form(teller, "#f6f4ef", {
      licht: 0.6,
      innen: `<path d="${ellipse(120, 202, 70, 11)}" fill="#e2ddd1"/><path d="${ellipse(120, 203, 86, 15.5)}" fill="none" stroke="#3b78c9" stroke-width="2.6"/>`,
    }) +
    pinsel([[44, 213], [88, 221], [152, 221], [196, 213]], 2.4, "#fff", { deckung: 0.85 }) +
    // Ketchup
    st.form("M32 206 C30 198 40 193 48 197 C56 195 61 203 55 208 C49 212 37 212 32 206 Z", "#d4211a", { linie: 2.2, licht: 0.9 }) +
    pommes(st, 62, 198, -62, 30) +
    pommes(st, 54, 202, -40, 24) +
    pommes(st, 66, 196, -80, 26) +
    pommes(st, 178, 198, 62, 30) +
    pommes(st, 186, 202, 40, 24) +
    pommes(st, 174, 196, 80, 26) +
    st.form(fladen, "#ebc27c", { linie: 2.8, innen: fladenInnen(1) }) +
    st.form(spiegel(fladen), "#ebc27c", { linie: 2.8, innen: fladenInnen(-1) }) +
    st.form(huegel, "#a8612c", { innen: fleisch, schraffur: 0.25 }) +
    garnitur +
    sosse +
    auge(st, 102, 136, 1, augenArt) +
    auge(st, 138, 136, -1, augenArt) +
    brauen +
    maul +
    pommes(st, 86, 216, -96, 22) +
    pommes(st, 154, 217, 94, 24) +
    // Peperoni
    st.form(setze("M-16 0 C-14 -6 6 -7 14 -3 C18 -1 18 3 14 4 C6 6 -12 6 -16 0 Z", 194, 210, -14), "#c8d45a", { linie: 2.2, licht: 0.8 }) +
    pinsel(setzeP([[14, 0], [19, -1], [22, -4]], 194, 210, -14), 2.6, "#4f8a2a")
  );
}

/** Das Sofa der Verdammnis: Chesterfield-Ohrensessel mit Teufelshörnern, tiefen Polsterknöpfen, Schneckenlehnen und Quastenvolant. */
function sofa(st: Stift, wut: boolean): string {
  const samt = "#7a2c8c";
  const tief = "#3e1249";
  const hell = "#c27ad6";
  const lehne =
    "M74 152 C68 124 62 96 56 72 C52 56 62 44 76 50 C84 40 102 36 120 42 C138 36 156 40 164 50 " +
    "C178 44 188 56 184 72 C178 96 172 124 166 152 Z";
  // Polsterknöpfe im Rautenraster, dazwischen Falten und gewölbte Polster
  const knoepfe: Punkt[] = [];
  for (let j = 0; j < 6; j++)
    for (let i = -4; i <= 4; i++) {
      const [x, y] = [120 + i * 22 + (j % 2) * 11, 58 + j * 17];
      const rand = 58 + Math.max(0, y - 64) * 0.19 + 5;
      if (x > rand && x < 240 - rand) knoepfe.push([x, y]);
    }
  const hat = (x: number, y: number) => knoepfe.some(([u, v]) => Math.abs(u - x) < 0.1 && Math.abs(v - y) < 0.1);
  let falten = "";
  let polster = "";
  let mulden = "";
  let koepfe = "";
  for (const [x, y] of knoepfe) {
    for (const s of [-1, 1])
      if (hat(x + s * 11, y + 17))
        falten +=
          pinsel([[x, y], [x + s * 11, y + 17]], 2.4, tief, { anfang: 0.3, ende: 0.3, schritte: 3 }) +
          pinsel([[x - 1.3, y - 0.6], [x + s * 11 - 1.3, y + 16.4]], 1.2, hell, { deckung: 0.5, schritte: 3 });
    if (y === 58) falten += pinsel([[x, y], [x + 1, y - 14]], 2, tief, { anfang: 0.1, ende: 0.5, schritte: 3 });
    if (!hat(x - 11, y + 17) && !hat(x + 11, y + 17)) falten += pinsel([[x, y], [x, y + 12]], 2, tief, { anfang: 0.1, ende: 0.5, schritte: 3 });
    polster += `<ellipse cx="${x - 3}" cy="${y + 13}" rx="6.5" ry="4.5" fill="#fff" opacity=".22"/><ellipse cx="${x - 13}" cy="${y - 4}" rx="5" ry="3.5" fill="#fff" opacity=".12"/>`;
    mulden += `<circle cx="${x}" cy="${y}" r="4.6" fill="${tief}" opacity=".6"/>`;
    koepfe += `<circle cx="${x}" cy="${y}" r="2.6" fill="#2a0a32"/><circle cx="${x - 0.8}" cy="${y - 0.9}" r=".9" fill="${hell}"/>`;
  }
  const kante: Punkt[] = [[58, 70], [60, 57], [68, 51], [77, 51], [88, 44], [104, 41], [120, 45], [136, 41], [152, 44], [163, 51], [172, 51], [180, 57], [182, 70]];
  const horn = "M92 60 C80 50 70 34 74 14 C75 9 80 8 81 13 C83 30 93 42 107 52 Z";
  const ringe: Punkt[][] = [
    [[84, 56], [93, 53], [101, 46]],
    [[75, 46], [84, 44], [92, 37]],
    [[72, 34], [79, 32], [86, 26]],
    [[72, 24], [77, 22], [82, 18]],
  ];
  const hornInnen = (s: 1 | -1) =>
    `<path d="${ellipse(s === 1 ? 77 : 163, 14, 7, 9)}" fill="#5a080d" opacity=".55" ${st.weich()}/>` +
    ringe.map((r) => (s === 1 ? r : spiegelP(r))).map((r) => pinsel(r, 2.2, "#6e0b10", { anfang: 0.1, ende: 0.1 }) + pinsel(r.map(([x, y]) => [x, y - 1.8] as const), 1.4, "#ff7a6a", { deckung: 0.6 })).join("");
  const rippenUnten: Punkt[][] = [
    [[46, 162], [45, 180], [46, 197]],
    [[60, 160], [60, 180], [61, 199]],
    [[75, 160], [76, 180], [77, 198]],
  ];
  const glanzUnten: Punkt[][] = [
    [[52, 161], [52, 190]],
    [[68, 161], [68, 190]],
  ];
  const rolle = (s: 1 | -1) => {
    const d = (p: string) => (s === 1 ? p : spiegel(p));
    const p = (q: Punkt[]) => (s === 1 ? q : spiegelP(q));
    const cx = s === 1 ? 61 : 179;
    let rippen = "";
    for (let k = 0; k < 14; k++) {
      const w = (k / 14) * Math.PI * 2;
      rippen += pinsel([[cx + Math.cos(w) * 3.5, 141 + Math.sin(w) * 3.5], [cx + Math.cos(w) * 15, 141 + Math.sin(w) * 15]], 1.8, tief, { anfang: 0.6, ende: 0.2, schritte: 3 });
    }
    return (
      st.form(d("M38 198 C34 172 34 148 42 134 C50 120 72 118 82 130 C88 138 88 150 84 158 L86 198 C70 204 52 204 38 198 Z"), samt, {
        schraffur: 0.25,
        innen:
          rippenUnten.map((l) => pinsel(p(l), 2, tief, { deckung: 0.6 })).join("") +
          glanzUnten.map((l) => pinsel(p(l), 2.6, hell, { deckung: 0.35 })).join(""),
      }) +
      st.form(kreis(cx, 141, 15), "#86349a", { linie: 2.6, innen: rippen }) +
      `<circle cx="${cx}" cy="141" r="3.4" fill="${tief}" stroke="${LINIE}" stroke-width="1.4"/><circle cx="${cx - 1}" cy="140" r="1" fill="${hell}"/>`
    );
  };
  const bein = (s: 1 | -1) => {
    const d = (p: string) => (s === 1 ? p : spiegel(p));
    return (
      st.form(d("M55 198 C53 204 59 206 57 210 C55 214 51 216 49 219 L65 219 C65 216 61 214 63 210 C65 206 70 204 68 198 Z"), "#4a2a14", { linie: 2.2 }) +
      st.form(d("M54 204 L69 204 L68 208 L55 208 Z"), "#f4c400", { linie: 1.6, licht: 0.9 }) +
      st.form(d("M46 222 C46 217 51 215 55 217 C57 214 61 214 63 217 C66 215 71 217 70 222 Z"), "#3a1d0c", { linie: 1.8 })
    );
  };
  const volant = "M40 192 L200 192 L200 200 " + Array.from({ length: 10 }, (_, i) => `Q${192 - i * 16} 212 ${184 - i * 16} 200`).join(" ") + " Z";
  const quaste = (x: number) =>
    pinsel([[x, 199], [x, 204]], 1.8, "#9a6a00", { anfang: 0, ende: 0 }) +
    st.form(`M${x - 2.4} 203 L${x + 2.4} 203 L${x + 3.6} 212 C${x + 1} 213.5 ${x - 1} 213.5 ${x - 3.6} 212 Z`, "#f4c400", { linie: 1.4, licht: 0.8 });
  const kissen = "M72 188 C66 168 80 156 120 158 C160 156 174 168 168 188 C150 196 90 196 72 188 Z";
  const keder: Punkt[] = [[74, 178], [96, 184], [120, 185], [144, 184], [166, 178]];
  const watte = "M0 0 C-6 -1 -7 -9 -1 -10 C1 -16 9 -15 9 -9 C15 -8 15 -1 9 1 C7 5 2 5 0 0 Z";
  const augenArt: AugeArt = wut
    ? { r: 11, iris: "#d9141c", lidfarbe: samt, lid: 0.16, neigung: 26, blick: [0, 0.1], adern: true }
    : { r: 11, iris: "#e0a81c", lidfarbe: samt, lid: 0.44, neigung: -10, blick: [0.38, 0.12] };
  const brauen = wut
    ? pinsel([[86, 72], [100, 76], [114, 84]], 6.6, LINIE, { anfang: 0.1, ende: 0.5 }) + pinsel([[154, 72], [140, 76], [126, 84]], 6.6, LINIE, { anfang: 0.1, ende: 0.5 })
    : pinsel([[89, 76], [101, 72], [113, 75]], 4.2, tief) + pinsel([[127, 71], [139, 64], [152, 68]], 4.2, tief);
  const feder: Punkt[] = [[106, 134], [111, 126], [116, 133], [121, 125], [126, 132], [131, 124], [135, 130]];
  const maul = wut
    ? st.form("M95 108 C104 102 114 106 120 106 C126 106 136 102 145 108 C147 126 135 140 120 140 C105 140 93 126 95 108 Z", "#2a0a14", { linie: 3, licht: 0.2 }) +
      // Sprungfeder statt Zunge
      pinsel(feder, 4.6, LINIE, { anfang: 0, ende: 0 }) +
      pinsel(feder, 2.2, "#c9ccd4", { anfang: 0, ende: 0 }) +
      zaehne([101, 110.5, 120, 129.5, 139], 107) +
      // aus dem Riss quillt Füllwatte
      st.form(setze(watte, 93, 121, -20, 0.62), "#f4efe6", { linie: 1.6, licht: 0.6 }) +
      st.form(setze(watte, 142, 118, 25, 0.55), "#f4efe6", { linie: 1.6, licht: 0.6 })
    : pinsel([[99, 116], [111, 123], [127, 122], [141, 112]], 3.8, LINIE, { anfang: 0.15, ende: 0.15 }) +
      pinsel([[138, 108], [142.5, 111.5], [141.5, 116]], 2.2) +
      `<path d="M106 126 l3 -1.2 l1.2 2.6 l-3 1.2 Z M131 127 l2.4 -1.6 l1.6 2 l-2.6 1.4 Z" fill="#f4c400" stroke="${LINIE}" stroke-width=".9"/>`;
  return (
    bein(1) +
    bein(-1) +
    st.form(horn, "#c41a22", { linie: 2.6, innen: hornInnen(1) }) +
    st.form(spiegel(horn), "#c41a22", { linie: 2.6, innen: hornInnen(-1) }) +
    st.form(lehne, samt, { innen: `<g ${st.weich()}>${polster}${mulden}</g>` + falten + koepfe, schraffur: 0.18 }) +
    pinsel(kante, 2.4, tief, { anfang: 0.05, ende: 0.05 }) +
    pinsel(kante.map(([x, y]) => [x, y - 1.2] as const), 1.2, hell, { deckung: 0.6 }) +
    st.form(volant, "#5a1c68", {
      linie: 2.6,
      innen: Array.from({ length: 10 }, (_, i) => pinsel([[192 - i * 16, 194], [192 - i * 16, 206]], 2, tief, { anfang: 0.3, ende: 0.2, deckung: 0.7 })).join(""),
    }) +
    [88, 104, 120, 136, 152].map(quaste).join("") +
    rolle(1) +
    rolle(-1) +
    // in der Ritze: Popcorn und eine Münze
    st.form(setze("M-5 0 C-8 -6 -2 -9 0 -6 C2 -10 8 -7 6 -2 C10 0 7 7 2 5 C0 9 -6 7 -5 3 C-9 3 -9 -1 -5 0 Z", 82, 162, 15, 1.2), "#fff7d6", { linie: 1.8, licht: 0.6 }) +
    st.form(ellipse(158, 163, 5, 6.5), "#f4c400", { linie: 1.8, licht: 0.9, innen: `<path d="${ellipse(158, 163, 3, 4.4)}" fill="none" stroke="#b98a00" stroke-width="1.2"/>` }) +
    st.form(kissen, "#8f3aa4", {
      innen:
        pinsel(keder, 2.2, tief, { deckung: 0.7 }) +
        pinsel(keder.map(([x, y]) => [x, y - 1.6] as const), 1.4, hell, { deckung: 0.6 }) +
        `<ellipse cx="120" cy="171" rx="8" ry="4.5" fill="${tief}" opacity=".5" ${st.weich()}/>` +
        pinsel([[103, 166], [115, 170]], 1.6, tief, { deckung: 0.6 }) +
        pinsel([[137, 166], [125, 170]], 1.6, tief, { deckung: 0.6 }) +
        `<circle cx="120" cy="171" r="2.6" fill="#2a0a32"/>` +
        `<path d="M98 180 l3 -1.2 l1.2 2.4 l-2.8 1.2 Z M142 176 l2.4 -1.6 l1.4 2.2 l-2.4 1.2 Z M110 186 l2.4 -.6 l.8 2 l-2.4 .8 Z" fill="#f4c400" stroke="${LINIE}" stroke-width=".8"/>`,
    }) +
    auge(st, 102, 92, 1, augenArt) +
    auge(st, 138, 92, -1, augenArt) +
    brauen +
    maul
  );
}

/** König Bierbauch: rotbärtiger Bierkönig mit schiefer Krone, Bierschaum im Zwirbelbart, Hermelinkragen, Hosenträgern, Lederhose und nacktem Bauch. */
function koenigBierbauch(st: Stift, wut: boolean): string {
  const haut = "#f1bf92";
  const falte = "#c4845a";
  const bart = "#c66f2a";
  const bartDunkel = "#8a4416";
  const bartHell = "#eda35e";
  const gold = "#f4c400";
  const leib =
    "M120 50 C138 49 150 62 150 80 C150 92 147 100 142 106 C160 112 176 128 182 152 C190 182 176 206 150 212 " +
    "C132 216 108 216 90 212 C64 206 50 182 58 152 C64 128 80 112 98 106 C93 100 90 92 90 80 C90 62 102 49 120 50 Z";
  const mantel = "M86 110 C60 140 44 180 38 214 C80 222 160 222 202 214 C196 180 180 140 154 110 Z";
  const ohr = "M92 74 C85 70 80 77 82 84 C83 90 88 93 93 90 Z";
  const hose = "M60 182 C84 198 156 198 180 182 C184 194 180 206 170 213 L70 213 C60 206 56 194 60 182 Z";
  const ranzen = "M62 180 C84 196 156 196 178 180 C177 190 160 201 120 202 C80 201 63 190 62 180 Z";
  const kragen =
    "M78 106 C92 120 148 120 162 106 C166 112 165 118 160 121 C160 126 154 129 149 127 C147 132 141 134 137 131 " +
    "C133 135 125 136 121 133 C117 136 109 135 105 131 C100 133 94 132 92 127 C86 129 80 126 80 121 C76 118 74 112 78 106 Z";
  const vollbart =
    "M91 86 C86 104 90 124 98 138 C102 146 106 150 110 152 C111 159 115 164 120 167 C125 164 129 159 130 152 " +
    "C134 150 138 146 142 138 C150 124 154 104 149 86 C142 100 132 104 120 102 C108 104 98 100 91 86 Z";
  const schnauzer = "M120 94 C112 90 102 90 96 94 C92 97 88 96 86 92 C85 88 88 86 91 88 C88 89 87 92 89 95 C93 100 102 102 108 101 C113 100 117 99 120 99 Z";
  const nase = "M113 84 C112 78 128 78 127 84 C132 86 133 93 127 95 C124 98 116 98 113 95 C107 93 108 86 113 84 Z";
  const traeger = ["M98 110 C92 140 88 168 90 192", "M142 110 C148 140 152 168 150 192"];
  const schaum = (x: number, y: number) =>
    st.form(`M${x - 5} ${y + 1} C${x - 7} ${y - 2} ${x - 4} ${y - 5} ${x - 2} ${y - 3} C${x - 1} ${y - 6} ${x + 3} ${y - 6} ${x + 3} ${y - 3} C${x + 6} ${y - 4} ${x + 7} ${y} ${x + 5} ${y + 1} Z`, "#fffdf6", { linie: 1.4, licht: 0.4, schatten: -0.12 });
  const edelweiss = (x: number, y: number, g = 1) =>
    `<g transform="translate(${x} ${y}) scale(${g})">` +
    [0, 72, 144, 216, 288].map((w) => `<path d="M0 0 C-2 -3 -1.6 -7 0 -8 C1.6 -7 2 -3 0 0 Z" transform="rotate(${w})" fill="#fffdf6" stroke="${LINIE}" stroke-width=".9"/>`).join("") +
    `<circle r="1.8" fill="#f4c400" stroke="${LINIE}" stroke-width=".7"/></g>`;
  const locken: Punkt[][] = [
    [[100, 172], [102, 168], [105, 170]],
    [[138, 175], [140, 171], [143, 173]],
    [[110, 186], [112, 182], [115, 184]],
    [[76, 150], [78, 146], [81, 148]],
    [[162, 150], [164, 146], [167, 148]],
    [[150, 186], [152, 182], [155, 184]],
  ];
  const augeL: AugeArt = wut
    ? { r: 7.5, iris: "#d9141c", lidfarbe: haut, lid: 0.16, neigung: 26, blick: [0, 0.1], adern: true }
    : { r: 7.5, iris: "#3f7fc4", lidfarbe: haut, lid: 0.5, neigung: -14, blick: [0.32, 0.18], adern: true, sack: "#d9906e" };
  const augeR: AugeArt = wut ? augeL : { ...augeL, blick: [-0.3, 0.18] };
  const braue = (pts: Punkt[]) =>
    pinsel(pts, 5.6, bartDunkel, { anfang: 0.2, ende: 0.4 }) + pinsel(pts.map(([x, y]) => [x - 0.5, y - 1] as const), 2.4, bartHell, { anfang: 0.3, ende: 0.5, deckung: 0.85 });
  const brauen = wut
    ? braue([[97, 60], [107, 63], [116, 69]]) + braue([[143, 60], [133, 63], [124, 69]])
    : braue([[98, 63], [107, 60], [116, 63]]) + braue([[124, 62], [133, 58], [142, 61]]);
  const maul = wut
    ? st.form("M104 99 C110 97 130 97 136 99 C138 114 130 125 120 125 C110 125 102 114 104 99 Z", "#4a0a10", { linie: 2.6, licht: 0.2 }) +
      `<path d="M110 120 C114 115 126 115 130 120 C126 124 114 124 110 120 Z" fill="#e85a6b"/>` +
      zaehne([108, 116, 124, 132], 99, 6)
    : st.form("M110 100 C114 103 126 103 130 100 C129 106 125 109 120 109 C115 109 111 106 110 100 Z", "#5a1a14", { linie: 2, licht: 0.2 }) +
      `<path d="M114 106 C117 103 123 103 126 106 C123 109 117 109 114 106 Z" fill="#e85a6b"/>`;
  const krone = drehe("M96 56 L93 32 L108 43 L120 23 L132 43 L147 32 L144 56 C128 51 112 51 96 56 Z", 120, 46, -12);
  const reif = drehe("M95 57 C112 52 128 52 145 57 L145.6 48 C128 43 112 43 94.6 48 Z", 120, 46, -12);
  const [perle1, perle2, perle3] = dreheP([[93, 30], [120, 21], [147, 30]], 120, 46, -12);
  const steine = dreheP([[106, 50], [120, 48], [134, 50]], 120, 46, -12);
  return (
    // Königsmantel mit Falten und Goldsaum
    st.form(mantel, "#b3141c", {
      innen:
        pinsel([[66, 148], [58, 180], [54, 210]], 3, "#6e0a10") +
        pinsel([[174, 148], [182, 180], [186, 210]], 3, "#6e0a10") +
        pinsel([[71, 150], [63, 182], [60, 210]], 2.4, "#ee5a62", { deckung: 0.45 }) +
        pinsel([[179, 150], [187, 182], [190, 210]], 2.4, "#ee5a62", { deckung: 0.45 }) +
        pinsel([[40, 211], [80, 218], [120, 220], [160, 218], [200, 211]], 9, gold, { anfang: 0, ende: 0 }) +
        pinsel([[40, 206], [80, 213], [120, 215], [160, 213], [200, 206]], 1.4, "#9a6a00", { anfang: 0, ende: 0 }),
    }) +
    st.form(ohr, haut, { linie: 2.4 }) +
    st.form(spiegel(ohr), haut, { linie: 2.4 }) +
    pinsel([[90, 78], [86, 81], [87, 86]], 1.8, falte) +
    pinsel([[150, 78], [154, 81], [153, 86]], 1.8, falte) +
    // nackter Bauch mit Glanz, Brusthaar und Nabel
    st.form(leib, haut, {
      schraffur: 0.18,
      innen: `<ellipse cx="96" cy="158" rx="16" ry="26" fill="#fff" opacity=".28" ${st.weich()}/>` + locken.map((l) => pinsel(l, 1.6, "#a8693c")).join(""),
    }) +
    pinsel([[116, 177], [120, 181.5], [124, 177]], 2.6, falte) +
    `<circle cx="120" cy="178.6" r="1.6" fill="${falte}"/>` +
    // Lederhose mit Steppnaht, Latz, Hirschhornknöpfen und Edelweiß
    st.form(hose, "#6b4423", {
      innen:
        `<path d="M64 191 C88 203 152 203 176 191" fill="none" stroke="#e2c08a" stroke-width="1.3" stroke-dasharray="3 2.4"/>` +
        `<path d="M100 199 L140 199 L139 216 L101 216 Z" fill="#7d5230"/>` +
        `<path d="M103 202 L137 202 L136.4 216 M103.6 216 L103 202" fill="none" stroke="#e2c08a" stroke-width="1.1" stroke-dasharray="2.4 2"/>` +
        pinsel([[70, 200], [78, 206], [84, 212]], 2.2, "#3e2412") +
        pinsel([[170, 200], [162, 206], [156, 212]], 2.2, "#3e2412"),
    }) +
    `<circle cx="106" cy="206" r="2.4" fill="#efe3c8" stroke="${LINIE}" stroke-width="1.2"/><circle cx="134" cy="206" r="2.4" fill="#efe3c8" stroke="${LINIE}" stroke-width="1.2"/>` +
    edelweiss(120, 208, 0.75) +
    // der Bauch hängt über den Hosenbund
    st.form(ranzen, haut, { linie: 2.8, licht: 0.3 }) +
    pinsel([[70, 189], [96, 199], [144, 199], [170, 189]], 2.6, falte) +
    traeger.map((d) => strich(d, 9) + strich(d, 5.6, "#2f6b3a") + `<path d="${d}" fill="none" stroke="#a8d8a0" stroke-width=".9" stroke-dasharray="2.4 2"/>`).join("") +
    st.form("M86 166 L95 166 L95 175 L86 175 Z", gold, { linie: 1.6, licht: 0.9 }) +
    st.form("M145 166 L154 166 L154 175 L145 175 Z", gold, { linie: 1.6, licht: 0.9 }) +
    edelweiss(90.5, 146) +
    edelweiss(149.5, 146) +
    // Hermelinkragen mit schwarzen Schwanzspitzen
    st.form(kragen, "#f6f3ec", {
      linie: 2.8,
      innen: fellStriche(kragen, 4.5, ["#d9d4ca", "#ffffff"], { laenge: 6, breite: 1.4, richtung: 90, saat: 12 }),
    }) +
    [[86, 117], [95, 125], [145, 125], [154, 117]].map(([x, y]) => `<path d="M${x! - 1.8} ${y! - 3} L${x! + 1.8} ${y! - 3} L${x! + 0.9} ${y! + 3} L${x} ${y! + 5.4} L${x! - 0.9} ${y! + 3} Z" fill="${LINIE}"/>`).join("") +
    // rote Haarbüschel unter der Krone
    fetzen([[94, 66], [88, 63], [85, 67], [87, 72]], bart, 6) +
    fetzen([[146, 66], [152, 63], [155, 67], [153, 72]], bart, 6) +
    `<ellipse cx="101" cy="88" rx="7" ry="4.5" fill="#ff5a4a" opacity=".5" ${st.weich()}/><ellipse cx="139" cy="88" rx="7" ry="4.5" fill="#ff5a4a" opacity=".5" ${st.weich()}/>` +
    // Vollbart mit Strähnen und Locke an der Spitze
    st.form(vollbart, bart, { innen: fellStriche(vollbart, 5.5, [bartDunkel, bartHell, bart], { laenge: 12, breite: 2, richtung: 88, saat: 31 }) }) +
    pinsel([[120, 158], [117, 163], [120, 167], [123, 164]], 2, bartDunkel) +
    maul +
    // Zwirbelbart mit Bierschaum
    st.form(schnauzer, "#dd8336", { linie: 2.4, innen: fellStriche(schnauzer, 3.5, [bartDunkel, bartHell], { laenge: 7, breite: 1.4, richtung: 180, saat: 5 }) }) +
    st.form(spiegel(schnauzer), "#dd8336", { linie: 2.4, innen: fellStriche(spiegel(schnauzer), 3.5, [bartDunkel, bartHell], { laenge: 7, breite: 1.4, richtung: 0, saat: 6 }) }) +
    schaum(100, 92) +
    schaum(140, 92) +
    // rote Knollennase mit Äderchen
    st.form(nase, "#ef8a76", {
      linie: 2.4,
      innen: pinsel([[116, 87], [118, 90], [117, 93]], 1, "#c2404a") + pinsel([[125, 88], [123.5, 91]], 1, "#c2404a") + pinsel([[127, 92], [129, 94]], 0.9, "#c2404a"),
    }) +
    `<path d="${ellipse(117, 84, 3.4, 2)}" fill="#fff" opacity=".7"/>` +
    `<path d="${ellipse(115.5, 94.6, 1.8, 1.2)}" fill="#7a2a24"/><path d="${ellipse(124.5, 94.6, 1.8, 1.2)}" fill="#7a2a24"/>` +
    auge(st, 107, 72.5, 1, augeL) +
    auge(st, 133, 72.5, -1, augeR) +
    brauen +
    // schiefe Krone mit Perlen und Edelsteinen
    st.form(krone, gold, { linie: 3, innen: pinsel(dreheP([[100, 36], [101, 46]], 120, 46, -12), 2, "#fff", { deckung: 0.5 }) }) +
    st.form(reif, "#e0a800", { linie: 2.2, licht: 0.8 }) +
    [perle1!, perle2!, perle3!].map(([x, y]) => st.form(kreis(x, y, 3.2), "#fff6e6", { linie: 1.6, licht: 0.9 })).join("") +
    steine.map(([x, y], i) => st.form(ellipse(x, y, i === 1 ? 3.4 : 2.6, i === 1 ? 3 : 2.4), ["#d9141c", "#2e6fd6", "#1f9a4a"][i]!, { linie: 1.4, licht: 0.9 })).join("")
  );
}

/** Riffelchip: dünne, unregelmäßig gewellte Scheibe mit Rillen, Würzflocken und angebräunten Stellen. */
function riffelchip(st: Stift, x: number, y: number, w: number, g = 1): string {
  const r = zufall(Math.round(x * 7 + y * 13));
  const n = 12;
  const f = Array.from({ length: n }, () => 0.82 + r() * 0.3);
  const pt = (i: number, k = 1): Punkt => {
    const a = (i / n) * Math.PI * 2;
    return [Math.cos(a) * 15 * f[i % n]! * k, Math.sin(a) * 10 * f[i % n]! * k];
  };
  const z = (p: Punkt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  let rand = `M${z(pt(0))}`;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    const m = ((f[i]! + f[(i + 1) % n]!) / 2) * 1.08;
    rand += ` Q${z([Math.cos(a) * 15 * m, Math.sin(a) * 10 * m])} ${z(pt(i + 1))}`;
  }
  const d = setze(rand + " Z", x, y, w, g);
  const rillen = [-5, 1].map((v) => setzeP([[-16, v - 1.5], [-8, v + 1.5], [0, v - 1.5], [8, v + 1.5], [16, v - 1.5]], x, y, w, g));
  const flecken = setzeP([[-7, -4], [6, -2], [-1, 4], [9, 4], [-9, 3]], x, y, w, g);
  return st.form(d, "#ffc93a", {
    linie: 2.2,
    licht: 0.45,
    schatten: -0.1,
    innen:
      `<path d="${d}" fill="none" stroke="#e39a22" stroke-width="${3 * g}" opacity=".5"/>` +
      rillen.map((l) => pinsel(l, 1.4 * g, "#e3a52a", { deckung: 0.7, anfang: 0, ende: 0, schritte: 4 })).join("") +
      flecken.map(([u, v], i) => `<circle cx="${u.toFixed(1)}" cy="${v.toFixed(1)}" r="${(0.9 * g).toFixed(2)}" fill="${["#c2401a", "#4f7a1f", "#b8661a"][i % 3]}"/>`).join(""),
  });
}

/** Die Chipstüte des Grauens: knittrige Folientüte mit Riss, aus dem Riffelchips quellen, Logo, XXL-Stern und Maskottchengesicht. */
function chipstuete(st: Stift, wut: boolean): string {
  const rot = "#e2352b";
  const tief = "#8e1a12";
  const oben = (x0: number, y0: number, x1: number, y1: number, h: number) =>
    Array.from({ length: 12 }, (_, i) => {
      const t = (i + 1) / 12;
      return `L${(x0 + (x1 - x0) * t).toFixed(1)} ${(y0 + (y1 - y0) * t + (i % 2 === 0 ? -h : 0)).toFixed(1)}`;
    }).join(" ");
  const tuete = `M70 64 ${oben(70, 64, 168, 56, 9)} C182 92 190 148 178 194 L62 198 C50 150 56 104 70 64 Z`;
  const naht = "M70 64 L168 56 L169 67 C136 71 102 73 71 75 Z";
  const saum = `M62 192 L178 188 L179 198 ${oben(179, 198, 61, 204, -8)} Z`;
  const riffel = (x0: number, x1: number, y0: number, y1: number, h: number) => {
    let d = "";
    for (let x = x0 + 2; x < x1; x += 3.4) d += `M${x.toFixed(1)} ${(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)).toFixed(1)} l0 ${h} `;
    return `<path d="${d}" stroke="${tief}" stroke-width="1.2" opacity=".6"/>`;
  };
  const knicke: Punkt[][] = [
    [[86, 80], [95, 104], [89, 130]],
    [[154, 76], [146, 100], [152, 124]],
    [[70, 146], [78, 160], [74, 178]],
    [[172, 142], [164, 160], [170, 180]],
    [[96, 186], [106, 177], [118, 182], [128, 175]],
    [[110, 78], [118, 86], [128, 82]],
    [[60, 108], [68, 118], [64, 132]],
  ];
  const folie =
    `<g ${st.weich()}><path d="M40 50 L72 50 C64 110 62 150 68 210 L40 210 Z M200 50 L168 50 C178 110 180 150 172 210 L200 210 Z" fill="#000" opacity=".22"/>` +
    `<path d="M84 64 C80 110 80 150 86 196 M152 62 C158 110 158 150 154 192" stroke="#fff" stroke-width="7" opacity=".3" fill="none"/></g>` +
    pinsel([[84, 70], [81, 110], [82, 150], [86, 190]], 2, "#fff", { deckung: 0.55 }) +
    knicke.map((k) => pinsel(k, 2.6, tief, { deckung: 0.85 }) + pinsel(k.map(([x, y]) => [x + 2, y + 1] as const), 1.8, "#ff9a8a", { deckung: 0.75 })).join("") +
    // festgeklebte Krümel
    `<path d="M74 96 l3 -1.4 l1.4 2.4 l-2.6 1.4 Z M162 132 l2.6 -1.6 l1.4 2.2 l-2.6 1.2 Z M90 150 l2.4 -.8 l.8 2.2 l-2.4 1 Z" fill="#f4c400" stroke="${LINIE}" stroke-width=".8"/>`;
  const logo = drehe("M78 164 C78 148 100 142 120 142 C140 142 162 148 162 164 C162 180 140 186 120 186 C100 186 78 180 78 164 Z", 120, 164, -6);
  let stern = "";
  for (let i = 0; i < 24; i++) {
    const w = (i / 24) * Math.PI * 2;
    const r = i % 2 ? 11.5 : 16;
    stern += `${i ? "L" : "M"}${(160 + Math.cos(w) * r).toFixed(1)} ${(179 + Math.sin(w) * r).toFixed(1)} `;
  }
  const augenArt: AugeArt = wut
    ? { r: 12, iris: "#d9141c", lidfarbe: rot, lid: 0.16, neigung: 26, blick: [0, 0.1], adern: true }
    : { r: 12, iris: "#2a7de1", lidfarbe: rot, lid: 0.24, neigung: 12, blick: [-0.12, 0.08] };
  const brauen = wut
    ? pinsel([[86, 81], [101, 85], [116, 93]], 7, LINIE, { anfang: 0.1, ende: 0.5 }) + pinsel([[154, 81], [139, 85], [124, 93]], 7, LINIE, { anfang: 0.1, ende: 0.5 })
    : pinsel([[88, 84], [101, 80], [114, 84]], 5, LINIE) + pinsel([[126, 82], [139, 77], [152, 81]], 5, LINIE);
  const maul = wut
    ? st.form("M97 117 C106 112 134 112 143 117 C146 135 136 150 120 150 C104 150 94 135 97 117 Z", "#4a0a10", {
        linie: 3,
        licht: 0.2,
        innen: `<path d="M106 146 C110 137 130 137 134 146 C130 152 110 152 106 146 Z" fill="#e85a6b"/><path d="M117 115 C117 123 123 123 123 115 Z" fill="#e85a6b"/>`,
      }) +
      zaehne([103, 112, 128, 137], 116) +
      `<path d="M107 147 l3 -7 l3 7 Z M127 147 l3 -7 l3 7 Z" fill="#fffdf6" stroke="${LINIE}" stroke-width="1.1" stroke-linejoin="round"/>`
    : st.form("M92 120 C104 130 136 130 148 118 C147 134 135 146 120 146 C104 146 93 135 92 120 Z", "#4a0a10", {
        linie: 3,
        licht: 0.15,
        innen:
          `<path d="M88 116 C104 128 136 128 152 114 L152 129 C136 137 104 137 88 129 Z" fill="#fffdf6"/>` +
          `<path d="M104 127 L104.6 134 M113 128.5 L113.4 136 M122 128.6 L122 136 M131 127.8 L130.6 135 M139.5 125.4 L138.6 132" stroke="${LINIE}" stroke-width="1.1"/>` +
          `<path d="M106 146 C110 139 130 139 134 146 Z" fill="#e85a6b"/>`,
      }) + pinsel([[147, 113], [150.5, 117], [149, 122]], 2.4);
  return (
    // Chips quellen oben rechts heraus
    riffelchip(st, 152, 40, -18) +
    riffelchip(st, 135, 46, 24, 0.85) +
    riffelchip(st, 168, 48, 52, 0.8) +
    st.form(tuete, rot, { innen: folie }) +
    st.form(naht, "#c42a21", { linie: 2.4, innen: riffel(70, 169, 64, 56, 11) }) +
    st.form(saum, "#c42a21", { linie: 2.6, innen: riffel(62, 179, 192, 188, 11) }) +
    // Riss mit silberner Innenseite
    st.form("M138 64 L142 58 L147 62 L152 55 L157 61 L162 54 L167 60 L169 67 C160 69 148 69 138 69 Z", "#c3c7d0", {
      linie: 2.2,
      licht: 0.9,
      innen: pinsel([[141, 66], [150, 64], [160, 65], [167, 62]], 1.4, "#fff", { deckung: 0.85 }) + pinsel([[147, 63], [151, 58]], 1.1, "#7d828e") + pinsel([[157, 63], [161, 57]], 1.1, "#7d828e"),
    }) +
    st.form(logo, "#f4c400", { linie: 2.8, innen: `<path d="${drehe(ellipse(120, 164, 37, 18), 120, 164, -6)}" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/>` }) +
    `<g transform="rotate(-6 120 164)"><text x="120" y="170" font-size="20" font-weight="900" text-anchor="middle" fill="${rot}" stroke="${LINIE}" stroke-width="1.4" paint-order="stroke" letter-spacing="1">CHIPS</text>` +
    `<text x="120" y="180" font-size="6.5" font-weight="700" text-anchor="middle" fill="${tief}" letter-spacing="1.5">PAPRIKA</text></g>` +
    st.form(stern + "Z", "#ffe14a", { linie: 2, licht: 0.6 }) +
    `<text x="160" y="183" font-size="11" font-weight="900" text-anchor="middle" fill="${rot}" stroke="#fffdf6" stroke-width="1.6" paint-order="stroke" transform="rotate(14 160 179)">XXL</text>` +
    auge(st, 102, 100, 1, augenArt) +
    auge(st, 138, 100, -1, augenArt) +
    brauen +
    maul +
    // heruntergefallene Chips
    riffelchip(st, 194, 208, 12, 0.7) +
    riffelchip(st, 48, 210, -24, 0.6)
  );
}

/** Der Lieferdienst-Lord: Thermorucksack, Fahrradhelm mit Krönchen, Amtskette auf der Kurierjacke, Samtumhang mit Goldborte, Stoppeln, Bleistiftbart und Ohrstöpsel. */
function lieferdienstLord(st: Stift, wut: boolean): string {
  const haut = "#efb88b";
  const tuerkisTief = "#106a63";
  const gold = "#f4c400";
  const silber = "#dfe3ea";
  const rucksack = "M64 46 C90 43 150 43 176 46 C183 47 186 52 186 60 L186 140 L54 140 L54 60 C54 52 57 47 64 46 Z";
  const umhang = "M80 122 C58 150 46 182 40 212 C80 220 160 220 200 212 C194 182 182 150 160 122 Z";
  const jacke = "M86 122 C78 146 72 176 78 200 C96 214 144 214 162 200 C168 176 162 146 154 122 C140 114 100 114 86 122 Z";
  const kopf = "M120 60 C141 59 154 74 153 94 C153 106 148 114 142 118 C136 124 128 126 120 126 C112 126 104 124 98 118 C92 114 87 106 87 94 C86 74 99 59 120 60 Z";
  const kinn = "M88 100 C94 118 108 128 120 128 C132 128 146 118 152 100 C142 112 132 115 120 115 C108 115 98 112 88 100 Z";
  const helm = "M84 92 C80 62 98 46 120 46 C142 46 160 62 156 92 C150 82 140 76 120 76 C100 76 90 82 84 92 Z";
  const ohr = "M89 88 C83 84 79 90 81 97 C82 102 86 105 90 103 Z";
  const borte = (s: 1 | -1) => {
    const d = s === 1 ? "M82 128 C64 152 52 182 46 210" : spiegel("M82 128 C64 152 52 182 46 210");
    return `<path d="${d}" fill="none" stroke="${gold}" stroke-width="6"/><path d="${d}" fill="none" stroke="#9a6a00" stroke-width="2.2" stroke-dasharray=".1 5" stroke-linecap="round"/>`;
  };
  const kette: Punkt[] = Array.from({ length: 15 }, (_, i) => [120 - Math.cos((Math.PI * i) / 14) * 23, 118 + Math.sin((Math.PI * i) / 14) * 30] as const);
  const schlitze = [
    [102, 60, -28],
    [120, 56, 0],
    [138, 60, 28],
    [92, 74, -52],
    [148, 74, 52],
  ] as const;
  const augenArt: AugeArt = wut
    ? { r: 8, iris: "#d9141c", lidfarbe: haut, lid: 0.16, neigung: 26, blick: [0, 0.1], adern: true }
    : { r: 8, iris: "#5a3a1a", lidfarbe: haut, lid: 0.46, neigung: -6, blick: [-0.32, 0.34] };
  const brauen = wut
    ? pinsel([[97, 90], [106, 93], [115, 98]], 4.6, LINIE, { anfang: 0.1, ende: 0.5 }) + pinsel([[143, 90], [134, 93], [125, 98]], 4.6, LINIE, { anfang: 0.1, ende: 0.5 })
    : pinsel([[99, 93.5], [107, 91.5], [115, 93.5]], 2.8) + pinsel([[125, 92.5], [133, 89.5], [141, 92]], 2.8);
  const maul = wut
    ? st.form("M106 109 C112 107 128 107 134 109 C136 122 128 129 120 129 C112 129 104 122 106 109 Z", "#4a0a10", { linie: 2.6, licht: 0.2 }) +
      `<path d="M111 124 C115 119 125 119 129 124 C125 128 115 128 111 124 Z" fill="#e85a6b"/>` +
      zaehne([110, 117, 124, 131], 109, 6, 120.5)
    : pinsel([[109, 114], [117, 116], [126, 115], [133, 110.5]], 2.8, LINIE, { anfang: 0.15, ende: 0.15 }) + pinsel([[131, 108], [134, 110.5], [133.4, 114]], 1.8);
  return (
    // Thermorucksack mit Reißverschluss, Reflektorstreifen und Pizzazeichen
    st.form(rucksack, "#1fa39a", {
      innen:
        pinsel([[54, 63], [120, 60], [186, 63]], 3, tuerkisTief, { anfang: 0, ende: 0 }) +
        `<path d="M56 66.5 L184 66.5" stroke="#c9ccd4" stroke-width="1.8" stroke-dasharray="1.6 1.4"/>` +
        `<path d="M50 116 L190 116 L190 126 L50 126 Z" fill="${silber}"/>` +
        pinsel([[54, 118.4], [186, 118.4]], 2, "#fff", { deckung: 0.85, anfang: 0, ende: 0 }) +
        `<circle cx="171" cy="92" r="10" fill="#fffdf6"/><path d="M171 84 L164 99 Q171 102 178 99 Z" fill="${gold}" stroke="#c42a21" stroke-width="1.3" stroke-linejoin="round"/><circle cx="170" cy="93" r="1.5" fill="#e2352b"/><circle cx="173" cy="97" r="1.3" fill="#e2352b"/>`,
    }) +
    st.form("M63 65 L67 65 L66.6 75 L63.4 75 Z", "#9aa0aa", { linie: 1.4, licht: 0.9 }) +
    // Samtumhang mit gestickter Goldborte
    st.form(umhang, "#5a2985", {
      innen:
        pinsel([[70, 150], [60, 182], [56, 210]], 3, "#33124f") +
        pinsel([[170, 150], [180, 182], [184, 210]], 3, "#33124f") +
        pinsel([[75, 152], [65, 184], [62, 210]], 2.2, "#9a6ad0", { deckung: 0.5 }) +
        pinsel([[175, 152], [185, 184], [188, 210]], 2.2, "#9a6ad0", { deckung: 0.5 }) +
        borte(1) +
        borte(-1) +
        pinsel([[42, 210], [80, 217], [120, 219], [160, 217], [198, 210]], 6, gold, { anfang: 0, ende: 0 }),
    }) +
    // Kurierjacke mit Reißverschluss, Reflektorstreifen und Tasche
    st.form(jacke, "#e2352b", {
      schraffur: 0.18,
      innen:
        pinsel([[120, 118], [120, 160], [120, 210]], 3.2, "#9c1e16", { anfang: 0, ende: 0 }) +
        `<path d="M120 120 L120 208" stroke="#c9ccd4" stroke-width="1.6" stroke-dasharray="1.4 1.4"/>` +
        `<path d="M74 186 C100 196 140 196 166 186 L166 193 C140 203 100 203 74 193 Z" fill="${silber}"/>` +
        pinsel([[76, 188], [100, 197], [140, 197], [164, 188]], 1.6, "#fff", { deckung: 0.9 }) +
        pinsel([[90, 150], [96, 160]], 2, "#9c1e16", { deckung: 0.7 }) +
        pinsel([[150, 150], [144, 160]], 2, "#9c1e16", { deckung: 0.7 }) +
        pinsel([[134, 172], [148, 168], [158, 172]], 2.4, "#ff7a6e", { deckung: 0.5 }),
    }) +
    `<rect x="118" y="134" width="4" height="7" rx="1" fill="${silber}" stroke="${LINIE}" stroke-width="1.1"/>` +
    // Rucksackgurte
    pinsel([[97, 112], [92, 132], [88, 152]], 8.4, LINIE, { anfang: 0, ende: 0 }) +
    pinsel([[97, 112], [92, 132], [88, 152]], 5.4, tuerkisTief, { anfang: 0, ende: 0 }) +
    pinsel([[143, 112], [148, 132], [152, 152]], 8.4, LINIE, { anfang: 0, ende: 0 }) +
    pinsel([[143, 112], [148, 132], [152, 152]], 5.4, tuerkisTief, { anfang: 0, ende: 0 }) +
    // Amtskette mit Medaillon
    kette.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i % 2 ? 2.2 : 2.8}" fill="none" stroke="${LINIE}" stroke-width="3.4"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i % 2 ? 2.2 : 2.8}" fill="none" stroke="${gold}" stroke-width="1.6"/>`).join("") +
    st.form(kreis(120, 155, 8.4), gold, { linie: 2.2, licht: 0.9, innen: `<circle cx="120" cy="155" r="5.6" fill="none" stroke="#b98a00" stroke-width="1.2"/>` }) +
    st.form(kreis(120, 155, 3.4), "#d9141c", { linie: 1.2, licht: 0.9 }) +
    `<g transform="rotate(-8 98 170)">${st.form("M84 162 Q98 159 112 162 L112 178 Q98 181 84 178 Z", "#fffdf6", { linie: 2 })}<text x="98" y="173.5" font-size="8.5" font-weight="900" text-anchor="middle" fill="#e2352b">LORD</text></g>` +
    // Stehkragen
    st.form("M96 114 C104 122 136 122 144 114 L148 126 C136 133 104 133 92 126 Z", "#c42a21", { linie: 2.4 }) +
    st.form(ohr, haut, { linie: 2.4 }) +
    st.form(spiegel(ohr), haut, { linie: 2.4 }) +
    // Kopf mit Stoppeln und Doppelkinn
    st.form(kopf, haut, {
      innen:
        `<path d="${kinn}" fill="#6a4a3a" opacity=".2"/>` +
        st.clip(kinn, fellStriche(kinn, 3.2, ["#5a3a2a"], { laenge: 1.6, breite: 0.9, richtung: 90, saat: 41 })) +
        `<ellipse cx="97" cy="104" rx="6" ry="4" fill="#ff7a6a" opacity=".45" ${st.weich()}/><ellipse cx="143" cy="104" rx="6" ry="4" fill="#ff7a6a" opacity=".45" ${st.weich()}/>`,
    }) +
    pinsel([[101, 119], [111, 124.5], [129, 124.5], [139, 119]], 2.4, "#b77b53") +
    // Bleistiftbart
    pinsel([[109, 107], [114, 105.4], [119, 106.4]], 2, LINIE) +
    pinsel([[121, 106.4], [126, 105.4], [131, 107]], 2, LINIE) +
    maul +
    auge(st, 107, 100, 1, augenArt) +
    auge(st, 133, 100, -1, augenArt) +
    brauen +
    // Fahrradhelm mit Lüftungsschlitzen, Visier und Kinnriemen
    st.form(helm, gold, {
      innen: schlitze.map(([x, y, w]) => `<path d="${setze(ellipse(0, 0, 2.8, 8.4), x, y, w)}" fill="#5a4000" opacity=".85"/><path d="${setze(ellipse(0.8, 1.2, 2, 7), x, y, w)}" fill="#ffe680" opacity=".5"/>`).join(""),
    }) +
    st.form("M86 86 Q120 76 154 86 L156 94 Q120 84 84 94 Z", "#2f2f35", { linie: 2.2, licht: 0.5 }) +
    pinsel([[87, 92], [90, 106], [100, 119]], 2.2, "#2f2f35") +
    pinsel([[153, 92], [150, 106], [140, 119]], 2.2, "#2f2f35") +
    // Ohrstöpsel
    st.form("M83 94 C80 92 77 95 79 98 C80 100 83 100 84 98 Z", "#fffdf6", { linie: 1.6, licht: 0.6 }) +
    pinsel([[79.5, 99], [79, 107]], 3, LINIE, { anfang: 0, ende: 0.2 }) +
    pinsel([[79.5, 99], [79, 106.4]], 1.4, "#fffdf6", { anfang: 0, ende: 0.2 }) +
    // schiefes Krönchen auf dem Helm
    st.form(drehe("M108 47 L105 31 L114 38 L120 27 L126 38 L135 31 L132 47 Z", 120, 40, 10), gold, { linie: 2.2, licht: 0.9 }) +
    dreheP([[105, 30], [120, 26], [135, 30]], 120, 40, 10).map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="#fff6e6" stroke="${LINIE}" stroke-width="1.2"/>`).join("") +
    dreheP([[113, 43], [120, 42], [127, 43]], 120, 40, 10).map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" fill="${["#2e6fd6", "#d9141c", "#1f9a4a"][i]}" stroke="${LINIE}" stroke-width=".9"/>`).join("")
  );
}

const figuren: Record<string, Figur> = {
  "Der innere Schweinehund": {
    haut: "#f5a0b4",
    schulter: [84, 134, 156, 134],
    aermchen: { form: ["huefte", "huefte"], hand: "huf" },
    pump: { pose: ["bizeps", "stemmen"], muster: { art: "adern", farbe: "#c2456a" }, hand: "huf", ding: dinge.kette },
    aura: "#ff2d2d",
    schwitzt: true,
    // Schlammspritzer und Gestank
    rage: () =>
      [
        [56, 52, 1],
        [190, 64, 0.8],
        [34, 176, 0.9],
        [208, 188, 1.1],
      ]
        .map(([x, y, g]) => `<path transform="translate(${x} ${y}) scale(${g})" d="M-10 -2 C-14 -12 -2 -16 2 -10 C6 -18 18 -12 12 -4 C20 0 14 12 6 8 C4 16 -8 14 -6 6 C-14 8 -16 0 -10 -2 Z M16 -16 a3 3 0 1 0 0.1 0 M-16 10 a2.4 2.4 0 1 0 0.1 0" fill="#7a4a24" stroke="${LINIE}" stroke-width="1.4"/>`)
        .join("") + strich("M98 36 q-6 -8 0 -16 q6 -8 0 -16 M120 30 q-6 -8 0 -16 q6 -8 0 -16 M142 36 q-6 -8 0 -16 q6 -8 0 -16", 3, "#9bc83a"),
    koerper: schweinehund,
    gewicht: (st) => hantel(st, (x) => st.form(`M${x - 7} -22 Q${x} -25 ${x + 7} -22 L${x + 7} 22 Q${x} 25 ${x - 7} 22 Z`, "#34343a", { linie: 2.4 })),
    // Stachelhalsband
    extra: (st) =>
      `<g transform="translate(0 14)">` +
      st.form("M84 128 Q120 141 156 128 L156 140 Q120 153 84 140 Z", "#2f2f35", { linie: 2.6 }) +
      [94, 107, 120, 133, 146]
        .map((x) => {
          const y = 133 + (x - 120) ** 2 / 400;
          return st.form(`M${x - 4.5} ${y} L${x} ${y - 13} L${x + 4.5} ${y} Z`, "#dcdce2", { linie: 1.6, licht: 0.9 });
        })
        .join("") +
      `</g>`,
  },
  "Der Dönerteller XXL": {
    haut: "#d39a55",
    schulter: [70, 142, 170, 142],
    aermchen: { form: ["haengen", "huefte"], hand: "faust", ding: dinge.gabel },
    pump: { pose: ["stemmen", "bizeps"], muster: { art: "adern", farbe: "#d9141c" }, hand: "faust", ding: dinge.messer },
    aura: "#ff7a00",
    schwitzt: true,
    // Scharf: Flammen und fliegende Peperoni
    rage: (st) =>
      [
        [70, 58, 1],
        [178, 50, 1.2],
        [120, 30, 0.8],
      ]
        .map(([x, y, g]) => `<g transform="translate(${x} ${y}) scale(${g})">${st.form("M0 12 C-12 12 -14 0 -8 -8 C-8 -2 -4 0 -3 -2 C-6 -10 0 -18 4 -22 C4 -14 12 -10 10 0 C12 -2 13 -6 12 -8 C18 0 14 12 0 12 Z", "#ff8a00", { linie: 2.2 })}<path d="M0 10 C-6 10 -7 3 -3 -2 C-2 2 2 3 2 -2 C6 2 6 10 0 10 Z" fill="#ffd23a"/></g>`)
        .join("") +
      [
        [34, 122, -30],
        [210, 106, 40],
        [208, 196, 120],
      ]
        .map(([x, y, w]) => `<g transform="translate(${x} ${y}) rotate(${w})">${st.form("M-4 -10 C4 -10 6 0 4 10 C2 18 -2 22 -2 16 C-4 8 -8 -4 -4 -10 Z", "#e2352b", { linie: 2 })}${st.form("M-4 -10 C-4 -14 0 -16 2 -18 L3 -15 C1 -14 0 -12 2 -10 Z", "#5cbf3b", { linie: 1.6 })}</g>`)
        .join(""),
    koerper: doenerteller,
    // Dönerspieß als Keule
    gewicht: (st) =>
      strich("M0 18 L0 -82", 6.4) +
      strich("M0 18 L0 -82", 3, "#a3a3aa") +
      st.form("M-9 -6 C-14 -26 -18 -48 -20 -70 Q0 -76 20 -70 C18 -48 14 -26 9 -6 Q0 -3 -9 -6 Z", "#a8642c", { linie: 2.6 }) +
      strich("M-17 -60 Q0 -56 17 -62 M-15 -44 Q0 -40 15 -46 M-12 -28 Q0 -24 12 -30 M-10 -14 Q0 -11 10 -15", 2, "#6e3a14") +
      strich("M-6 -66 l2 6 M8 -52 l-2 6 M-4 -36 l2 6", 1.6, "#e2352b"),
  },
  "Das Sofa der Verdammnis": {
    haut: "#7a2c8c",
    schulter: [66, 150, 174, 150],
    aermchen: { form: ["haengen", "haengen"], hand: "faust", ding: dinge.fernbedienung },
    pump: { pose: ["haengen", "haengen"], muster: { art: "naehte", farbe: "#4e1a5b" }, hand: "faust", ding: dinge.fernbedienung },
    aura: "#b02dff",
    // Staubwolken, Popcorn und herausspringende Sprungfedern
    rage: () =>
      [
        [30, 214, 1.4],
        [214, 214, 1.4],
        [44, 196, 1],
        [196, 196, 1],
      ]
        .map(([x, y, g]) => wolke(x!, y!, "#cbb79a", g))
        .join("") +
      [
        [70, 34, -20],
        [172, 30, 20],
      ]
        .map(([x, y, w]) => `<g transform="translate(${x} ${y}) rotate(${w})"><path d="M0 22 C-10 20 -10 14 0 13 C10 12 10 6 0 5 C-10 4 -10 -2 0 -3 C10 -4 10 -10 0 -11 C-8 -12 -8 -16 0 -18" fill="none" stroke="${LINIE}" stroke-width="4.6" stroke-linecap="round"/><path d="M0 22 C-10 20 -10 14 0 13 C10 12 10 6 0 5 C-10 4 -10 -2 0 -3 C10 -4 10 -10 0 -11 C-8 -12 -8 -16 0 -18" fill="none" stroke="#c9ccd4" stroke-width="2" stroke-linecap="round"/></g>`)
        .join("") +
      [
        [40, 100],
        [204, 120],
        [120, 22],
        [26, 150],
      ]
        .map(([x, y]) => `<path transform="translate(${x} ${y})" d="M-5 0 C-8 -6 -2 -9 0 -6 C2 -10 8 -7 6 -2 C10 0 7 7 2 5 C0 9 -6 7 -5 3 C-9 3 -9 -1 -5 0 Z" fill="#fff7d6" stroke="${LINIE}" stroke-width="1.4"/>`)
        .join(""),
    koerper: sofa,
    // Hantel aus Sofakissen
    gewicht: (st) => hantel(st, (x) => st.form(`M${x - 11} -16 C${x - 12} -24 ${x + 12} -24 ${x + 11} -16 L${x + 11} 16 C${x + 12} 24 ${x - 12} 24 ${x - 11} 16 Z`, "#c169d6", { linie: 2.4 })),
  },
  "König Bierbauch": {
    haut: "#f1bf92",
    schulter: [78, 124, 162, 124],
    aermchen: { form: ["haengen", "huefte"], hand: "faust", ding: dinge.mass },
    pump: { pose: ["stemmen", "bizeps"], muster: { art: "haare", farbe: "#8a4a20" }, hand: "faust", ding: dinge.mass },
    aura: "#ffb000",
    schwitzt: true,
    // Bierschaum spritzt, Bläschen steigen
    rage: () =>
      [
        [60, 46, 1.3],
        [184, 42, 1.3],
        [204, 70, 0.9],
        [40, 74, 0.9],
      ]
        .map(([x, y, g]) => wolke(x!, y!, "#fffdf6", g))
        .join("") +
      [
        [30, 120, 5],
        [212, 132, 6],
        [24, 96, 3.4],
        [218, 104, 3.6],
        [36, 150, 3],
        [206, 160, 3.4],
      ]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffd54a" fill-opacity=".5" stroke="#fffdf6" stroke-width="1.8"/>`)
        .join("") +
      `<path d="M96 30 c-2 6 4 8 4 2 Z M146 26 c-2 6 4 8 4 2 Z M120 18 c-2 6 4 8 4 2 Z" fill="#f4b400" stroke="${LINIE}" stroke-width="1.2"/>`,
    koerper: koenigBierbauch,
    // Bierfässer als Hantelscheiben
    gewicht: (st) =>
      hantel(
        st,
        (x) =>
          st.form(`M${x - 13} -16 C${x - 16} -6 ${x - 16} 6 ${x - 13} 16 C${x - 4} 20 ${x + 4} 20 ${x + 13} 16 C${x + 16} 6 ${x + 16} -6 ${x + 13} -16 C${x + 4} -20 ${x - 4} -20 ${x - 13} -16 Z`, "#a05f2a", { linie: 2.4 }) +
          strich(`M${x - 15} -7 Q${x} -4 ${x + 15} -7 M${x - 15} 7 Q${x} 10 ${x + 15} 7`, 2.4, "#5b3714"),
      ),
  },
  "Die Chipstüte des Grauens": {
    haut: "#f4c400",
    schulter: [72, 138, 168, 138],
    aermchen: { form: ["stock", "stock"], hand: "handschuh", ding: dinge.chip },
    pump: { pose: ["stemmen", "stemmen"], muster: { art: "knister", farbe: "#c99200" }, hand: "handschuh", ding: dinge.chip },
    aura: "#ff2d2d",
    // Krümelexplosion und Salzfunkeln
    rage: () =>
      [
        [44, 60, 20],
        [196, 70, -30],
        [26, 130, 60],
        [214, 150, 10],
        [70, 30, -50],
        [168, 24, 80],
        [40, 200, 30],
        [204, 206, -60],
      ]
        .map(([x, y, w], i) => `<path transform="translate(${x} ${y}) rotate(${w}) scale(${0.7 + (i % 3) * 0.25})" d="M-8 -4 L-2 -9 L7 -6 L9 2 L2 8 L-7 5 Z" fill="#f4c400" stroke="${LINIE}" stroke-width="1.6" stroke-linejoin="round"/>`)
        .join("") +
      funkeln(58, 96, 7) +
      funkeln(184, 104, 8) +
      funkeln(96, 22, 6) +
      funkeln(150, 40, 5) +
      funkeln(212, 40, 6),
    koerper: chipstuete,
    // Hantel mit Chips als Scheiben
    gewicht: (st) =>
      hantel(
        st,
        (x) =>
          st.form(`M${x} -24 C${x + 12} -20 ${x + 12} 20 ${x} 24 C${x - 12} 20 ${x - 12} -20 ${x} -24 Z`, "#f4c400", { linie: 2.4 }) +
          strich(`M${x - 3} -12 q5 6 0 12 q-5 6 0 12`, 2, "#c99200"),
      ),
  },
  "Der Lieferdienst-Lord": {
    haut: "#efb88b",
    schulter: [82, 130, 158, 130],
    aermchen: { form: ["haengen", "haengen"], hand: "faust", ding: dinge.handy, farbe: "#5a2985" },
    pump: { pose: ["bizeps", "haengen"], muster: { art: "aermel", farbe: "#f4c400" }, hand: "faust", ding: dinge.handy, farbe: "#5a2985" },
    aura: "#ff2d6e",
    schwitzt: true,
    // Benachrichtigungen prasseln herein
    rage: (st) =>
      [
        [56, 44, 1, "!"],
        [190, 38, 1.15, "3"],
        [212, 96, 0.8, "!"],
        [28, 108, 0.85, "9"],
      ]
        .map(([x, y, g, t]) => `<g transform="translate(${x} ${y}) scale(${g})">${st.form(kreis(0, 0, 12), "#e2352b", { linie: 2.4 })}<text x="0" y="6" font-size="16" font-weight="900" text-anchor="middle" fill="#fff">${t}</text></g>`)
        .join("") +
      `<g transform="translate(120 22) rotate(-8)">${st.form("M-10 6 C-10 -4 -8 -12 0 -12 C8 -12 10 -4 10 6 L14 10 L-14 10 Z", "#f4c400", { linie: 2.2 })}<circle cx="0" cy="13" r="3" fill="#f4c400" stroke="${LINIE}" stroke-width="1.6"/></g>` +
      strich("M98 18 l-8 -4 M100 30 l-9 1 M142 18 l8 -4 M140 30 l9 1", 2.4, "#fffdf6"),
    koerper: lieferdienstLord,
    // Pizzakartons als Gewichte
    gewicht: (st) =>
      hantel(
        st,
        (x) =>
          st.form(`M${x - 8} -24 Q${x} -26 ${x + 8} -24 L${x + 8} 24 Q${x} 26 ${x - 8} 24 Z`, "#d79e63", { linie: 2.2 }) +
          strich(`M${x - 8} -8 h16 M${x - 8} 8 h16`, 1.6),
      ),
  },
  "Graf Gemütlich": {
    haut: "#8b684d",
    schulter: [82, 136, 158, 136],
    aermchen: { form: ["lang", "lang"], hand: "krallen", muster: { art: "fell", farbe: "#5e4330", hell: "#b08d6c" } },
    pump: { pose: ["bizeps", "haengen"], muster: { art: "fell", farbe: "#5e4330", hell: "#b08d6c" }, hand: "krallen", ding: dinge.kelch },
    aura: "#a8131b",
    // Fledermäuse vor einem blutroten Mond
    rage: (st) =>
      st.form("M168 -12 C152 -6 146 12 154 26 C162 38 180 40 192 32 C176 32 164 22 164 8 C164 0 166 -6 168 -12 Z", "#ff6b4a", {
        linie: 2.4,
        licht: 0.6,
        innen: `<circle cx="160" cy="16" r="3" fill="#c2301c" opacity=".6"/><circle cx="168" cy="28" r="2.2" fill="#c2301c" opacity=".6"/>`,
      }) +
      [
        [50, 46, 1, -10],
        [194, 34, 1.2, 12],
        [212, 96, 0.8, -6],
        [30, 118, 0.75, 8],
      ]
        .map(([x, y, g, w]) => `<g transform="translate(${x} ${y}) scale(${g}) rotate(${w})">${st.form("M0 -2 C-4 -10 -12 -12 -20 -8 C-18 -4 -18 0 -20 4 C-14 2 -10 4 -8 8 C-6 4 -3 3 0 4 C3 3 6 4 8 8 C10 4 14 2 20 4 C18 0 18 -4 20 -8 C12 -12 4 -10 0 -2 Z", "#1f1c22", { linie: 1.8, licht: 0.3 })}<circle cx="-2" cy="-1" r="1.1" fill="#d9141c"/><circle cx="2" cy="-1" r="1.1" fill="#d9141c"/></g>`)
        .join(""),
    koerper: grafGemuetlich,
    gewicht: (st) =>
      hantel(
        st,
        (x) =>
          st.form(`M${x} -21 C${x + 12} -21 ${x + 21} -12 ${x + 21} 0 C${x + 21} 12 ${x + 12} 21 ${x} 21 C${x - 12} 21 ${x - 21} 12 ${x - 21} 0 C${x - 21} -12 ${x - 12} -21 ${x} -21 Z`, "#34343a", { linie: 2.4 }) +
          `<circle cx="${x}" cy="0" r="5" fill="#a3a3aa"/>`,
      ),
  },
};

/** Unbekannte Namen (z. B. aus alten Datenbanken) bekommen den Schweinehund. */
function figurVon(name: string): Figur {
  return figuren[name] ?? figuren["Der innere Schweinehund"]!;
}

/** Weicher Bodenschatten, damit der Boss steht statt schwebt. */
const boden = (_f: Figur) => `<ellipse cx="120" cy="216" rx="78" ry="9" fill="#000" opacity=".28"/>`;

let zaehler = 0;

/** Die eigentliche Zeichnung ohne äußeres <svg>. */
export function bossZeichnung(name: string, stufe: BossStufe): string {
  const f = figurVon(name);
  const id = `b${++zaehler}`;
  const st = new Stift(id);
  const [lx, ly, rx, ry] = f.schulter;
  if (stufe === 1) {
    const [fl, fr] = f.aermchen.form;
    return `<g>${st.defs()}${boden(f)}${f.koerper(st, false)}${aermchen(st, f, lx, ly, 1, fl, f.aermchen.ding)}${aermchen(st, f, rx, ry, -1, fr, undefined)}</g>`;
  }
  const [pl, pr] = f.pump.pose;
  st.rand = mische(f.aura, 0.25);
  const schweiss = f.schwitzt
    ? `<path d="M150 68 C154 76 156 80 153 83 C150 86 146 83 147 79 C147 76 149 72 150 68 Z M92 62 C96 70 98 74 95 77 C92 80 88 77 89 73 C89 70 91 66 92 62 Z" fill="#8fd8ff" stroke="${LINIE}" stroke-width="1.3"/>`
    : "";
  return `<g transform="translate(120 128) scale(.9) translate(-120 -128)">
    <defs><radialGradient id="${id}a" cx="50%" cy="55%" r="50%"><stop offset="0" stop-color="${f.aura}" stop-opacity=".6"/><stop offset="1" stop-color="${f.aura}" stop-opacity="0"/></radialGradient></defs>
    ${st.defs()}
    <circle cx="120" cy="128" r="118" fill="url(#${id}a)"/>
    ${f.rage(st)}
    ${boden(f)}
    <g>
      ${f.koerper(st, true)}
      ${f.extra?.(st) ?? ""}
      ${pumparm(st, f, lx, ly, 1, pl, f.pump.ding)}
      ${pumparm(st, f, rx, ry, -1, pr, f.gewicht)}
      ${schweiss}
    </g>
  </g>`;
}

/** Fertiges SVG in beliebiger Größe. */
export function bossSvg(name: string, stufe: BossStufe, groesse = 240): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -20 300 280" width="${groesse}" height="${groesse}">${bossZeichnung(name, stufe)}</svg>`;
}
