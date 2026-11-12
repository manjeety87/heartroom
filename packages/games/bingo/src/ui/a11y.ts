/** Screen-reader copy for the board, so colour and ink are never the only signal. */

export function cellLabel(n: number | null, isMarked: boolean, cell: number, size: number): string {
  const where = `row ${Math.floor(cell / size) + 1}, column ${(cell % size) + 1}`;
  if (n === null) return `Empty, ${where}`;
  return `${n}${isMarked ? ", called" : ""}, ${where}`;
}

export function linesLabel(count: number, linesToWin: number): string {
  return `${count} of ${linesToWin} lines`;
}

/** "Riya", "Riya & Kabir", "Riya, Kabir & Asha". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names.at(-1) ?? ""}`;
}
