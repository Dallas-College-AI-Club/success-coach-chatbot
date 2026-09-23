"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  isSheetWorthyQuestion,
  summarizeSheetQuestion,
} from "@/features/chat/sheet-questions";
import {
  catalogText,
  isCourseCode,
  isRecord,
  readCourseDetails,
} from "@/lib/course-details";
import { citationHref } from "@/lib/constants";

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
  sections?: SavedSection[];
}

export interface SavedSection {
  section_number: string | null;
  term: string | null;
  professor: string | null;
  campus: string | null;
  modality: string | null;
  start_date: string | null;
  end_date: string | null;
  meets: string[];
  meeting_info_raw: string | null;
  source_url: string;
}

export function readSavedSection(raw: unknown): SavedSection | null {
  if (!isRecord(raw)) return null;
  const source = citationHref(raw.source_url);
  if (!source) return null;
  return {
    section_number: catalogText(raw.section_number),
    term: catalogText(raw.term),
    professor: catalogText(raw.professor),
    campus: catalogText(raw.campus),
    modality: catalogText(raw.modality),
    start_date: catalogText(raw.start_date),
    end_date: catalogText(raw.end_date),
    meets: [
      ...new Set(
        (Array.isArray(raw.meets) ? raw.meets : [])
          .map(catalogText)
          .filter((s): s is string => !!s),
      ),
    ],
    meeting_info_raw: catalogText(raw.meeting_info_raw),
    source_url: source,
  };
}

export const savedSectionKey = (section: SavedSection) =>
  JSON.stringify([section.source_url, section.term, section.section_number]);

function readSavedCourse(raw: unknown): SavedCourse | null {
  const course = readCourseDetails(raw);
  if (!course || !isRecord(raw)) return null;
  const sections = (Array.isArray(raw.sections) ? raw.sections : [])
    .map(readSavedSection)
    .filter((s): s is SavedSection => s !== null);
  return {
    ...course,
    sections: [
      ...new Map(sections.map((s) => [savedSectionKey(s), s])).values(),
    ],
  };
}

interface SavedCoursesState {
  courses: SavedCourse[];
  /** Typed questions or contextual starter labels, without model instructions. */
  questions: string[];
  /** Codes the student ticked as already taken on a plan card. Self-reported
   *  and printed as such — never a transcript. */
  taken: string[];
  toggle: (course: SavedCourse) => void;
  toggleSection: (course: SavedCourse, section: unknown) => void;
  toggleTaken: (courseCode: string) => void;
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
      taken: [],
      toggle: (raw) => {
        const course = readSavedCourse(raw);
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
      toggleSection: (rawCourse, rawSection) => {
        const course = readSavedCourse(rawCourse);
        const section = readSavedSection(rawSection);
        if (!course || !section) return;
        const current = get().courses;
        const saved = current.find((c) => c.course_code === course.course_code);
        const sections = saved?.sections ?? [];
        const key = savedSectionKey(section);
        const next = {
          ...(saved ?? course),
          sections: sections.some((s) => savedSectionKey(s) === key)
            ? sections.filter((s) => savedSectionKey(s) !== key)
            : [...sections, section],
        };
        set({
          courses: saved
            ? current.map((c) => (c === saved ? next : c))
            : [...current, next],
        });
      },
      toggleTaken: (courseCode) =>
        set({
          taken: get().taken.includes(courseCode)
            ? get().taken.filter((c) => c !== courseCode)
            : [...get().taken, courseCode],
        }),
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
        set({ courses: [], questions: [], taken: [] });
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
      partialize: (s) => ({
        courses: s.courses,
        questions: s.questions,
        taken: s.taken,
      }),
      // Hydrate on the client after mount (see SummarySheet), never during the
      // server render — so the first client paint matches SSR and React never
      // reports a hydration mismatch. Same posture as the onboarding store.
      skipHydration: true,
      // A corrupt or stale blob degrades to an empty list, never a type lie —
      // same posture as the onboarding store's validated merge.
      merge: (persisted, current) => {
        const p = persisted as
          | { courses?: unknown; questions?: unknown; taken?: unknown }
          | undefined;
        const courses = Array.isArray(p?.courses)
          ? p.courses.flatMap((raw) => {
              const course = readSavedCourse(raw);
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
          taken: Array.isArray(p?.taken)
            ? [...new Set(p.taken.filter(isCourseCode))]
            : [],
        };
      },
    },
  ),
);
