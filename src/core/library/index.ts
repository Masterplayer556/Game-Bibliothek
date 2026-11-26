// Turns raw database rows into the view model of the app and computes every statistic.
// Pure functions only: no Supabase, no React. All dates are Europe/Zurich calendar days.
//
//   rows    – the rows as read from the database (RawData)
//   model   – buildLibrary: games across platforms and their played days
//   stats   – totals, rankings and shares in a range
//   series  – playtime per day, week, month or year
//   filter  – search, filters and sort order of the library list
//   game    – numbers of one game
//   health  – sync health
export * from "./rows";
export * from "./model";
export * from "./stats";
export * from "./series";
export * from "./filter";
export * from "./game";
export * from "./health";
