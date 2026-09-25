"use client";

import { citationHref } from "@/lib/constants";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { clearConversation } from "@/features/chat/conversation-store";
import { PlanningControls } from "@/features/chat/planning-controls";

import { AiClubLogo } from "@/features/onboarding/shared/brand";
import { SuccessCoachBot } from "@/features/onboarding/shared/success-coach-bot";
import {
  useHydrateSession,
  useSavedSession,
  useStudentSession,
} from "@/features/onboarding/onboarding-store";
import {
  useSavedCourses,
  savedSectionKey,
  type SavedCourse,
} from "@/features/chat/saved-courses";

// The printable Success Coach hand-off sheet. Assembled MECHANICALLY from saved
// tool results + the student's own onboarding answers + their typed edits —
// never from model prose, so "nothing on paper the catalog didn't say" is a
// property of what this component reads, not a promise. window.print() turns it
// into a PDF; the on-screen edit controls are print:hidden.

// The printed date never changes while the sheet is open, so there is nothing
// to subscribe to — this only needs the client value instead of the server's.
const subscribeNothing = () => () => {};
const today = () =>
  new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
const noDate = () => "";

function Cite({ label, url }: { label: string; url?: string | null }) {
  const href = citationHref(url);
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
        <span className="sheet-code">{course.course_code}</span> {course.title}
        {course.sections?.length
          ? course.sections.map((section) => (
              <div key={savedSectionKey(section)} className="sheet-req">
                <strong>
                  Section {section.section_number ?? "not listed"} ·{" "}
                  {section.term ?? "Term not listed"}
                </strong>
                <div>
                  {section.start_date ?? "Start date not listed"} –{" "}
                  {section.end_date ?? "End date not listed"}
                </div>
                {section.meets.length ? (
                  section.meets.map((time) => <div key={time}>{time}</div>)
                ) : section.meeting_info_raw ? (
                  <div>
                    Source meeting information: {section.meeting_info_raw}
                  </div>
                ) : null}
                <div>
                  {[
                    section.professor,
                    section.campus,
                    section.modality?.replaceAll("_", " "),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <Cite
                  label="Saved section · confirm current details"
                  url={section.source_url}
                />
              </div>
            ))
          : null}
        {course.source_url && (
          <Cite
            label={`Dallas College catalog ${course.catalog_year ?? ""}`.trim()}
            url={course.source_url}
          />
        )}
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
  const [historyOpen, setHistoryOpen] = useState(false);
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
  const taken = useSavedCourses((s) => s.taken);
  const removeCourse = useSavedCourses((s) => s.remove);
  const questions = useSavedCourses((s) => s.questions);
  const removeQuestion = useSavedCourses((s) => s.removeQuestion);
  const clearSaved = useSavedCourses((s) => s.clear);

  const { name, notes, edited, toAsk, hiddenAnswers } = useSavedCourses(
    (s) => s.draft,
  );
  const updateDraft = useSavedCourses((s) => s.updateDraft);
  const toggleAsk = (q: string) =>
    updateDraft({
      toAsk: toAsk.includes(q)
        ? toAsk.filter((item) => item !== q)
        : [...toAsk, q],
    });
  const touch = () => updateDraft({ edited: true });

  // Sections 01/02 are conditional, so the numbers are counted at render —
  // hardcoding them made the sheet open at "02" whenever the student had not
  // asked a question yet.
  let sectionNo = 0;
  const nextIdx = () => String(++sectionNo).padStart(2, "0");
  // The READER's today, read on the client only. This page prerenders, and
  // suppressHydrationWarning told React to keep whatever that render produced
  // — so computing the date inline froze the BUILD date into every sheet
  // (production printed "September 21" on September 22).
  const printedOn = useSyncExternalStore(subscribeNothing, today, noDate);

  return (
    <div className="sheet-scope">
      <div className="sheet-toolbar">
        <Link className="sheet-back" href="/chat">
          ← Back to chat
        </Link>
        <span className="sheet-hint">Edit your sheet, then print</span>
        <PlanningControls
          label="Edit / restart"
          history={undefined}
          historyOpen={historyOpen}
          onHistoryOpenChange={setHistoryOpen}
          busy={false}
          onRestart={(clearSavedData) => {
            clearConversation();
            if (clearSavedData) clearSaved();
            useStudentSession.getState().resetSession();
            window.location.assign("/");
          }}
        />
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
                "Clear your saved classes, reported courses, questions, sheet edits, and this tab's chat history? Your setup choices will stay.",
              )
            ) {
              clearSaved();
              clearConversation();
            }
          }}
        >
          Reset prep sheet
        </button>
      </div>

      <div className="sheet-page">
        <header className="sheet-masthead">
          <SuccessCoachBot className="sheet-bot" />
          <div className="sheet-title">
            <h1>Success Coach appointment</h1>
            <p>Notes I made with Major, the Dallas College AI Club planner.</p>
          </div>
          <div className="sheet-meta">
            <label>
              Name{" "}
              <input
                value={name}
                maxLength={200}
                onChange={(e) => updateDraft({ name: e.target.value })}
                placeholder="your name"
                aria-label="Your name"
              />
              <span className="sheet-name-print">
                {name || "________________"}
              </span>
            </label>
            <div className="sheet-printed">
              Printed <b>{printedOn}</b>
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
                  aria-checked={toAsk.includes(q)}
                  aria-label={`Ask my coach: ${q}`}
                  className="sheet-checkbox"
                  onClick={() => toggleAsk(q)}
                >
                  {toAsk.includes(q) ? "✓" : ""}
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

        {session && session.summary.some((a) => !hiddenAnswers.includes(a)) ? (
          <section className="sheet-section">
            <h2 className="sheet-shead">
              <span className="sheet-idx">{nextIdx()}</span>
              <span className="sheet-h2">What I told Major</span>
            </h2>
            <ul className="sheet-answers">
              {session.summary
                .filter((a) => !hiddenAnswers.includes(a))
                .map((a) => (
                  <li key={a}>
                    <span>{a}</span>
                    <button
                      type="button"
                      className="sheet-del"
                      aria-label={`Remove ${a}`}
                      onClick={() => {
                        updateDraft({ hiddenAnswers: [...hiddenAnswers, a] });
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

        {taken.length ? (
          <section className="sheet-section">
            <h2 className="sheet-shead">
              <span className="sheet-idx">{nextIdx()}</span>
              <span className="sheet-h2">
                Courses I reported as completed (not a transcript)
              </span>
              <button
                type="button"
                className="sheet-add min-h-11 print:hidden"
                onClick={() => setHistoryOpen(true)}
              >
                Edit
              </button>
            </h2>
            <ul className="sheet-answers">
              {taken.map((code) => (
                <li key={code}>
                  <span className="sheet-code">{code}</span>
                  <button
                    type="button"
                    className="sheet-del"
                    aria-label={`Remove reported ${code}`}
                    onClick={() =>
                      useSavedCourses
                        .getState()
                        .setCourseStatus(code, "removed")
                    }
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
                updateDraft({ notes: [...notes, ""] });
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
                <textarea
                  value={n}
                  placeholder="Type your note…"
                  aria-label="Note"
                  maxLength={8000}
                  rows={3}
                  onChange={(e) => {
                    const next = [...notes];
                    next[i] = e.target.value;
                    updateDraft({ notes: next });
                    touch();
                  }}
                />
                <p className="sheet-note-print">{n}</p>
                <button
                  type="button"
                  className="sheet-del"
                  aria-label="Remove note"
                  onClick={() => {
                    updateDraft({ notes: notes.filter((_, j) => j !== i) });
                    touch();
                  }}
                >
                  ×
                </button>
              </div>
            ))
          ) : (
            <p className="sheet-empty">
              (add a note or a question for your coach)
            </p>
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
              Major helps you plan. <b>A Success Coach makes it official.</b>
            </p>
            <p className="sheet-fmeta">
              Prepared with Major · Book a coach →{" "}
              <a
                href="https://www.dallascollege.edu/resources/success-coaching/"
                target="_blank"
                rel="noopener noreferrer"
              >
                dallascollege.edu/resources/success-coaching
              </a>
            </p>
          </div>
          <AiClubLogo className="sheet-club-logo" />
        </footer>
      </div>
    </div>
  );
}
