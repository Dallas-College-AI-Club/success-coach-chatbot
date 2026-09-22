import type { InterestArea } from "@/features/onboarding/types";

// What the undecided path can show for each interest area. These are EXAMPLES
// the chat looks up live — never auto-selected as the student's program.
//
// Verified against the live database on 2026-09-22: every program is a picker
// label that get_program_requirements resolves to exactly one program_map row,
// its semester-1 courses have named Fall 2026 instructors, and every topic
// matches at least 3 indexed CVs through search_faculty_expertise. The first
// program and first topic also appear in 40-character chip labels, so keep
// them short.
export const INTEREST_GUIDE: Record<
  InterestArea,
  { examplePrograms: string[]; expertiseTopics: string[] }
> = {
  health: {
    examplePrograms: [
      "Medical Assisting Certificate",
      "Associate Degree Nursing A.A.S.",
      "Dental Hygiene A.A.S.",
    ],
    expertiseTopics: ["nursing", "anatomy", "patient care"],
  },
  tech: {
    examplePrograms: [
      "Python Developer Certificate",
      "Cyber Security A.A.S.",
      "Software Development A.A.S.",
    ],
    expertiseTopics: ["cybersecurity", "machine learning", "python"],
  },
  business: {
    examplePrograms: [
      "Accounting A.A.S.",
      "Marketing A.A.S.",
      "Entrepreneurship A.A.S.",
    ],
    expertiseTopics: ["accounting", "marketing", "finance"],
  },
  arts: {
    examplePrograms: [
      "Digital Art and Design A.A.S.",
      "Animation Certificate",
      "UX/UI Design Certificate",
    ],
    expertiseTopics: ["graphic design", "photography", "animation"],
  },
  trades: {
    examplePrograms: [
      "Welding Applications A.A.S.",
      "Air Conditioning and Refrigeration Technology A.A.S.",
      "Automotive Career Technician A.A.S.",
    ],
    expertiseTopics: ["welding", "HVAC", "automotive"],
  },
};
