import { citationHref } from "./constants";

export const SYLLABUS_LIBRARY =
  "https://dallascollege.simplesyllabus.com/en-US/syllabus-library";

export type SyllabusLink = { url: string; kind: "direct" | "library" };
export type SectionLink = SyllabusLink | { url: string; kind: "source" };

/** Accept only Dallas College's public library or an exact document URL. */
export function readSyllabusLink(value: unknown): SyllabusLink | null {
  if (!value || typeof value !== "object") return null;
  const { url, kind } = value as Record<string, unknown>;
  if (typeof url !== "string") return null;
  if (kind === "library" && url === SYLLABUS_LIBRARY) return { url, kind };
  if (
    kind === "direct" &&
    /^https:\/\/dallascollege\.simplesyllabus\.com\/en-US\/doc\/[a-zA-Z0-9_-]+\/?$/.test(
      url,
    )
  )
    return { url, kind };
  return null;
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
  if (isLegacyFallSection(section)) {
    return {
      url: SYLLABUS_LIBRARY,
      kind: "library",
    };
  }
  return source ? { url: source, kind: "source" } : null;
}

export function sectionLinkLabel(link: SectionLink): string {
  return link.kind === "direct"
    ? "View syllabus"
    : link.kind === "library"
      ? "Find syllabus in library"
      : "Section source";
}
