export { bingo } from "./module.ts";
export {
  bingoConfigSchema,
  CLASSIC,
  isClassic,
  lineCountFor,
  MAX_SEATS,
  MAX_SIZE,
  MIN_SIZE,
  PRESETS,
  setupMsFor,
  TIMER_MODES,
  type BingoConfig,
  type TimerMode,
} from "./config.ts";
export { completedLines, isMarked, lineCells } from "./lines.ts";
export {
  bingoActionSchema,
  uncalled,
  type BingoAction,
  type BingoPhase,
  type BingoState,
} from "./rules.ts";
export type { BingoPublicView, BingoSeatView, BingoSpectatorView, BingoView } from "./view.ts";
export { BOT_LEVELS, chooseCall, fillGrid, type BotLevel } from "./bot.ts";
