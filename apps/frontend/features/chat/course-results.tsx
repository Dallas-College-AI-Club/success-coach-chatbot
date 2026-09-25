"use client";

import { useId, useState } from "react";

import type { Skin } from "@/features/onboarding/skin";
import {
  readSavedSection,
  savedSectionKey,
  useSavedCourses,
} from "@/features/chat/saved-courses";
import { citationHref } from "@/lib/constants";
import {
  assessRequisites,
  readCourseHistory,
  type CourseHistory,
} from "@/lib/planning";
import {
  catalogText,
  groupScheduleSections,
  isCourseCode,
  isRecord,
  programCourseCode,
  readCourseDetails,
  scopeProgramGroups,
  type CourseDetails,
  type ScheduleGrouping,
} from "@/lib/course-details";
import {
  GET_COURSE_INFO_TOOL_NAME,
  GET_PROGRAM_REQUIREMENTS_TOOL_NAME,
} from "@/lib/tools/names";

function ExpertiseText({ text }: { text: string }) {
  // Highlight literal phrases already present; never infer an expertise label.
  const keywords =
    /(?<![\p{L}\p{N}])(machine learning|large language models?|LLMs?|natural language processing|NLP|artificial intelligence|data science|data analytics|data analysis|data engineering|computer science|software engineer(?:ing)?|systems engineer(?:ing)?|project management|cybersecurity|databases?|Python|MySQL|SQL|Java|C\+\+|C#|statistics|mathematics|chemistry|biology|nursing|accounting|finance|education|research|Ph\.?D\.?|master'?s?|bachelor'?s?)(?![\p{L}\p{N}+#])/giu;
  return (
    <>
      {text.split(keywords).map((part, index) =>
        index % 2 ? (
          <mark
            key={index}
            className="rounded bg-amber-200/70 px-0.5 font-semibold text-slate-950"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function ProfessorDetails({
  name,
  background,
  url,
  sources,
  skin,
}: {
  name: string;
  background?: string | null;
  url?: unknown;
  sources?: unknown[];
  skin: Skin;
}) {
  const href = citationHref(url);
  if (!href && !background) return null;
  return (
    <details className="min-w-0 text-sm">
      <summary
        className={`${skin.link} cursor-pointer`}
        aria-label={`Professor CV for ${name}`}
      >
        Professor CV · Show more
      </summary>
      <div className="mt-2 space-y-2 rounded-lg border border-current/15 p-3">
        <strong>{name}</strong>
        <p className="text-xs opacity-75">
          Saved professional background; teaching history may refer to earlier
          terms. Check the official CV for current information.
        </p>
        {background ? (
          <p className="leading-relaxed whitespace-pre-line">
            <ExpertiseText text={background} />
          </p>
        ) : (
          <p>Open the official source to read this professor&apos;s CV.</p>
        )}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${skin.link} inline-block`}
          >
            Open official CV ↗
          </a>
        )}
        {sources
          ?.map(citationHref)
          .filter((link): link is string => !!link && link !== href)
          .map((link) => (
            <a
              key={link}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={`${skin.link} ml-3 inline-block`}
            >
              Additional saved CV source ↗
            </a>
          ))}
      </div>
    </details>
  );
}

export function InstructorResults({
  name,
  output,
  skin,
}: {
  name: string;
  output: unknown;
  skin: Skin;
}) {
  const [visibleCount, setVisibleCount] = useState(50);
  const expertise = name === "search_faculty_expertise";
  if (
    !isRecord(output) ||
    (!expertise && output.found !== true) ||
    output.ambiguous === true
  )
    return null;
  const records: Record<string, unknown>[] =
    expertise && Array.isArray(output.results)
      ? output.results.filter(isRecord).map((r) => ({
          ...r,
          background: Array.isArray(r.evidence)
            ? r.evidence.filter((t) => typeof t === "string").join("\n\n")
            : null,
        }))
      : name === "get_instructor"
        ? [output]
        : name === "search_knowledge" && Array.isArray(output.results)
          ? output.results
              .filter(isRecord)
              .filter((r) => r.doc_type === "cv")
              .map((r) => ({ ...r, background: r.text }))
          : [];
  if (!records.length && !expertise) return null;
  return (
    <section
      aria-label="Instructor backgrounds"
      className="w-full rounded-xl border border-current/20 p-4"
    >
      <h2 className="text-lg font-bold">
        {expertise
          ? `${records.length} matching faculty profile${records.length === 1 ? "" : "s"}`
          : name === "search_knowledge"
            ? "Possible related instructor records"
            : "Instructor background"}
      </h2>
      {expertise && (
        <div className="mt-2 space-y-2 text-sm">
          <p>
            Checked {String(output.indexed_cv_records ?? 0)} indexed CV records
            for{" "}
            {Array.isArray(output.topics)
              ? output.topics.join(output.match === "all" ? " AND " : " OR ")
              : "the requested topics"}
            .
          </p>
          <p>{catalogText(output.coverage_note)}</p>
          <details>
            <summary className={`${skin.link} cursor-pointer`}>
              Search coverage · Show more
            </summary>
            <p className="mt-2">
              Saved source dates:{" "}
              {catalogText(output.oldest_source)?.slice(0, 10) ?? "unknown"} to{" "}
              {catalogText(output.newest_source)?.slice(0, 10) ?? "unknown"}.
            </p>
            {Array.isArray(output.keyword_variants) &&
              output.keyword_variants.filter(isRecord).map((item, index) => (
                <p key={index}>
                  {catalogText(item.topic)}:{" "}
                  {Array.isArray(item.terms) ? item.terms.join(", ") : ""}
                </p>
              ))}
          </details>
        </div>
      )}
      {name === "search_knowledge" && (
        <p className="mt-1 text-sm">
          Search matches, not a complete faculty list. Check the published
          background for the specific experience you need.
        </p>
      )}
      <ul className="list-none">
        {records.slice(0, visibleCount).map((record, index) => (
          <li
            key={index}
            className="border-b border-current/15 py-3 last:border-0"
          >
            <p className="mb-2 font-bold">
              {/* Expertise results arrive sorted by surname and carry their
                  own "Bracewell, David" label — a surname-sorted list of
                  "David Bracewell" rows just reads as unsorted. The tool owns
                  the rule so the two never drift; the printed name stays
                  intact in the CV card below. */}
              {(expertise ? catalogText(record.display_name) : null) ??
                catalogText(record.name) ??
                "Instructor"}
            </p>
            {expertise && Array.isArray(record.topics) && (
              <p className="mb-2 text-sm">
                Evidence mentions: {record.topics.join(", ")}
              </p>
            )}
            <ProfessorDetails
              name={catalogText(record.name) ?? "Instructor"}
              background={catalogText(record.background)}
              url={record.source_url}
              sources={
                Array.isArray(record.source_urls)
                  ? record.source_urls
                  : undefined
              }
              skin={skin}
            />
            {Array.isArray(record.teaches) && (
              <details className="mt-2 text-sm">
                <summary className={`${skin.link} cursor-pointer`}>
                  Teaching record · Show more
                </summary>
                <ul className="mt-2 list-inside list-disc">
                  {record.teaches
                    .filter((t): t is string => typeof t === "string")
                    .map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
      {records.length > visibleCount && (
        <button
          type="button"
          className={`${skin.link} mt-3 text-sm`}
          onClick={() => setVisibleCount((count) => count + 50)}
        >
          Show more faculty · {visibleCount} of {records.length} shown
        </button>
      )}
    </section>
  );
}

export type CourseScheduleAction = {
  onViewSchedule: (courseCode: string) => void;
  busy: boolean;
};

function ViewScheduleButton({
  courseCode,
  skin,
  action,
}: {
  courseCode: string;
  skin: Skin;
  action?: CourseScheduleAction;
}) {
  if (!action || !isCourseCode(courseCode)) return null;
  return (
    <button
      type="button"
      aria-label={`View schedule for ${courseCode}`}
      disabled={action.busy}
      className={`${skin.chip} min-h-11 shrink-0 cursor-pointer disabled:cursor-wait disabled:opacity-50`}
      onClick={() => action.onViewSchedule(courseCode)}
    >
      View schedule
    </button>
  );
}

function CourseRow({
  course,
  skin,
  history = {},
  plan = false,
  scheduleAction,
}: {
  course: CourseDetails;
  skin: Skin;
  history?: CourseHistory;
  /** On a program-plan card the student can tick the course as taken. */
  plan?: boolean;
  scheduleAction?: CourseScheduleAction;
}) {
  const saved = useSavedCourses((s) =>
    s.courses.some((c) => c.course_code === course.course_code),
  );
  const toggle = useSavedCourses((s) => s.toggle);
  const taken = useSavedCourses((s) => s.taken.includes(course.course_code));
  const toggleTaken = useSavedCourses((s) => s.toggleTaken);
  const href = citationHref(course.source_url);
  const requisites = assessRequisites(course.requisites_raw, history);
  return (
    <li className="border-b border-current/15 py-3 pl-1 last:border-0">
      <p className="leading-snug">
        <strong>{course.course_code}</strong>
        {course.title ? ` — ${course.title}` : ""}{" "}
        <span className="ml-2 text-sm whitespace-nowrap opacity-75">
          {course.credit_hours == null
            ? "Credits not listed"
            : `${course.credit_hours} credits`}
        </span>
      </p>
      <div className="mt-2 flex flex-wrap items-start gap-x-4 gap-y-2">
        <details className="group min-w-0 flex-1 basis-48">
          <summary
            className={`${skin.link} cursor-pointer text-sm focus-visible:outline-2 focus-visible:outline-offset-4`}
          >
            <span className="group-open:hidden">Show more</span>
            <span className="hidden group-open:inline">Show less</span>
            <span className="sr-only"> about {course.course_code}</span>
          </summary>
          <dl className="mt-3 space-y-3 text-sm leading-relaxed">
            <div>
              <dt className="font-semibold">Description</dt>
              <dd>
                {course.description ??
                  "A description is not available in this catalog record."}
              </dd>
            </div>
            {[
              ["Required prerequisites", requisites.required],
              ["Recommended preparation", requisites.recommended],
              [
                "Corequisites / concurrent requirements",
                requisites.corequisites,
              ],
            ].map(([label, texts]) =>
              Array.isArray(texts) && texts.length > 0 ? (
                <div key={String(label)}>
                  <dt className="font-semibold">{String(label)}</dt>
                  <dd className="whitespace-pre-line">{texts.join("\n")}</dd>
                </div>
              ) : null,
            )}
            <div>
              <dt className="font-semibold">Prerequisite review</dt>
              <dd>{requisites.note}</dd>
            </div>
            {requisites.referenced_courses?.some(
              (r) => r.student_status !== "unknown",
            ) && (
              <div>
                <dt className="font-semibold">What you reported</dt>
                <dd>
                  {requisites.referenced_courses
                    .filter((r) => r.student_status !== "unknown")
                    .map(
                      (r) =>
                        `${r.course_code}: ${r.student_status.replaceAll("_", " ")}`,
                    )
                    .join("; ")}
                  . This does not confirm enrollment eligibility.
                </dd>
              </div>
            )}
            {course.campus_locations && (
              <div>
                <dt className="font-semibold">
                  Campuses listed in the catalog
                </dt>
                <dd>{course.campus_locations}</dd>
              </div>
            )}
            <div>
              <dt className="font-semibold">Catalog edition</dt>
              <dd>{course.catalog_year ?? "Not listed"}</dd>
            </div>
          </dl>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${skin.link} mt-3 inline-block text-sm`}
            >
              View catalog source ↗
              <span className="sr-only"> for {course.course_code}</span>
            </a>
          )}
        </details>
        {/* Ticking courses is how the student says what they finished — far
            easier than typing codes, and the chip composes the sentence. */}
        {plan && (
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm pointer-coarse:min-h-11">
            <input
              type="checkbox"
              checked={taken}
              aria-label={`I've taken ${course.course_code}`}
              onChange={() => toggleTaken(course.course_code)}
              className="size-4 accent-current"
            />
            I&apos;ve taken this
          </label>
        )}
        <ViewScheduleButton
          courseCode={course.course_code}
          skin={skin}
          action={scheduleAction}
        />
        <button
          type="button"
          aria-pressed={saved}
          aria-label={`${saved ? "Remove" : "Add"} ${course.course_code} ${saved ? "from" : "to"} my notes`}
          className={`${skin.chip} shrink-0 cursor-pointer pointer-coarse:min-h-11`}
          onClick={() => toggle(course)}
        >
          {saved ? "✓ Added to notes" : "+ Add to notes"}
        </button>
      </div>
    </li>
  );
}

export function hasCourseResults(name: string, output: unknown): boolean {
  if (!isRecord(output) || output.found !== true || output.ambiguous === true)
    return false;
  return name === GET_COURSE_INFO_TOOL_NAME
    ? !!readCourseDetails(output)
    : (name === GET_PROGRAM_REQUIREMENTS_TOOL_NAME ||
        name === "compare_programs") &&
        Array.isArray(output.groups) &&
        (output.groups.length > 0 || output.semester_scope_found === false);
}

export function CourseResults({
  name,
  output,
  skin,
  semesters = [],
  scheduleAction,
}: {
  name: string;
  output: unknown;
  skin: Skin;
  semesters?: number[];
  scheduleAction?: CourseScheduleAction;
}) {
  if (!hasCourseResults(name, output) || !isRecord(output)) return null;
  if (name === GET_COURSE_INFO_TOOL_NAME) {
    const course = readCourseDetails(output);
    return course ? (
      <ul aria-label="Course details" className="w-full list-none">
        <CourseRow
          course={course}
          skin={skin}
          history={readCourseHistory(output.course_history)}
          scheduleAction={scheduleAction}
        />
      </ul>
    ) : null;
  }
  const courses = new Map<string, CourseDetails>();
  for (const entry of Array.isArray(output.course_details)
    ? output.course_details
    : []) {
    const course = readCourseDetails(entry);
    if (course) courses.set(course.course_code, course);
  }
  const titles = isRecord(output.course_titles) ? output.course_titles : {};
  const requested = semesters.length
    ? semesters
    : Array.isArray(output.requested_semesters)
      ? output.requested_semesters.filter(
          (n): n is number => typeof n === "number",
        )
      : [];
  const groups = scopeProgramGroups(
    output.groups as unknown[],
    requested,
  ).filter(isRecord);
  const planning = isRecord(output.planning) ? output.planning : null;
  const comparison = isRecord(output.comparison) ? output.comparison : null;
  const history = readCourseHistory(planning?.history);
  const alreadyReported = (code: string) =>
    ["completed", "in_progress"].includes(history[code]?.status);
  return (
    <section className="w-full min-w-0" aria-label="Published course plan">
      <h2 className="text-xl leading-tight font-bold">
        {catalogText(output.name) ?? "Published course plan"}
      </h2>
      {!comparison && (
        <p className="mt-1 text-sm opacity-75">
          {catalogText(output.catalog_year)
            ? `${output.catalog_year} catalog · `
            : ""}
          {typeof output.total_credits === "number" ||
          typeof output.total_credits === "string"
            ? `${output.total_credits} credits for the full program`
            : "Total credits not listed"}
        </p>
      )}
      {comparison && (
        <div className="mt-3 space-y-2 text-sm">
          <p>{catalogText(comparison.note)}</p>
          <p>
            {typeof comparison.shared_required_credits === "number"
              ? `${comparison.shared_required_credits} shared required credits.`
              : "Shared credits cannot be confirmed for these catalog records."}
          </p>
          {Array.isArray(comparison.programs) &&
            comparison.programs.filter(isRecord).map((program, index) => (
              <p key={index}>
                {String(program.name)} · {String(program.catalog_year)}{" "}
                {citationHref(program.source_url) && (
                  <a
                    href={citationHref(program.source_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={skin.link}
                  >
                    Catalog source ↗
                  </a>
                )}
              </p>
            ))}
          <details>
            <summary className={`${skin.link} cursor-pointer`}>
              Electives and unresolved requirements · Show more
            </summary>
            {Array.isArray(comparison.unresolved_requirements) &&
              comparison.unresolved_requirements
                .flat()
                .filter((s): s is string => typeof s === "string")
                .map((text, index) => (
                  <p key={index} className="mt-2">
                    {text}
                  </p>
                ))}
          </details>
        </div>
      )}
      {planning && (
        <div
          className="mt-4 space-y-2 rounded-xl border border-current/20 p-3 text-sm"
          aria-label="Your planning checklist"
        >
          <p className="font-semibold">
            Your checklist · {String(planning.scope)}
          </p>
          {Object.keys(history).length > 0 && (
            <details open>
              <summary className={`${skin.link} cursor-pointer`}>
                Courses you reported · Show more
              </summary>
              <ul className="mt-2 list-inside list-disc">
                {Object.entries(history).map(([code, entry]) => (
                  <li key={code}>
                    <strong>{code}</strong>: {entry.status.replaceAll("_", " ")}
                    {!courses.has(code) ? " · not verified in this plan" : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {typeof planning.remaining_credits === "number" ? (
            <p>
              {planning.remaining_credits} credits remain unfinished, including
              courses in progress.
            </p>
          ) : (
            <p>
              An exact remaining-credit total needs review of the unresolved
              items below.
            </p>
          )}
          {planning.needs_history_clarification === true && (
            <p className="font-semibold">
              Please clarify your course history: give the course codes and
              whether each course is completed, in progress, not completed,
              planned or awaiting transfer review. The checklist may be
              incomplete until those details are confirmed.
            </p>
          )}
          <p>{String(planning.note)}</p>
          {Array.isArray(planning.unresolved_requirements) &&
            planning.unresolved_requirements.length > 0 && (
              <details>
                <summary className={`${skin.link} cursor-pointer`}>
                  Choices and credit checks · Show more
                </summary>
                <ul className="mt-2 list-inside list-disc">
                  {planning.unresolved_requirements
                    .filter((s): s is string => typeof s === "string")
                    .map((text, index) => (
                      <li key={index}>{text}</li>
                    ))}
                </ul>
              </details>
            )}
        </div>
      )}
      {requested.length > 0 && (
        <p className="mt-3 font-semibold">
          {groups.length
            ? `Showing only semester ${requested.join(" and ")}.`
            : `Semester ${requested.join(" and ")} is not identified in this catalog record. Check the program catalog; courses have not been assigned to a semester.`}
        </p>
      )}
      <p className="mt-1 text-sm opacity-75">
        Published course requirements. Your coach can review admission
        conditions and what you still need.
      </p>
      {groups.map((g, index) => {
        const seenCourses = new Set<string>();
        const entries = (Array.isArray(g.courses) ? g.courses : [])
          .filter((c): c is string => typeof c === "string")
          .flatMap((entry) => {
            const code = programCourseCode(entry);
            // Repeated elective slots represent separate required credits.
            if (!code) return [entry];
            if (seenCourses.has(code)) return [];
            seenCourses.add(code);
            return [code];
          });
        const electiveRule = entries.some((entry) =>
          /\belective\b/i.test(entry),
        )
          ? catalogText(g.rule)
          : null;
        return (
          <section
            key={index}
            className="mt-6 rounded-xl border border-current/20"
          >
            <header className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-current/20 bg-current/5 px-4 py-3">
              <h3 className="text-lg leading-snug font-bold sm:text-xl">
                {catalogText(g.name) ?? "Course group"}
              </h3>
              {typeof g.credits_required === "number" && (
                <span className="rounded-full border border-current/20 px-3 py-1 text-sm font-semibold whitespace-nowrap">
                  {g.credits_required} total credits
                </span>
              )}
            </header>
            <div className="px-4 py-2">
              {["choose", "elective", "placeholder"].includes(
                String(g.slot_kind),
              ) && (
                <p className="text-sm opacity-75">
                  Course options — confirm which satisfy this requirement with
                  your coach.
                </p>
              )}
              {!electiveRule &&
                catalogText(g.rule) &&
                (String(g.rule).length > 200 ? (
                  <details className="my-2">
                    <summary className={`${skin.link} cursor-pointer text-sm`}>
                      Show options and catalog requirements
                    </summary>
                    <p className="mt-2 text-sm whitespace-pre-line">
                      {String(g.rule)}
                    </p>
                  </details>
                ) : (
                  <p className="mt-1 text-sm whitespace-pre-line">
                    {String(g.rule)}
                  </p>
                ))}
              {g.options_exhaustive === false && (
                <p className="text-sm">
                  Other options may also satisfy this requirement.
                </p>
              )}
              {Array.isArray(g.exclusions) &&
                [
                  ...new Set(
                    g.exclusions
                      .filter(isRecord)
                      .map((e) => catalogText(e.raw_text))
                      .filter(Boolean),
                  ),
                ].map((text) => (
                  <p key={text} className="text-sm">
                    {text}
                  </p>
                ))}
              <ol className="ml-5 list-decimal marker:font-semibold">
                {entries
                  .filter((code) => !alreadyReported(code))
                  .map((code, entryIndex) => {
                    const course = courses.get(code);
                    return course ? (
                      <CourseRow
                        key={code}
                        course={course}
                        skin={skin}
                        history={history}
                        scheduleAction={scheduleAction}
                        plan
                      />
                    ) : (
                      <li
                        key={`${entryIndex}-${code}`}
                        className="border-b border-current/15 py-3 last:border-0"
                      >
                        {/\belective\b/i.test(code) ? (
                          <details>
                            <summary className={`${skin.link} cursor-pointer`}>
                              {code}{" "}
                              <span className="ml-2 text-sm">Show more</span>
                            </summary>
                            <p className="mt-2 text-sm whitespace-pre-line">
                              {electiveRule ??
                                "Choose a course that satisfies this elective with your Success Coach. Check the linked program catalog for the allowed options."}
                            </p>
                          </details>
                        ) : (
                          <>
                            <p>
                              {code}
                              {catalogText(titles[code])
                                ? ` — ${titles[code]}`
                                : ""}
                            </p>
                          </>
                        )}
                        <p className="text-sm opacity-75">
                          {isCourseCode(code)
                            ? "Course details are not available in this record. Check the linked program catalog."
                            : "A requirement to choose with your coach, not an individual course."}
                        </p>
                        <ViewScheduleButton
                          courseCode={code}
                          skin={skin}
                          action={scheduleAction}
                        />
                      </li>
                    );
                  })}
              </ol>
              {entries.some(alreadyReported) && (
                <p className="my-2 text-sm">
                  {entries.filter(alreadyReported).join(", ")} — already
                  reported above; excluded from courses to consider.
                </p>
              )}
            </div>
          </section>
        );
      })}
      {(Array.isArray(output.component_areas) ? output.component_areas : [])
        .filter(isRecord)
        .filter(
          (area) =>
            !requested.length ||
            groups.some(
              (group) =>
                group.component_area_code === area.code ||
                (Array.isArray(group.courses) &&
                  group.courses.some(
                    (entry) =>
                      typeof entry === "string" &&
                      entry.includes(`(${area.code})`),
                  )),
            ),
        )
        .map((area, index) => (
          <details key={index} className="mt-4">
            <summary className={`${skin.link} cursor-pointer text-sm`}>
              Course options for{" "}
              {catalogText(area.name) ??
                catalogText(area.code) ??
                "this requirement"}
            </summary>
            <p className="mt-2 text-sm">
              {catalogText(area.choose) ??
                "Choose the credits the program requires with your coach."}
            </p>
            <ul className="list-none">
              {[
                ...new Set(
                  (Array.isArray(area.courses) ? area.courses : []).filter(
                    isCourseCode,
                  ),
                ),
              ]
                .filter((code) => !alreadyReported(code))
                .map((code) => {
                  const course = courses.get(code);
                  return course ? (
                    <CourseRow
                      key={code}
                      course={course}
                      skin={skin}
                      history={history}
                      scheduleAction={scheduleAction}
                      plan
                    />
                  ) : (
                    <li key={code} className="py-2 text-sm">
                      {code} — course details unavailable.
                      <ViewScheduleButton
                        courseCode={code}
                        skin={skin}
                        action={scheduleAction}
                      />
                    </li>
                  );
                })}
            </ul>
            {typeof area.more_not_shown === "number" &&
              area.more_not_shown > 0 && (
                <p className="text-sm">
                  {area.more_not_shown} additional options are not shown in this
                  result. Check the program catalog.
                </p>
              )}
          </details>
        ))}
    </section>
  );
}

export function ScheduleResults({
  name,
  output,
  skin,
  showInstructors = false,
}: {
  name: string;
  output: unknown;
  skin: Skin;
  showInstructors?: boolean;
}) {
  const [groupBy, setGroupBy] = useState<ScheduleGrouping>("section");
  const groupId = useId();
  const savedCourses = useSavedCourses((s) => s.courses);
  const toggleSection = useSavedCourses((s) => s.toggleSection);
  if (
    name !== "get_class_schedule" ||
    !isRecord(output) ||
    !Array.isArray(output.offerings)
  )
    return null;
  const sections = output.offerings.filter(isRecord);
  const profiles = (
    Array.isArray(output.instructor_profiles) ? output.instructor_profiles : []
  ).filter(isRecord);
  const instructors = (
    Array.isArray(output.instructors) ? output.instructors : []
  ).filter(isRecord);
  const groups = groupScheduleSections(sections, groupBy);
  const courseCode = isCourseCode(output.course_code)
    ? output.course_code
    : null;
  const savedSections =
    savedCourses.find((c) => c.course_code === courseCode)?.sections ?? [];
  const row = (section: Record<string, unknown>, index: number) => {
    const saveable = readSavedSection(section);
    const saved =
      saveable &&
      savedSections.some(
        (s) => savedSectionKey(s) === savedSectionKey(saveable),
      );
    const href = citationHref(section.source_url);
    const cvHref = citationHref(section.professor_cv_url);
    const profile = profiles.find((p) => citationHref(p.source_url) === cvHref);
    const times = Array.isArray(section.meets)
      ? section.meets.filter((s): s is string => typeof s === "string")
      : [];
    return (
      <li key={index} className="border-b border-current/15 py-3 last:border-0">
        <p className="font-semibold">
          Section {catalogText(section.section_number) ?? "not listed"} ·{" "}
          {String(section.term ?? "Term not listed")}
        </p>
        <p className="text-sm">
          <strong>
            {catalogText(section.professor) ?? "Instructor not listed"}
          </strong>{" "}
          ·{" "}
          {catalogText(section.modality)?.replaceAll("_", " ") ??
            "Format not listed"}{" "}
          · {catalogText(section.campus) ?? "Campus not listed"}
        </p>
        <p className="mt-1 text-sm">
          {section.start_date && section.end_date
            ? `${section.start_date} – ${section.end_date}`
            : "Course dates have not been loaded."}
        </p>
        {times.length ? (
          <ul className="mt-1 list-inside list-disc text-sm">
            {times.map((time) => (
              <li key={time}>{time}</li>
            ))}
          </ul>
        ) : (
          <div className="mt-1 text-sm">
            <p>
              No published clock times in this record. Check the section source
              before planning your schedule.
            </p>
            {catalogText(section.meeting_info_raw) && (
              <details className="mt-1">
                <summary className={`${skin.link} cursor-pointer`}>
                  Source meeting information
                </summary>
                <p className="mt-1">{String(section.meeting_info_raw)}</p>
              </details>
            )}
          </div>
        )}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {courseCode && saveable && (
            <button
              type="button"
              className={`${skin.chip} min-h-11 text-sm`}
              aria-pressed={!!saved}
              aria-label={`${saved ? "Remove" : "Add"} ${courseCode} section ${saveable.section_number ?? "unlisted"} (${saveable.term ?? "term not listed"}) ${saved ? "from" : "to"} my notes`}
              onClick={() =>
                toggleSection(
                  { course_code: courseCode, title: catalogText(output.title) },
                  saveable,
                )
              }
            >
              {saved ? "✓ Section in notes" : "+ Add section to notes"}
            </button>
          )}
          {href && (
            <a
              className={`${skin.link} inline-block text-sm`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
            >
              Section source ↗
            </a>
          )}
          {cvHref && (
            <ProfessorDetails
              name={catalogText(section.professor) ?? "this instructor"}
              background={catalogText(profile?.background)}
              url={cvHref}
              skin={skin}
            />
          )}
        </div>
      </li>
    );
  };
  return (
    <section
      aria-label="Published class sections"
      data-course-code={courseCode}
      className="w-full rounded-xl border border-current/20 p-4"
    >
      <h2 tabIndex={-1} className="text-lg font-bold focus-visible:outline-2">
        {String(output.course_code)} — Class sections
      </h2>
      <p className="mt-1 text-sm">
        {String(output.total_sections ?? sections.length)} sections in the saved
        schedule{output.requested_term ? ` for ${output.requested_term}` : ""}.
        This is not live registration or seat availability.
      </p>
      {(catalogText(output.oldest_source) ||
        catalogText(output.newest_source)) && (
        <p className="mt-1 text-sm opacity-75">
          Source snapshot:{" "}
          {catalogText(output.oldest_source)?.slice(0, 10) ?? "unknown"} to{" "}
          {catalogText(output.newest_source)?.slice(0, 10) ?? "unknown"}.
          Confirm changes on the official section page.
        </p>
      )}
      {instructors.length > 0 && (
        <details
          key={String(showInstructors)}
          open={showInstructors}
          className="mt-3 rounded-lg border border-current/15 p-3"
        >
          <summary className={`${skin.link} cursor-pointer font-semibold`}>
            All {instructors.length} named instructors · Show more
          </summary>
          <p className="mt-2 text-sm">
            Complete for the selected term in the saved records, including
            sections beyond this page.
          </p>
          <ul className="mt-2 list-none space-y-2">
            {instructors.map((instructor, index) => {
              const profile = profiles.find(
                (p) => p.source_url === instructor.professor_cv_url,
              );
              return (
                <li key={index}>
                  <strong>{String(instructor.name)}</strong>
                  <ProfessorDetails
                    name={String(instructor.name)}
                    background={catalogText(profile?.background)}
                    url={instructor.professor_cv_url}
                    skin={skin}
                  />
                </li>
              );
            })}
          </ul>
          {output.unassigned_instructor === true && (
            <p className="mt-2 text-sm">
              Some sections still list the instructor as to be announced.
            </p>
          )}
        </details>
      )}
      {!sections.length && (
        <div className="mt-2 space-y-2 text-sm">
          <p>No sections found for this request in the saved records.</p>
          <a
            href="https://schedule.dallascollege.edu/"
            target="_blank"
            rel="noopener noreferrer"
            className={skin.link}
          >
            Browse the official class schedule ↗
          </a>
        </div>
      )}
      {sections.length > 0 && (
        <div className="mt-3">
          <label htmlFor={groupId} className="mr-2 text-sm font-semibold">
            Group by
          </label>
          <select
            id={groupId}
            value={groupBy}
            onChange={(event) =>
              setGroupBy(event.target.value as ScheduleGrouping)
            }
            className="rounded-md border border-current/30 bg-transparent px-2 py-1.5 text-sm"
          >
            <option value="section">Section</option>
            <option value="day">Day</option>
            <option value="professor">Professor</option>
            <option value="time">Time</option>
            <option value="campus">Campus</option>
          </select>
          {groupBy !== "section" && (
            <p className="mt-2 text-sm opacity-75">
              Grouping the {sections.length} sections loaded on this page.
              {groupBy === "day" || groupBy === "time"
                ? " A section can appear in more than one group."
                : ""}
              {groupBy === "time"
                ? " By meeting start: morning before noon, afternoon noon–5 PM, evening from 5 PM."
                : ""}
            </p>
          )}
        </div>
      )}
      {groupBy === "section" ? (
        <>
          <ul className="list-none">{sections.slice(0, 5).map(row)}</ul>
          {sections.length > 5 && (
            <details className="mt-3">
              <summary className={`${skin.link} cursor-pointer`}>
                Show {sections.length - 5} more sections
              </summary>
              <ul className="list-none">{sections.slice(5).map(row)}</ul>
            </details>
          )}
        </>
      ) : (
        groups.map(([label, grouped]) => (
          <details
            key={`${groupBy}-${label}`}
            className="mt-3 rounded-lg border border-current/15 px-3 py-2"
          >
            <summary className={`${skin.link} cursor-pointer font-semibold`}>
              {label} · {grouped.length}{" "}
              {grouped.length === 1 ? "section" : "sections"}
            </summary>
            <ul className="list-none">{grouped.map(row)}</ul>
          </details>
        ))
      )}
      {output.truncated === true && (
        <p className="mt-3 text-sm">
          This page shows {sections.length} sections starting at{" "}
          {Number(output.offset ?? 0) + 1}. Ask for the next page of{" "}
          {String(output.course_code)} sections to see the remaining options.
        </p>
      )}
    </section>
  );
}
