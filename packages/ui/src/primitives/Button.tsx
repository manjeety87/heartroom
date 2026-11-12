import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: ButtonVariant;
};

const BASE =
  "inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-pill px-5 " +
  "text-body font-semibold touch-manipulation " +
  "transition-[transform,background-color,color] duration-(--duration-press) ease-out " +
  "active:scale-97 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen " +
  "motion-reduce:transition-none motion-reduce:active:scale-100";

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary: "bg-pen text-on-pen",
  secondary: "bg-well text-ink",
  quiet: "bg-transparent text-pen",
};

/** The one button. Pill-shaped, 44px tall at minimum, presses down slightly. */
export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  const classes = `${BASE} ${VARIANTS[variant]} ${className ?? ""}`;
  return <button type={type} className={classes} {...props} />;
}
