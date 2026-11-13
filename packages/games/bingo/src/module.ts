import { defineGame } from "@heartroom/engine";
import { bingoConfigSchema, isClassic, MAX_SEATS } from "./config.ts";
import {
  apply,
  autoAction,
  bingoActionSchema,
  nextDeadline,
  result,
  setup,
  validate,
} from "./rules.ts";
import { perturbHidden, view } from "./view.ts";

export const bingo = defineGame({
  id: "bingo",
  version: 1,
  players: { min: 2, max: MAX_SEATS },
  configSchema: bingoConfigSchema,
  isRanked: (config) => isClassic(config),
  actionSchema: bingoActionSchema,
  setup: (config, seats) => setup(config, seats),
  validate,
  apply,
  nextDeadline,
  autoAction,
  view,
  result,
  perturbHidden,
});
