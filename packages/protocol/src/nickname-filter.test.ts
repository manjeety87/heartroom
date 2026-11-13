import { describe, expect, it } from "vitest";
import { nicknameProblem } from "./nickname-filter.ts";
import { nicknameInput } from "./messages.ts";

describe("nicknameProblem", () => {
  it("when a name is ordinary, then lets it through", () => {
    for (const name of [
      "Riya",
      "Arjun 2",
      "Cockburn",
      "Scunthorpe",
      "Dickens",
      "Gandhi",
      "Assam",
      "Raunak",
      "Sussex",
      "प्रिया",
      "Shitij",
    ]) {
      expect(nicknameProblem(name), name).toBeNull();
    }
  });

  it("when a name swears in English, Hinglish or Hindi, then blocks it, however it is spelled", () => {
    for (const name of [
      "fuck",
      "F U C K",
      "fuuuuck",
      "Fück",
      "ch00tiya",
      "Bhen chod",
      "mother fucker",
      "BSDK",
      "चूतिया",
      "big gandu",
      "xxfuckxx",
    ]) {
      expect(nicknameProblem(name), name).toBe("blocked");
    }
  });

  it("when a name poses as the site or its staff, then reserves it", () => {
    for (const name of ["Admin", "heartroom", "Heart Room", "H0st", "Room Host", "Support"]) {
      expect(nicknameProblem(name), name).toBe("reserved");
    }
  });
});

describe("nicknameInput", () => {
  it("when a name is blocked or reserved, then explains without repeating the word", () => {
    const blocked = nicknameInput.safeParse("chutiya");
    expect(blocked.success).toBe(false);
    expect(blocked.error?.issues[0]?.message).toBe("Pick a friendlier name.");
    expect(nicknameInput.safeParse("Admin").error?.issues[0]?.message).toBe(
      "That name is reserved. Pick another.",
    );
  });
});
