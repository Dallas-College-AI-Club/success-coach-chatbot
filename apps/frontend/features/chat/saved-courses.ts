"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  isSheetWorthyQuestion,
  summarizeSheetQuestion,
} from "@/features/chat/sheet-questions";
import { readCourseDetails } from "@/lib/course-details";

// The student's saved class list ("cart"). Holds the ACTUAL tool-result fields
// the student chose to keep — real catalog data, never model prose — so the
// printable summary (/summary) is grounded by construction. Client-side only:
// mirrors the fields of CourseInfoResult rather than importing the tool module,
// which would pull the server-only Drizzle client into the browser bundle.
//
// PRIVACY: this persists to localStorage, and `questions` holds the student's
// typed words or concise starter questions. On a shared machine others can read
// them, so `clear()` exists and /summary offers it. Nothing is sent to a server.

export interface SavedCourse {
  course_code: string;
  title?: string | null;
  credit_hours?: number | null;
  description?: string | null;
  requisites_raw?: string | null;
  campus_locations?: string | null;
  catalog_year?: string | null;
  source_url?: string;
}

interface SavedCoursesState {
  courses: SavedCourse[];
  /** Typed questions or contextual starter labels, without model instructions. */
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

export const useSavedCourses = create<SavedCoursesState>()(
  persist(
    (set, get) => ({
      courses: [],
      questions: [],
      toggle: (raw) => {
        const course = readCourseDetails(raw);
        if (!course) return;
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
        const text = summarizeSheetQuestion(q);
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
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            return localStorage.getItem(name);
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch {
            /* In-memory notes remain usable when storage is full or blocked. */
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch {
            /* Storage may be unavailable. */
          }
        },
      })),
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
          ? p.courses.flatMap((raw) => {
              const course = readCourseDetails(raw);
              return course ? [course] : [];
            })
          : [];
        const questions = Array.isArray(p?.questions)
          ? p.questions.filter((q): q is string => typeof q === "string")
          : [];
        return {
          ...current,
          courses: [
            ...new Map(
              courses.map((course) => [course.course_code, course]),
            ).values(),
          ],
          questions: [
            ...new Set(
              questions
                .map(summarizeSheetQuestion)
                .filter(isSheetWorthyQuestion),
            ),
          ].slice(-MAX_QUESTIONS),
        };
      },
    },
  ),
);
