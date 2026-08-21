"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// The student's saved class list ("cart"). Holds the ACTUAL tool-result fields
// the student chose to keep — real catalog data, never model prose — so the
// printable summary (/summary) is grounded by construction. Client-side only:
// mirrors the fields of CourseInfoResult rather than importing the tool module,
// which would pull the server-only Drizzle client into the browser bundle.
//
// PRIVACY: this persists to localStorage, and `questions` holds the student's
// own words verbatim. On a shared machine the next person can read them, so
// `clear()` exists and /summary offers it. Nothing is sent to a server.

export interface SavedCourse {
  course_code: string;
  title?: string | null;
  credit_hours?: number | null;
  requisites_raw?: string | null;
  catalog_year?: string | null;
  source_url?: string;
}

interface SavedCoursesState {
  courses: SavedCourse[];
  /** The student's own questions, copied verbatim as they ask them in chat —
   *  real text they typed, so the sheet's "Questions I asked" list is grounded
   *  the same way the class list is. */
  questions: string[];
  toggle: (course: SavedCourse) => void;
  remove: (courseCode: string) => void;
  addQuestion: (q: string) => void;
  removeQuestion: (index: number) => void;
  /** Wipes the list and the questions, including the persisted copy — the
   *  "forget this" control for a shared or lab machine. */
  clear: () => void;
}

/** Cap on retained questions: enough for a real advising conversation, bounded
 *  so a long session cannot grow the stored transcript without limit. */
const MAX_QUESTIONS = 40;

/** The sheet's "Questions I asked" list is a checklist for the coach visit,
 *  but addQuestion sees EVERY typed message — including option picks ("1",
 *  "First one, Tri To"), acks ("yes", "thanks"), and answers to Major's own
 *  clarifying questions ("I live in Dallas County…"). Printed, those read as
 *  noise (live demo feedback, 2026-08-21).
 *
 *  Deliberately a BLOCKLIST, not an is-it-a-question allowlist: a junk line
 *  that slips through is one tap to delete on the sheet, but a real question
 *  silently dropped is invisible to the student — so only reject shapes we
 *  know are conversational filler. Exported for tests. */
export function isSheetWorthyQuestion(text: string): boolean {
  const t = text.trim();
  if (t.length < 4) return false;
  // Bare option picks: "1", "2.", "3)"
  if (/^\d+[.)]?$/.test(t)) return false;
  // Ordinal picks, with or without a trailing name: "first one, Tri To"
  if (/^(the\s+)?(first|second|third|last)(\s+one)?\b.{0,20}$/i.test(t))
    return false;
  // Acknowledgements and greetings
  if (
    /^(yes|no|ok|okay|sure|yeah|yep|nope|thanks?|thank you|got it|cool|nice|hi|hello|hey)\b.{0,10}$/i.test(
      t,
    )
  )
    return false;
  // Answers to Major's clarifying questions, not questions themselves
  if (/^i\s+(live|am)\b/i.test(t)) return false;
  if (/^i'?m\s+(in|from|taking|planning)\b/i.test(t)) return false;
  if (/^(i\s+)?(don'?t|do not)\s+know\b/i.test(t)) return false;
  if (/^option\s*\d/i.test(t)) return false;
  // Two-word fragments with no question mark ("for printing")
  if (t.length <= 12 && !t.includes("?") && t.split(/\s+/).length <= 2)
    return false;
  return true;
}

function isSavedCourse(v: unknown): v is SavedCourse {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as SavedCourse).course_code === "string"
  );
}

export const useSavedCourses = create<SavedCoursesState>()(
  persist(
    (set, get) => ({
      courses: [],
      questions: [],
      toggle: (course) => {
        const has = get().courses.some(
          (c) => c.course_code === course.course_code,
        );
        set({
          courses: has
            ? get().courses.filter((c) => c.course_code !== course.course_code)
            : [...get().courses, course],
        });
      },
      remove: (courseCode) =>
        set({
          courses: get().courses.filter((c) => c.course_code !== courseCode),
        }),
      addQuestion: (q) => {
        const text = q.trim();
        if (!text || get().questions.includes(text)) return;
        if (!isSheetWorthyQuestion(text)) return;
        set({ questions: [...get().questions, text].slice(-MAX_QUESTIONS) });
      },
      removeQuestion: (index) =>
        set({ questions: get().questions.filter((_, i) => i !== index) }),
      clear: () => {
        set({ courses: [], questions: [] });
        void useSavedCourses.persist?.clearStorage();
      },
    }),
    {
      name: "saved-courses",
      partialize: (s) => ({ courses: s.courses, questions: s.questions }),
      // Hydrate on the client after mount (see SummarySheet), never during the
      // server render — so the first client paint matches SSR and React never
      // reports a hydration mismatch. Same posture as the onboarding store.
      skipHydration: true,
      // A corrupt or stale blob degrades to an empty list, never a type lie —
      // same posture as the onboarding store's validated merge.
      merge: (persisted, current) => {
        const p = persisted as
          | { courses?: unknown; questions?: unknown }
          | undefined;
        const courses = Array.isArray(p?.courses)
          ? p.courses.filter(isSavedCourse)
          : [];
        const questions = Array.isArray(p?.questions)
          ? p.questions.filter((q): q is string => typeof q === "string")
          : [];
        return { ...current, courses, questions };
      },
    },
  ),
);
