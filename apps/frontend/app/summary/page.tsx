import { Bricolage_Grotesque } from "next/font/google";

import { SummarySheet } from "@/features/chat/summary-sheet";

// Display face for the sheet's headings — the one distinctive element of the
// chosen look; body reuses the app's Manrope. Self-hosted by next/font, so it
// resolves offline and the printed PDF matches the screen.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-bricolage",
});

export const metadata = {
  title: "My Success Coach appointment",
};

// The printable hand-off. A plain client-rendered page: it reads the saved
// class list and onboarding answers from the browser stores, so it needs no
// server data and writes nothing — closing the tab is the whole privacy story.
export default function SummaryPage() {
  return (
    <main className={bricolage.variable}>
      <SummarySheet />
    </main>
  );
}
