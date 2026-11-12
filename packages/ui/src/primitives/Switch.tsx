export type SwitchProps = {
  readonly label: string;
  readonly description?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
};

/** An on/off setting. The whole row is the target, so it is easy to hit on a phone. */
export function Switch({ label, description, checked, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        onChange(!checked);
      }}
      className="flex min-h-11 w-full items-center justify-between gap-4 rounded-tile text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen"
    >
      <span className="flex flex-col">
        <span className="text-body text-ink">{label}</span>
        {description && <span className="text-small text-pencil">{description}</span>}
      </span>
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-pill transition-colors duration-(--duration-popover) ease-out ${checked ? "bg-pen" : "bg-well"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-6 rounded-pill bg-sheet shadow-float transition-transform duration-(--duration-popover) ease-out motion-reduce:transition-none ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
