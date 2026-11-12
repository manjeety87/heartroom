import { useId } from "react";

export type SegmentedOption<T extends string> = { readonly value: T; readonly label: string };

export type SegmentedControlProps<T extends string> = {
  readonly label: string;
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
};

/**
 * A row of mutually exclusive choices (Auto / Light / Dark). Native radios underneath, so arrow
 * keys and screen readers work; the thumb slides to the choice from wherever it is now.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const name = useId();
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      <div
        className="relative grid rounded-pill bg-well p-1"
        style={{ gridTemplateColumns: `repeat(${String(options.length)}, minmax(0, 1fr))` }}
      >
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 rounded-pill bg-sheet shadow-float transition-transform duration-(--duration-popover) ease-out motion-reduce:transition-none"
          style={{
            width: `calc((100% - 0.5rem) / ${String(options.length)})`,
            transform: `translateX(${String(index * 100)}%)`,
          }}
        />
        {options.map((option) => (
          <label
            key={option.value}
            className={`relative flex min-h-10 cursor-pointer select-none items-center justify-center rounded-pill px-3 text-small font-semibold has-focus-visible:outline-2 has-focus-visible:outline-pen ${
              option.value === value ? "text-ink" : "text-pencil"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => {
                onChange(option.value);
              }}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
