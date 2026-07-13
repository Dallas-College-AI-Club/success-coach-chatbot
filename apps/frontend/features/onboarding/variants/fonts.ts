import { Anton, Dancing_Script, Nunito, Space_Grotesk } from "next/font/google";

// Modern, highly readable faces per mode. Simple inherits the app default
// (Manrope, set in the root layout).
export const nunito = Nunito({ subsets: ["latin"] });
export const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

// Display faces for the Success Coach brand cover only: a signature script for
// "Success" and a heavy condensed block for "COACH".
export const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["700"],
});
export const anton = Anton({ subsets: ["latin"], weight: ["400"] });
