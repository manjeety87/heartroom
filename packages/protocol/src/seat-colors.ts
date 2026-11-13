/**
 * The six player colours, in the order the server hands out a free one. The room decides colours, so
 * the ids live here; `packages/ui` maps each id to its light and dark values (`SEAT_COLORS`).
 */
export const SEAT_COLOR_IDS = ["indigo", "coral", "teal", "amber", "violet", "green"] as const;

export type SeatColorId = (typeof SEAT_COLOR_IDS)[number];
