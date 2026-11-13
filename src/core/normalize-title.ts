// Titles differ slightly between platforms ("Minecraft for Nintendo Switch", "Minecraft").
// The normalised form is used to link platform entries to one game when there is no IGDB id.

const EDITION_SUFFIXES = [
  "nintendo switch 2 edition",
  "for nintendo switch",
  "nintendo switch edition",
  "playstation 5 edition",
  "ps5 edition",
  "ps4 edition",
  "java edition",
  "bedrock edition",
  "definitive edition",
  "game of the year edition",
  "goty edition",
  "remastered",
];

export function normalizeTitle(title: string): string {
  let t = title
    .replace(/[\u2122\u00ae\u00a9]/g, "") // TM, (R), (C): before NFKD, which turns the TM sign into "TM"
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // strip accents: Pokemon with accent -> Pokemon
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of EDITION_SUFFIXES) {
      if (t.endsWith(" " + suffix)) {
        t = t.slice(0, -suffix.length).trim();
        changed = true;
      }
    }
  }
  // Platform tags left at the end: "(PlayStation®5)", "(PS4)", "(Nintendo Switch)".
  // Runs after the edition suffixes, which already cover "for Nintendo Switch".
  t = t.replace(/\s(playstation\s?[45]|ps[45]|nintendo switch\s?2?|xbox series x s|xbox one|pc)$/, "").trim();
  return t.replace(/\s+/g, " ");
}
