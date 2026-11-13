"use client";

import { useId, useState, type ReactNode } from "react";
import {
  Button,
  CUSTOM_COLOURS,
  CUSTOM_THEME,
  customFromTheme,
  customWarnings,
  MODES,
  SEAT_COLORS,
  SegmentedControl,
  seatColorVar,
  SIDES,
  Switch,
  TEXT_SIZES,
  THEMES,
  type CustomColour,
  type CustomTheme,
  type Side,
} from "@heartroom/ui";
import {
  saveCustomTheme,
  setMode,
  setTextSize,
  setThemeId,
  useCustomTheme,
  useMode,
  useTextSize,
  useThemeId,
} from "@/lib/look";
import { checkName, saveProfile, useProfile, type Profile } from "@/lib/profile";
import { AccountSection } from "./AccountSection.tsx";

export function SettingsScreen({ isGoogleEnabled }: { readonly isGoogleEnabled: boolean }) {
  const profile = useProfile();
  const update = (change: Partial<Profile>) => {
    saveProfile({ ...profile, ...change });
  };
  return (
    <div className="flex flex-col gap-8">
      <Section title="You" note="Saved on this device. Friends will see this name in rooms.">
        <NameField
          name={profile.name}
          onSave={(name) => {
            update({ name });
          }}
        />
        <ColourPicker
          value={profile.color}
          onChange={(color) => {
            update({ color });
          }}
        />
      </Section>
      <Section title="Account">
        <AccountSection isGoogleEnabled={isGoogleEnabled} />
      </Section>
      <Section title="Appearance">
        <SegmentedControl
          label="Light or dark"
          options={MODES}
          value={useMode()}
          onChange={setMode}
        />
        <ThemePicker />
        <SegmentedControl
          label="Text size"
          options={TEXT_SIZES}
          value={useTextSize()}
          onChange={setTextSize}
        />
      </Section>
      <Section title="Sound & touch">
        <Switch
          label="Sounds"
          description="Your turn, a line, a win — quietly"
          checked={profile.sound}
          onChange={(sound) => {
            update({ sound });
          }}
        />
        <Switch
          label="Vibration"
          description="On phones that support it"
          checked={profile.haptics}
          onChange={(haptics) => {
            update({ haptics });
          }}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  readonly title: string;
  readonly note?: string;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-card bg-sheet p-4 shadow-float sm:p-6"
    >
      <div>
        <h2 id={id} className="font-display text-title font-bold tracking-tight text-ink">
          {title}
        </h2>
        {note && <p className="text-small text-pencil">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function NameField({
  name,
  onSave,
}: {
  readonly name: string | null;
  readonly onSave: (name: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(name ?? "");
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  return (
    <form
      className="flex flex-col gap-1"
      // A function action: React 19 blocks a native submit before hydration, so a typed name can
      // never end up in the URL.
      action={() => {
        const checked = checkName(draft);
        if (!checked.ok) {
          setMessage({ text: checked.message, isError: true });
          return;
        }
        onSave(checked.name);
        setDraft(checked.name);
        setMessage({ text: "Saved.", isError: false });
      }}
    >
      <label htmlFor={id} className="text-small font-semibold text-ink">
        Your name
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setMessage(null);
          }}
          maxLength={40}
          autoComplete="nickname"
          placeholder="e.g. Riya"
          aria-invalid={message?.isError === true}
          aria-describedby={`${id}-message`}
          className="min-h-11 min-w-0 flex-1 rounded-tile bg-well px-3 text-body text-ink placeholder:text-pencil focus-visible:outline-2 focus-visible:outline-pen"
        />
        <Button type="submit">Save</Button>
      </div>
      <p
        id={`${id}-message`}
        aria-live="polite"
        className={`min-h-5 text-small ${message?.isError ? "text-margin" : "text-pencil"}`}
      >
        {message?.text ?? "1–20 characters. Shown on your board and in history."}
      </p>
    </form>
  );
}

function ColourPicker({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (id: (typeof SEAT_COLORS)[number]["id"]) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-small font-semibold text-ink">Your colour</legend>
      <p className="mb-3 text-small text-pencil">
        Numbers you call are inked in it, on every board.
      </p>
      <div className="flex flex-wrap gap-3">
        {SEAT_COLORS.map((c) => (
          <label
            key={c.id}
            className="relative grid size-11 cursor-pointer place-items-center rounded-pill has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-pen"
          >
            <input
              type="radio"
              name={name}
              checked={value === c.id}
              onChange={() => {
                onChange(c.id);
              }}
              className="sr-only"
              aria-label={c.label}
            />
            <span
              aria-hidden
              className="size-9 rounded-pill transition-transform duration-(--duration-press) ease-out"
              style={{
                backgroundColor: seatColorVar(c.id),
                transform: value === c.id ? "scale(1)" : "scale(0.8)",
              }}
            />
            {value === c.id && (
              <span aria-hidden className="absolute inset-0 rounded-pill ring-2 ring-ink" />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ThemePicker() {
  const current = useThemeId();
  const custom = useCustomTheme();
  const [isEditing, setIsEditing] = useState(false);
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-small font-semibold text-ink">Theme</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {THEMES.map((t) => (
          <ThemeCard
            key={t.id}
            name={name}
            label={t.label}
            note={t.note}
            isChecked={current === t.id}
            swatch={[t.light.paper, t.light.sheet, t.light.pen, t.dark.paper]}
            onSelect={() => {
              setThemeId(t.id);
            }}
          />
        ))}
        {custom && (
          <ThemeCard
            name={name}
            label="My theme"
            note="Made by you"
            isChecked={current === CUSTOM_THEME}
            swatch={[custom.light.page, custom.light.card, custom.light.accent, custom.dark.page]}
            onSelect={() => {
              setThemeId(CUSTOM_THEME);
            }}
          />
        )}
      </div>
      {isEditing ? (
        <CustomThemeEditor
          initial={custom ?? customFromTheme(current)}
          onDone={() => {
            setIsEditing(false);
          }}
        />
      ) : (
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => {
            setIsEditing(true);
          }}
        >
          {custom ? "Edit my theme" : "Make your own"}
        </Button>
      )}
    </fieldset>
  );
}

function ThemeCard(props: {
  readonly name: string;
  readonly label: string;
  readonly note: string;
  readonly isChecked: boolean;
  readonly swatch: readonly [string, string, string, string];
  readonly onSelect: () => void;
}) {
  const [paper, sheet, pen, dark] = props.swatch;
  return (
    <label
      className={`flex cursor-pointer flex-col gap-2 rounded-tile p-2 ring-2 transition-[box-shadow] duration-(--duration-press) ease-out has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-pen ${props.isChecked ? "ring-pen" : "ring-transparent"}`}
    >
      <input
        type="radio"
        name={props.name}
        checked={props.isChecked}
        onChange={props.onSelect}
        className="sr-only"
      />
      {/* A miniature page: paper, a card on it, the accent, and the dark side's corner. */}
      <span
        aria-hidden
        className="relative h-14 overflow-hidden rounded-cell"
        style={{ backgroundColor: paper }}
      >
        <span
          className="absolute top-2 left-2 h-8 w-12 rounded-cell"
          style={{ backgroundColor: sheet }}
        />
        <span
          className="absolute top-4 left-4 size-4 rounded-pill"
          style={{ backgroundColor: pen }}
        />
        <span
          className="absolute -right-3 -bottom-3 size-10 rotate-45"
          style={{ backgroundColor: dark }}
        />
      </span>
      <span className="text-small font-semibold text-ink">{props.label}</span>
      <span className="-mt-2 text-caption text-pencil">{props.note}</span>
    </label>
  );
}

function CustomThemeEditor({
  initial,
  onDone,
}: {
  readonly initial: CustomTheme;
  readonly onDone: () => void;
}) {
  const [theme, setTheme] = useState<CustomTheme>(initial);
  const [side, setSide] = useState<Side>("light");
  const warnings = customWarnings(theme[side]);
  const setColour = (key: CustomColour, value: string) => {
    setTheme({ ...theme, [side]: { ...theme[side], [key]: value } });
  };
  return (
    <div className="flex flex-col gap-4 rounded-tile bg-well p-4">
      <SegmentedControl
        label="Which side"
        options={SIDES.map((s) => ({
          value: s,
          label: s === "light" ? "Light side" : "Dark side",
        }))}
        value={side}
        onChange={setSide}
      />
      <div className="grid grid-cols-2 gap-3">
        {CUSTOM_COLOURS.map(({ key, label, hint }) => (
          <label key={key} className="flex items-center gap-3">
            <input
              type="color"
              value={theme[side][key]}
              onChange={(event) => {
                setColour(key, event.target.value);
              }}
              className="size-11 shrink-0 cursor-pointer rounded-tile border-0 bg-transparent p-0"
            />
            <span className="flex flex-col">
              <span className="text-small font-semibold text-ink">{label}</span>
              <span className="text-caption text-pencil">{hint}</span>
            </span>
          </label>
        ))}
      </div>
      <ul aria-live="polite" className="text-small text-margin">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            saveCustomTheme(theme);
            onDone();
          }}
        >
          Use my theme
        </Button>
        <Button variant="quiet" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
