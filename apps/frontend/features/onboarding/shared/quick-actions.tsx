"use client";

import type { Skin } from "@/features/onboarding/skin";

// Official Dallas College resources, linked directly. A quiet row beneath the
// "Start planning chat" CTA at the end of onboarding, so a student who wants a
// specific office can jump straight there. Ordered planning → support → people.
// All open the real Dallas College site in a new tab.
const RESOURCES: { label: string; href: string }[] = [
  { label: "See all credit classes", href: "https://schedule.dallascollege.edu/" },
  {
    label: "Academic calendar",
    href: "https://catalog.dallascollege.edu/content.php?catoid=5&navoid=1259",
  },
  { label: "Tutoring", href: "https://www.dallascollege.edu/resources/tutoring/" },
  {
    // Student Care Network: tuition help, emergency aid, food + basic needs,
    // dental, childcare, laptops — everything outside class that keeps you enrolled.
    label: "Aid & essentials",
    href: "https://www.dallascollege.edu/resources/student-care-network/",
  },
  { label: "Campus events", href: "https://www.dallascollege.edu/events/" },
  {
    label: "Talk to a Success Coach",
    href: "https://www.dallascollege.edu/resources/success-coaching/",
  },
];

export function QuickActions({ skin }: { skin: Skin }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className={skin.sectionLabel}>Dallas College resources</p>
      <div className="flex flex-wrap gap-1.5">
        {RESOURCES.map(({ label, href }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-current/15 px-3 py-1 text-xs opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] pointer-coarse:min-h-9"
          >
            {label}
            <span aria-hidden className="opacity-55">
              ↗
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
