/** Text of a caught error for a notice in the app. */
export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Unbekannter Fehler";
}
