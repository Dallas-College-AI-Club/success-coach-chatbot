"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { AiClubLogo } from "@/features/onboarding/shared/brand";
import {
  useHydrateSession,
  useSavedSession,
} from "@/features/onboarding/onboarding-store";
import {
  useSavedCourses,
  type SavedCourse,
} from "@/features/chat/saved-courses";

// The printable Success Coach hand-off sheet. Assembled MECHANICALLY from saved
// tool results + the student's own onboarding answers + their typed edits —
// never from model prose, so "nothing on paper the catalog didn't say" is a
// property of what this component reads, not a promise. window.print() turns it
// into a PDF; the on-screen edit controls are print:hidden.

function cleanUrl(u?: string | null): string {
  const href = (u ?? "").split("#")[0];
  // Only ever emit an http(s) link — the store persists whatever was saved, so
  // a stray javascript:/data: URL must never become a live href.
  return /^https?:\/\//i.test(href) ? href : "";
}

function Cite({ label, url }: { label: string; url?: string | null }) {
  const href = cleanUrl(url);
  if (!href) return <span className="sheet-cite">{label}</span>;
  return (
    <span className="sheet-cite">
      {label} ·{" "}
      <a href={href} target="_blank" rel="noopener noreferrer">
        {href.replace(/^https?:\/\//, "")}
      </a>
    </span>
  );
}

function ClassEntry({
  course,
  onRemove,
}: {
  course: SavedCourse;
  onRemove: () => void;
}) {
  return (
    <div className="sheet-row">
      <div className="sheet-row-main">
        <span className="sheet-code">{course.course_code}</span>{" "}
        {course.title}
        {course.requisites_raw ? (
          <div className="sheet-req">&ldquo;{course.requisites_raw}&rdquo;</div>
        ) : null}
        <Cite
          label={`Dallas College catalog ${course.catalog_year ?? ""}`.trim()}
          url={course.source_url}
        />
      </div>
      {course.credit_hours != null ? (
        <div className="sheet-cr">{course.credit_hours} cr</div>
      ) : null}
      <button
        type="button"
        className="sheet-del"
        aria-label={`Remove ${course.course_code}`}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}

export function SummarySheet() {
  // Both stores skip auto-hydration so SSR and the first client paint match;
  // trigger them here, after mount, exactly as the chat screen does.
  useHydrateSession();
  useEffect(() => {
    // `persist` is absent when storage was unavailable as the module
    // loaded (a browser refusing localStorage). Optional-chain it, exactly as
    // useHydrateSession does — an unguarded call is a TypeError in a mount
    // effect, and with no error boundary it takes the whole route down.
    void useSavedCourses.persist?.rehydrate();
  }, []);

  const session = useSavedSession();
  const courses = useSavedCourses((s) => s.courses);
  const removeCourse = useSavedCourses((s) => s.remove);
  const questions = useSavedCourses((s) => s.questions);
  const removeQuestion = useSavedCourses((s) => s.removeQuestion);
  const clearSaved = useSavedCourses((s) => s.clear);

  const [name, setName] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [edited, setEdited] = useState(false);
  // Which asked-questions the student wants to raise with their coach again.
  // Print-time annotation, keyed by text so it survives a removal above it.
  const [toAsk, setToAsk] = useState<Set<string>>(() => new Set());
  // Onboarding answers the student chose not to show their coach. Sheet-local
  // and keyed by text: this must not edit the saved onboarding session, which
  // the chat still reads.
  const [hiddenAnswers, setHiddenAnswers] = useState<Set<string>>(
    () => new Set(),
  );
  const toggleAsk = (q: string) =>
    setToAsk((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });

  const touch = () => setEdited(true);

  // Sections 01/02 are conditional, so the numbers are counted at render —
  // hardcoding them made the sheet open at "02" whenever the student had not
  // asked a question yet.
  let sectionNo = 0;
  const nextIdx = () => String(++sectionNo).padStart(2, "0");
  // Client-only value; the printed date carries suppressHydrationWarning below,
  // so a day-boundary difference between SSR and client never warns.
  const printedOn = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="sheet-scope">
      <div className="sheet-toolbar">
        <a className="sheet-back" href="/chat">
          ← Back to chat
        </a>
        <span className="sheet-hint">Edit your sheet, then print</span>
        <button
          type="button"
          className="sheet-print"
          onClick={() => window.print()}
        >
          🖨 Print / Save PDF
        </button>
        {/* Shared/lab machines: the saved list and the student's own questions
            live in localStorage, so there has to be a way to wipe them. */}
        <button
          type="button"
          className="sheet-back"
          onClick={() => {
            if (
              window.confirm(
                "Clear your saved classes and questions from this browser?",
              )
            ) {
              clearSaved();
            }
          }}
        >
          Clear my saved data
        </button>
      </div>

      <div className="sheet-page">
        <header className="sheet-masthead">
          <Image
            src="/dallas-college.svg"
            alt="Dallas College"
            width={54}
            height={54}
            className="sheet-dc-logo"
          />
          <div className="sheet-title">
            <h1>Success Coach appointment</h1>
            <p>Notes I made with Major, the Dallas College AI Club planner.</p>
          </div>
          <div className="sheet-meta">
            <label>
              Name{" "}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="your name"
                aria-label="Your name"
              />
            </label>
            <div className="sheet-printed">
              Printed <b suppressHydrationWarning>{printedOn}</b>
            </div>
          </div>
        </header>

        {questions.length ? (
          <section className="sheet-section">
            <h2 className="sheet-shead">
              <span className="sheet-idx">{nextIdx()}</span>
              <span className="sheet-h2">Questions I asked Major</span>
              <span className="sheet-shint">✓ the ones to ask your coach</span>
            </h2>
            {questions.map((q, i) => (
              <div key={q} className="sheet-check-item">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={toAsk.has(q)}
                  aria-label={`Ask my coach: ${q}`}
                  className="sheet-checkbox"
                  onClick={() => toggleAsk(q)}
                >
                  {toAsk.has(q) ? "✓" : ""}
                </button>
                <span>{q}</span>
                <button
                  type="button"
                  className="sheet-del"
                  aria-label="Remove question"
                  onClick={() => {
                    removeQuestion(i);
                    touch();
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </section>
        ) : null}

        {session && session.summary.some((a) => !hiddenAnswers.has(a)) ? (
          <section className="sheet-section">
            <h2 className="sheet-shead">
              <span className="sheet-idx">{nextIdx()}</span>
              <span className="sheet-h2">What I told Major</span>
            </h2>
            <ul className="sheet-answers">
              {session.summary
                .filter((a) => !hiddenAnswers.has(a))
                .map((a) => (
                  <li key={a}>
                    <span>{a}</span>
                    <button
                      type="button"
                      className="sheet-del"
                      aria-label={`Remove ${a}`}
                      onClick={() => {
                        setHiddenAnswers((prev) => new Set(prev).add(a));
                        touch();
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ) : null}

        <section className="sheet-section">
          <h2 className="sheet-shead">
            <span className="sheet-idx">{nextIdx()}</span>
            <span className="sheet-h2">My class list</span>
          </h2>
          {courses.length ? (
            courses.map((c) => (
              <ClassEntry
                key={c.course_code}
                course={c}
                onRemove={() => {
                  removeCourse(c.course_code);
                  touch();
                }}
              />
            ))
          ) : (
            <p className="sheet-empty">
              (no classes saved yet — save some in the chat)
            </p>
          )}
        </section>

        <section className="sheet-section">
          <h2 className="sheet-shead">
            <span className="sheet-idx">{nextIdx()}</span>
            <span className="sheet-h2">My notes &amp; questions</span>
            <button
              type="button"
              className="sheet-add"
              onClick={() => {
                setNotes([...notes, ""]);
                touch();
              }}
            >
              + Add a note
            </button>
          </h2>
          {notes.length ? (
            notes.map((n, i) => (
              <div key={i} className="sheet-note">
                <span aria-hidden>✎</span>
                <input
                  value={n}
                  placeholder="Type your note…"
                  aria-label="Note"
                  onChange={(e) => {
                    const next = [...notes];
                    next[i] = e.target.value;
                    setNotes(next);
                    touch();
                  }}
                />
                <button
                  type="button"
                  className="sheet-del"
                  aria-label="Remove note"
                  onClick={() => {
                    setNotes(notes.filter((_, j) => j !== i));
                    touch();
                  }}
                >
                  ×
                </button>
              </div>
            ))
          ) : (
            <p className="sheet-empty">(add a note or a question for your coach)</p>
          )}
        </section>

        {edited ? (
          <p className="sheet-editflag">
            Note to my coach: I edited or added some items on this sheet myself,
            so it may not match exactly what Major showed me.
          </p>
        ) : null}

        <footer className="sheet-footer">
          <div>
            <p className="sheet-promise">
              Major helps you plan.{" "}
              <b>A Success Coach makes it official.</b>
            </p>
            <p className="sheet-fmeta">
              Prepared with Major · Book a coach →
              dallascollege.edu/resources/success-coaching
            </p>
          </div>
          <AiClubLogo className="sheet-club-logo" />
        </footer>
      </div>
    </div>
  );
}
