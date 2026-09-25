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
import { readSyllabusLink, type SyllabusLink } from "@/lib/syllabus-links";
import {
  readCompletionOverrides,
  completionStatus,
  type CompletionChoice,
  type CompletionOverrides,
} from "@/features/chat/completion-state";
import { readCourseHistory } from "@/lib/planning";

// The student's saved class list ("cart"). Holds the ACTUAL tool-result fields
// the student chose to keep — real catalog data, never model prose — so the
// printable summary (/summary) is grounded by construction. Client-side only:
// mirrors the fields of CourseInfoResult rather than importing the tool module,
// which would pull the server-only Drizzle client into the browser bundle.
//
// PRIVACY: this persists to localStorage, and `questions` holds the student's
// typed words or concise starter questions. On a shared machine others can read
// them, so `clear()` exists and /summary offers it. Sheet edits stay local;
// chat questions and completion choices are sent with chat requests.

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
  syllabus_link?: SyllabusLink | null;
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
    syllabus_link: readSyllabusLink(raw.syllabus_link),
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

export interface SheetDraft {
  name: string;
  notes: string[];
  edited: boolean;
  toAsk: string[];
  hiddenAnswers: string[];
  answersSession: string | null;
}

const emptyDraft = (): SheetDraft => ({
  name: "",
  notes: [],
  edited: false,
  toAsk: [],
  hiddenAnswers: [],
  answersSession: null,
});

export function readSheetDraft(value: unknown): SheetDraft {
  const draft = isRecord(value) ? value : {};
  const strings = (v: unknown) =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === "string")
          .slice(0, 100)
          .map((x) => x.slice(0, 8000))
      : [];
  return {
    name: typeof draft.name === "string" ? draft.name.slice(0, 200) : "",
    notes: strings(draft.notes),
    edited: draft.edited === true,
    toAsk: strings(draft.toAsk),
    hiddenAnswers: strings(draft.hiddenAnswers),
    answersSession:
      typeof draft.answersSession === "string" ? draft.answersSession : null,
  };
}

interface SavedCoursesState {
  completionOverrides: CompletionOverrides;
  applyCompletionHistory: (
    history: unknown,
    expected?: CompletionOverrides,
    replace?: boolean,
  ) => void;
  draft: SheetDraft;
  updateDraft: (patch: Partial<SheetDraft>) => void;
  courses: SavedCourse[];
  /** Typed questions or contextual starter labels, without model instructions. */
  questions: string[];
  /** Codes the student ticked as already taken on a plan card. Self-reported
   *  and printed as such — never a transcript. */
  taken: string[];
  toggle: (course: SavedCourse) => void;
  toggleSection: (course: SavedCourse, section: unknown) => void;
  toggleTaken: (courseCode: string) => void;
  setCourseStatus: (courseCode: string, status: CompletionChoice) => void;
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
      completionOverrides: {},
      applyCompletionHistory: (history, expected, replace = false) => {
        const patch: CompletionOverrides = Object.fromEntries(
          Object.entries(readCourseHistory(history)).map(([code, record]) => [
            code,
            record.status === "completed"
              ? true
              : record.status === "not_completed"
                ? false
                : record.status,
          ]),
        );
        const current = get().completionOverrides;
        if (replace)
          for (const code of Object.keys(expected ?? current))
            if (!(code in patch)) patch[code] = "removed";
        const next = { ...current };
        for (const [code, status] of Object.entries(patch)) {
          // A reply that arrives after an edit must not restore the old status.
          if (expected && current[code] !== expected[code]) continue;
          next[code] = status;
        }
        set({
          completionOverrides: next,
          taken: Object.keys(next).filter(
            (code) => completionStatus(next[code]) === "completed",
          ),
        });
      },
      draft: emptyDraft(),
      updateDraft: (patch) =>
        set({ draft: readSheetDraft({ ...get().draft, ...patch }) }),
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
          // Section-only saves have no independent catalog entry to retain.
          // Preserve older explicitly saved catalog courses when unscheduling.
          courses:
            saved && !next.sections.length && !saved.source_url
              ? current.filter((c) => c !== saved)
              : saved
                ? current.map((c) => (c === saved ? next : c))
                : [...current, next],
        });
      },
      toggleTaken: (courseCode) => {
        get().setCourseStatus(courseCode, !get().taken.includes(courseCode));
      },
      setCourseStatus: (courseCode, status) => {
        const patch = readCompletionOverrides({ [courseCode]: status });
        if (!Object.hasOwn(patch, courseCode)) return;
        const next = { ...get().completionOverrides, ...patch };
        set({
          completionOverrides: next,
          taken: Object.keys(next).filter(
            (code) => completionStatus(next[code]) === "completed",
          ),
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
        const questions = [...get().questions, text].slice(-MAX_QUESTIONS);
        set({
          questions,
          draft: {
            ...get().draft,
            toAsk: get().draft.toAsk.filter((q) => questions.includes(q)),
          },
        });
      },
      removeQuestion: (index) => {
        const removed = get().questions[index];
        set({
          questions: get().questions.filter((_, i) => i !== index),
          draft: {
            ...get().draft,
            toAsk: get().draft.toAsk.filter((q) => q !== removed),
          },
        });
      },
      clear: () => {
        set({
          courses: [],
          questions: [],
          taken: [],
          completionOverrides: {},
          draft: emptyDraft(),
        });
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
        draft: s.draft,
        completionOverrides: s.completionOverrides,
      }),
      // Hydrate on the client after mount (see SummarySheet), never during the
      // server render — so the first client paint matches SSR and React never
      // reports a hydration mismatch. Same posture as the onboarding store.
      skipHydration: true,
      // A corrupt or stale blob degrades to an empty list, never a type lie —
      // same posture as the onboarding store's validated merge.
      merge: (persisted, current) => {
        const p = persisted as
          | {
              courses?: unknown;
              questions?: unknown;
              taken?: unknown;
              draft?: unknown;
              completionOverrides?: unknown;
            }
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
        const completionOverrides = readCompletionOverrides(
          p?.completionOverrides ??
            (Array.isArray(p?.taken)
              ? Object.fromEntries(
                  p.taken.filter(isCourseCode).map((code) => [code, true]),
                )
              : {}),
        );
        return {
          ...current,
          draft: readSheetDraft(p?.draft),
          completionOverrides,
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
          taken: Object.keys(completionOverrides).filter(
            (code) =>
              completionStatus(completionOverrides[code]) === "completed",
          ),
        };
      },
    },
  ),
);
