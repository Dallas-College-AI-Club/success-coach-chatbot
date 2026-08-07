import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Success Coach | Dallas College AI Club",
  description:
    "Plan your Dallas College classes in about a minute. Major lines up requirements, prerequisites, and transfer credits from the official catalog.",
};

// No forced colour-scheme: the browser/user preference is respected. The look is
// chosen by the student in the mode picker (including a dark option).

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("antialiased", "font-sans", sans.variable)}
    >
      <body className="min-h-dvh w-full">{children}</body>
    </html>
  );
}
