// Rules for «Meine Angaben» of a game: status, rating and the day it was finished.
import type { GameStatus, LocalDate } from "./types";

export const RATING_MAX = 5;

/** A rating as stored: a whole number from 1 to 5, anything else is «not rated». */
export function validRating(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= RATING_MAX ? value : null;
}

/** Tapping a star sets that rating; tapping the current one again removes it. */
export function nextRating(current: number | null, tapped: number): number | null {
  return current === tapped ? null : validRating(tapped);
}

/**
 * What to save when the status changes. Setting «Durchgespielt» on a game without a day fills
 * in today; a day entered before is kept, also when the status changes again later.
 */
export function statusChange(
  status: GameStatus | null,
  completedOn: LocalDate | null,
  today: LocalDate,
): { status: GameStatus | null; completed_on?: LocalDate } {
  return status === "completed" && !completedOn ? { status, completed_on: today } : { status };
}
