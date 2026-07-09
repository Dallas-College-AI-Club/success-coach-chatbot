import Image from "next/image";
import Link from "next/link";
export const OnboardingHeader = () => {
  return (
    <div className="font-inter flex items-center gap-3 text-lg font-semibold text-neutral-800 md:text-xl">
      <div>
        <Image
          src="/logo.png"
          alt="Dallas College AI Club"
          width={64}
          height={68}
          style={{ width: "auto", height: "auto" }}
        />
      </div>
      <Link href="https://www.dallasai.club">By Dallas College AI Club</Link>
    </div>
  );
};
