import { citationHref } from "./constants";

export type SyllabusLink = { url: string; kind: "direct" };
export type SectionLink = SyllabusLink | { url: string; kind: "source" };

/** Accept only Dallas College document links, including the public title URL.
 * A library/search page is never a replacement for a section's syllabus. */
export function readSyllabusLink(value: unknown): SyllabusLink | null {
  if (!value || typeof value !== "object") return null;
  const { url, kind } = value as Record<string, unknown>;
  if (typeof url !== "string") return null;
  if (
    kind === "direct" &&
    (/^https:\/\/dallascollege\.simplesyllabus\.com\/(?:en-US\/)?doc\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?\/?(?:\?mode=view)?$/.test(url) ||
      /^https:\/\/dallascollege\.campusconcourse\.com\/view_syllabus\?course_id=\d+$/.test(url))
  )
    return { url, kind };
  return null;
}

/** Previously saved Concourse documents may have migrated since they were saved.
 * A bare source URL remains provenance, not proof of a verified syllabus. */
export function needsSyllabusRefresh(section: {
  term?: unknown;
  source_url?: unknown;
  syllabus_link?: unknown;
}): boolean {
  if (!isLegacyFallSection(section)) return false;
  const recorded = readSyllabusLink(section.syllabus_link);
  return !recorded || new URL(recorded.url).hostname === "dallascollege.campusconcourse.com";
}

export function isLegacyFallSection(section: {
  term?: unknown;
  source_url?: unknown;
}): boolean {
  if (section.term !== "Fall 2026") return false;
  const source = citationHref(section.source_url);
  if (!source) return false;
  const url = new URL(source);
  return (
    url.hostname === "dallascollege.campusconcourse.com" &&
    (url.pathname === "/view_syllabus" || url.pathname === "/search")
  );
}

/** Preserve the original source as the saved-section identity. Resolve only
 * the displayed link so an update cannot duplicate or remove a saved class. */
export function sectionSyllabusLink(
  section: { term?: unknown; source_url?: unknown; syllabus_link?: unknown },
  current: Record<string, SyllabusLink> = {},
): SectionLink | null {
  const source = citationHref(section.source_url);
  const updated =
    isLegacyFallSection(section) && source && readSyllabusLink(current[source]);
  if (updated) return updated;
  const recorded = readSyllabusLink(section.syllabus_link);
  if (recorded) return recorded;
  if (isLegacyFallSection(section)) return null;
  return source ? { url: source, kind: "source" } : null;
}

export function sectionLinkLabel(link: SectionLink): string {
  return link.kind === "direct" ? "View syllabus" : "Section source";
}
