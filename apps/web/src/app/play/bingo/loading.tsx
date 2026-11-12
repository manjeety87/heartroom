/** A skeleton in the shape of the setup screen, so nothing jumps when it arrives. */
export default function BingoLoading() {
  return (
    <main aria-busy className="mx-auto flex max-w-xl flex-col gap-4 px-gutter py-6">
      <div className="h-9 w-56 animate-pulse rounded-tile bg-well motion-reduce:animate-none" />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-card bg-well motion-reduce:animate-none"
          />
        ))}
      </div>
    </main>
  );
}
