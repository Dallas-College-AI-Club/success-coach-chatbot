"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { isSheetWorthyQuestion } from "@/features/chat/sheet-questions";

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
