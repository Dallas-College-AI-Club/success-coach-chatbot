import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Success Coach | Dallas College AI Club",
  description:
    "Plan your Dallas College classes in about a minute. Major lines up requirements, prerequisites, and transfer credits from the official catalog.",
};

// Simple, Playful and Focus are independent of color mode. Color mode defaults
// to the system preference and can be overridden from the header toggle
// (next-themes stamps `.dark` on <html> before first paint); the printed coach
// sheet remains light.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", "font-sans", sans.variable)}
    >
      <body className="min-h-dvh w-full">
        <ThemeProvider attribute="class" disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
