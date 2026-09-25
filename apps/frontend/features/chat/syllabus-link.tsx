"use client";

import { useEffect, useState } from "react";
import {
  isLegacyFallSection,
  readSyllabusLink,
  sectionLinkLabel,
  sectionSyllabusLink,
  type SyllabusLink as LinkValue,
} from "@/lib/syllabus-links";

let pendingLinks: Promise<Record<string, LinkValue>> | undefined;
function currentLinks() {
  if (!pendingLinks) {
    pendingLinks = fetch("/api/syllabus-links", {
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
        pendingLinks = undefined;
        return {};
      });
  }
  return pendingLinks;
}

export function SyllabusLink({
  section,
  className,
}: {
  section: { term?: unknown; source_url?: unknown; syllabus_link?: unknown };
  className?: string;
}) {
  const [links, setLinks] = useState<Record<string, LinkValue>>({});
  const refresh = isLegacyFallSection(section);
  useEffect(() => {
    if (!refresh) return;
    let active = true;
    void currentLinks().then((value) => {
      if (active) setLinks(value);
    });
    return () => {
      active = false;
    };
  }, [refresh]);
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
