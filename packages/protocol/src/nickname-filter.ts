/**
 * Names other people will read: no slurs or swearing (English, Hinglish and Devanagari Hindi) and no
 * names that pose as the site or its staff. A filter like this is a speed bump, not a wall: it
 * catches the obvious spellings ("f u c k", "fuuuck", "ch00tiya") without flagging ordinary words
 * that merely contain a short bad word, which is why most words match whole and only a few long,
 * unambiguous stems match anywhere in the name.
 */

const LOOKALIKES: Readonly<Record<string, string>> = {
  "0": "o",
  "1": "i",
  "!": "i",
  "3": "e",
  "4": "a",
  "@": "a",
  "5": "s",
  $: "s",
  "7": "t",
  "8": "b",
};

/** Whole words, compared after normalising (see `normalise`). */
const BLOCKED_WORDS = [
  // English
  "fuck",
  "fucker",
  "fucking",
  "fck",
  "fuk",
  "shit",
  "bitch",
  "bastard",
  "cunt",
  "dick",
  "cock",
  "pussy",
  "whore",
  "slut",
  "asshole",
  "arse",
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
  "rape",
  "rapist",
  "porn",
  "sex",
  "sexy",
  "nazi",
  "hitler",
  // Hinglish
  "chut",
  "chutiya",
  "chutiye",
  "chutia",
  "bhenchod",
  "behenchod",
  "bhencho",
  "madarchod",
  "madarchot",
  "bsdk",
  "bhosdike",
  "bhosdi",
  "bhosda",
  "bhosdiwale",
  "gaand",
  "gand",
  "gandu",
  "lund",
  "lauda",
  "lavda",
  "loda",
  "lodu",
  "randi",
  "harami",
  "chod",
  "chodu",
  "jhatu",
  "tatti",
  // Devanagari
  "चूतिया",
  "चुतिया",
  "मादरचोद",
  "भेनचोद",
  "बहनचोद",
  "भोसडी",
  "भोसड़ी",
  "गांडू",
  "गांड",
  "लौड़ा",
  "लौडा",
  "लंड",
  "रंडी",
  "हरामी",
].map((word) => normalise(word));

/** Long stems that are never part of an innocent word, matched anywhere once spaces are gone. */
const BLOCKED_STEMS = [
  "fuck",
  "motherf",
  "nigger",
  "faggot",
  "chutiy",
  "chotiy",
  "madarch",
  "bhench",
  "behench",
  "bhosd",
  "चूतिय",
  "मादरच",
  "भेनच",
  "बहनच",
].map((stem) => normalise(stem));

/** Names that could pass for the site or the person running a room. */
const RESERVED = [
  "admin",
  "administrator",
  "moderator",
  "mod",
  "host",
  "heartroom",
  "system",
  "staff",
  "support",
  "official",
].map((word) => normalise(word));

/** Lower case, accents off, look-alike digits mapped, and runs of one letter cut to one ("fuuuck"). */
function normalise(text: string): string {
  return (
    text
      .normalize("NFKD")
      // Latin accents only; Devanagari vowel signs are part of the word.
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[0134578@!$]/g, (ch) => LOOKALIKES[ch] ?? ch)
      .replace(/(\p{L})\1+/gu, "$1")
  );
}

export type NicknameProblem = "blocked" | "reserved";

export function nicknameProblem(name: string): NicknameProblem | null {
  const clean = normalise(name);
  const words = clean.split(/[^\p{L}\p{M}]+/u).filter(Boolean);
  const squashed = words.join("");
  if (words.some((word) => BLOCKED_WORDS.includes(word)) || BLOCKED_WORDS.includes(squashed)) {
    return "blocked";
  }
  if (BLOCKED_STEMS.some((stem) => squashed.includes(stem))) return "blocked";
  if (RESERVED.includes(squashed) || words.some((word) => RESERVED.includes(word))) {
    return "reserved";
  }
  return null;
}
