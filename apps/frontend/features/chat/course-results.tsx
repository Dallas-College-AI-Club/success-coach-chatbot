"use client";

import { useId, useState } from "react";

import type { Skin } from "@/features/onboarding/skin";
import { useSavedCourses } from "@/features/chat/saved-courses";
import { citationHref } from "@/lib/constants";
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
    /\b(machine learning|large language models?|LLMs?|natural language processing|NLP|artificial intelligence|data science|data analytics|data analysis|data engineering|computer science|software engineer(?:ing)?|systems engineer(?:ing)?|project management|cybersecurity|databases?|Python|MySQL|SQL|Java|C\+\+|C#|statistics|mathematics|chemistry|biology|nursing|accounting|finance|education|research|Ph\.?D\.?|master'?s?|bachelor'?s?)\b/gi;
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
  skin,
}: {
  name: string;
  background?: string | null;
  url?: unknown;
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
  if (!isRecord(output) || output.found !== true || output.ambiguous === true)
    return null;
  const records: Record<string, unknown>[] =
    name === "get_instructor"
      ? [output]
      : name === "search_knowledge" && Array.isArray(output.results)
        ? output.results
            .filter(isRecord)
            .filter((r) => r.doc_type === "cv")
            .map((r) => ({ ...r, background: r.text }))
        : [];
  if (!records.length) return null;
  return (
    <section
      aria-label="Instructor backgrounds"
      className="w-full rounded-xl border border-current/20 p-4"
    >
      <h2 className="text-lg font-bold">
        {name === "search_knowledge"
          ? "Possible related instructor records"
          : "Instructor background"}
      </h2>
      {name === "search_knowledge" && (
        <p className="mt-1 text-sm">
          Search matches, not a complete faculty list. Check the published
          background for the specific experience you need.
        </p>
      )}
      <ul className="list-none">
        {records.map((record, index) => (
          <li
            key={index}
            className="border-b border-current/15 py-3 last:border-0"
          >
            <p className="mb-2 font-bold">
              {catalogText(record.name) ?? "Instructor"}
            </p>
            <ProfessorDetails
              name={catalogText(record.name) ?? "Instructor"}
              background={catalogText(record.background)}
              url={record.source_url}
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
    </section>
  );
}

function CourseRow({ course, skin }: { course: CourseDetails; skin: Skin }) {
  const saved = useSavedCourses((s) =>
    s.courses.some((c) => c.course_code === course.course_code),
  );
  const toggle = useSavedCourses((s) => s.toggle);
  const href = citationHref(course.source_url);
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
            <div>
              <dt className="font-semibold">
                Prerequisites and other catalog requirements
              </dt>
              <dd className="whitespace-pre-line">
                {course.requisites_raw ??
                  "No prerequisite details are listed in this record. Check the catalog or ask your Success Coach before enrolling."}
              </dd>
            </div>
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
    : name === GET_PROGRAM_REQUIREMENTS_TOOL_NAME &&
        Array.isArray(output.groups) &&
        (output.groups.length > 0 || output.semester_scope_found === false);
}

export function CourseResults({
  name,
  output,
  skin,
  semesters = [],
}: {
  name: string;
  output: unknown;
  skin: Skin;
  semesters?: number[];
}) {
  if (!hasCourseResults(name, output) || !isRecord(output)) return null;
  if (name === GET_COURSE_INFO_TOOL_NAME) {
    const course = readCourseDetails(output);
    return course ? (
      <ul aria-label="Course details" className="w-full list-none">
        <CourseRow course={course} skin={skin} />
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
  return (
    <section className="w-full min-w-0" aria-label="Published course plan">
      <h2 className="text-xl leading-tight font-bold">
        {catalogText(output.name) ?? "Published course plan"}
      </h2>
      <p className="mt-1 text-sm opacity-75">
        {catalogText(output.catalog_year)
          ? `${output.catalog_year} catalog · `
          : ""}
        {typeof output.total_credits === "number" ||
        typeof output.total_credits === "string"
          ? `${output.total_credits} credits for the full program`
          : "Total credits not listed"}
      </p>
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
                  {g.credits_required} credits
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
                {entries.map((code, entryIndex) => {
                  const course = courses.get(code);
                  return course ? (
                    <CourseRow key={code} course={course} skin={skin} />
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
                    </li>
                  );
                })}
              </ol>
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
              ].map((code) => {
                const course = courses.get(code);
                return course ? (
                  <CourseRow key={code} course={course} skin={skin} />
                ) : (
                  <li key={code} className="py-2 text-sm">
                    {code} — course details unavailable.
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
  const row = (section: Record<string, unknown>, index: number) => {
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
      className="w-full rounded-xl border border-current/20 p-4"
    >
      <h2 className="text-lg font-bold">
        {String(output.course_code)} — Class sections
      </h2>
      <p className="mt-1 text-sm">
        {String(output.total_sections ?? sections.length)} sections in the saved
        schedule{output.requested_term ? ` for ${output.requested_term}` : ""}.
        This is not live registration or seat availability.
      </p>
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
        <p className="mt-2 text-sm">
          No sections found for this request in the saved records.
        </p>
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
