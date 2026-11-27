import type { TaskStatus } from "../../types";

/**
 * The moves the board offers per status. It mirrors the API's TRANSITIONS (apps/api/src/work/tasks.ts), which stays
 * the authority; qa and in_progress are reached only through their own actions (QA handoff, start).
 */
export const MOVES: Record<TaskStatus, { to: TaskStatus; label: string }[]> = {
  backlog: [
    { to: "ready", label: "Bereit machen" },
    { to: "blocked", label: "Blockieren" },
  ],
  ready: [
    { to: "backlog", label: "Zurück ins Backlog" },
    { to: "blocked", label: "Blockieren" },
  ],
  in_progress: [
    { to: "review", label: "In Code Review" },
    { to: "ready", label: "Zurück auf Ready" },
    { to: "blocked", label: "Blockieren" },
  ],
  review: [
    { to: "in_progress", label: "Zurück in Arbeit" },
    { to: "blocked", label: "Blockieren" },
  ],
  qa: [
    { to: "in_progress", label: "Nacharbeit" },
    { to: "blocked", label: "Blockieren" },
  ],
  blocked: [
    { to: "backlog", label: "Ins Backlog" },
    { to: "ready", label: "Auf Ready" },
    { to: "review", label: "In Code Review" },
  ],
  done: [{ to: "backlog", label: "Wieder öffnen" }],
};

/** The owner's acceptance needs a note; the API asks for 20 to 2,000 characters. */
export const COMPLETION_NOTE = { min: 20, max: 2_000 };
