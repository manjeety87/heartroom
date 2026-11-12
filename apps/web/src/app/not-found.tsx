import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-gutter py-12">
      <h1 className="font-display text-h2 font-extrabold tracking-tight text-ink">
        This page isn’t here
      </h1>
      <p className="text-body text-pencil">The link may be old, or the room may have closed.</p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-pill bg-pen px-5 font-semibold text-on-pen focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen"
      >
        Go home
      </Link>
    </main>
  );
}
