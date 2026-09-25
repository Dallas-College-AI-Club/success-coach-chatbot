import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">This page could not be found.</h1>
      <p>Start with Major or return to your planning conversation.</p>
      <Link className="rounded-lg border px-4 py-3 underline" href="/">
        Back to the start
      </Link>
      <Link className="rounded-lg border px-4 py-3 underline" href="/chat">
        Return to chat
      </Link>
    </main>
  );
}
