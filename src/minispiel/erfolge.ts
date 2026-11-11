import type { ErfolgArt } from "../scoring/erfolge.js";
import {
  BASISLAGER_ANTEIL,
  BOT_ID,
  MINISPIEL_ARTEN,
  type MinispielArt,
  type MinispielDaten,
  type SpielWoche,
  type Spieler,
  bombentraeger,
  duellFuehrender,
  duelle,
  gipfel,
  kopfgeld,
  lasten,
  seil,
  tresor,
  zombies,
} from "./spiele.js";

/**
 * Erfolge aus dem Endstand eines Minispiels, je Spieler-id (der Bot bekommt nie was).
 * Gerechnet wird wie bei der Auflösung, also mit der ganzen Woche.
 */
export function minispielErfolge(d: MinispielDaten, spieler: readonly Spieler[], w: SpielWoche): Map<string, ErfolgArt[]> {
  const m = new Map<string, ErfolgArt[]>();
  const gib = (id: string | null | undefined, art: ErfolgArt) => {
    if (!id || id === BOT_ID || !d.spieler.includes(id)) return;
    m.set(id, [...(m.get(id) ?? []), art]);
  };
  const l = lasten(d, spieler, w);
  switch (d.art) {
    case "zombie": {
      const z = zombies(d, spieler, w, 7);
      // Patient Null war von Anfang an Zombie, dafür kann er nichts
      for (const id of d.spieler) {
        if (!z.has(id)) gib(id, "zombie_ueberlebt");
        else if (id !== d.patientNull) gib(id, "zombie_gebissen");
      }
      break;
    }
    case "bombe":
      gib(bombentraeger(d, spieler), "bombe_bumm");
      break;
    case "kopfgeld": {
      const k = kopfgeld(d, l);
      for (const id of k.jaeger) gib(id, "kopfgeld_jaeger");
      if (k.jaeger.length === 0 && k.gejagterLast > 0) gib(d.gejagter, "kopfgeld_unfassbar");
      break;
    }
    case "gipfel": {
      const k = gipfel(d, spieler, w);
      if (k[0]?.oben) gib(k[0].id, "gipfel_erster");
      for (const x of k) if (!x.oben && x.anteil < BASISLAGER_ANTEIL) gib(x.id, "gipfel_basislager");
      break;
    }
    case "tauziehen": {
      const s = seil(d, l);
      const [sieger, verlierer] = s.zug > 0 ? d.teams : s.zug < 0 ? [d.teams[1], d.teams[0]] : [null, null];
      // Unentschieden: das Seil reißt, alle landen im Schlamm
      for (const id of sieger?.mitglieder ?? []) gib(id, "tauziehen_sieg");
      for (const id of verlierer ? verlierer.mitglieder : d.spieler) gib(id, "tauziehen_schlamm");
      break;
    }
    case "tresor": {
      const t = tresor(d, l);
      for (const id of d.spieler) {
        if ((l.get(id) ?? 0) === 0) gib(id, "tresor_huhn");
        else if (t.offen) gib(id, "tresor_geknackt");
      }
      break;
    }
    case "duell":
      for (const du of duelle(d, l)) {
        const sieger = duellFuehrender(du);
        if (!sieger) continue;
        gib(sieger, "duell_sieg");
        if (sieger === BOT_ID) gib(du.a === BOT_ID ? du.b : du.a, "duell_bot");
      }
      break;
  }
  return m;
}

/** Spielkind: in jedem Minispiel mindestens einmal dabei gewesen. */
export function spielkind(mitgespielt: Iterable<MinispielArt>): ErfolgArt[] {
  const arten = new Set(mitgespielt);
  return MINISPIEL_ARTEN.every((a) => arten.has(a)) ? ["spielkind"] : [];
}
