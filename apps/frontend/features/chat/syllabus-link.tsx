"use client";

import { useEffect, useState } from "react";
import {
  isLegacyFallSection,
  readSyllabusLink,
  sectionLinkLabel,
  sectionSyllabusLink,
  type SyllabusLink as LinkValue,
} from "@/lib/syllabus-links";

const pendingLinks = new Map<string, Promise<Record<string, LinkValue>>>();
function currentLinks(source: string) {
  let pending = pendingLinks.get(source);
  if (!pending) {
    pending = fetch(`/api/syllabus-links?source=${encodeURIComponent(source)}`, {
      cache: "no-cache",
      signal: AbortSignal.timeout(10000),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Syllabus links unavailable");
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || Array.isArray(data)) return {};
        return Object.fromEntries(
          Object.entries(data).flatMap(([source, value]) => {
            const link = readSyllabusLink(value);
            return link ? [[source, link]] : [];
          }),
        );
      })
      .catch(() => {
        pendingLinks.delete(source);
        return {};
      });
    pendingLinks.set(source, pending);
  }
  return pending;
}

export function SyllabusLink({
  section,
  className,
}: {
  section: { term?: unknown; source_url?: unknown; syllabus_link?: unknown };
  className?: string;
}) {
  const [links, setLinks] = useState<Record<string, LinkValue>>({});
  const source = typeof section.source_url === "string" ? section.source_url : "";
  const refresh = isLegacyFallSection(section) && !readSyllabusLink(section.syllabus_link);
  useEffect(() => {
    if (!refresh) return;
    let active = true;
    void currentLinks(source).then((value) => {
      if (active) setLinks(value);
    });
    return () => {
      active = false;
    };
  }, [refresh, source]);
  const link = sectionSyllabusLink(section, links);
  return link ? (
    <a
      className={className}
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {sectionLinkLabel(link)} ↗
    </a>
  ) : null;
}
