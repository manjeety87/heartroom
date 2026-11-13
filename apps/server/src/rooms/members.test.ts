import { describe, expect, it } from "vitest";
import { freeSeat, nameSuggestion, nextHost, pickColor, type Member } from "./members.ts";

const member = (over: Partial<Member> & Pick<Member, "userId">): Member => ({
  nickname: over.userId,
  color: "indigo",
  seat: 0,
  sessionId: `s-${over.userId}`,
  isConnected: true,
  ...over,
});

describe("nameSuggestion", () => {
  const room = [
    member({ userId: "a", nickname: "Riya" }),
    member({ userId: "b", nickname: "Riya 2" }),
  ];

  it("when the name is free, then there is nothing to suggest", () => {
    expect(nameSuggestion("Arjun", "c", room)).toBeNull();
  });

  it("when someone else has it in any case, then suggests the first free number", () => {
    expect(nameSuggestion("riya", "c", room)).toBe("riya 3");
  });

  it("when the same person joins again, then their own name is not a clash", () => {
    expect(nameSuggestion("Riya", "a", room)).toBeNull();
  });

  it("when the name is at the length limit, then shortens it so the suffix fits", () => {
    const long = "Abcdefghijklmnopqrst";
    const suggestion = nameSuggestion(long, "c", [member({ userId: "a", nickname: long })]);
    expect(suggestion).toBe("Abcdefghijklmnopqr 2");
    expect(suggestion?.length).toBe(20);
  });
});

describe("pickColor", () => {
  const room = [member({ userId: "a", color: "indigo" }), member({ userId: "b", color: "teal" })];

  it("when the wished colour is free, then gives it", () => {
    expect(pickColor("amber", "c", room)).toBe("amber");
  });

  it("when the wish is taken or missing, then gives the first free one in order", () => {
    expect(pickColor("teal", "c", room)).toBe("coral");
    expect(pickColor(undefined, "c", room)).toBe("coral");
  });

  it("when the same person rejoins, then keeps their own colour", () => {
    expect(pickColor("teal", "b", room)).toBe("teal");
  });
});

describe("freeSeat", () => {
  it("fills the lowest gap and reports a full room", () => {
    expect(freeSeat([member({ userId: "a", seat: 0 }), member({ userId: "b", seat: 2 })], 6)).toBe(
      1,
    );
    expect(freeSeat([member({ userId: "a", seat: 0 })], 1)).toBeNull();
  });
});

describe("nextHost", () => {
  it("prefers the connected player in the lowest seat over spectators", () => {
    const room = [
      member({ userId: "host", seat: 0 }),
      member({ userId: "watcher", seat: null }),
      member({ userId: "away", seat: 1, isConnected: false }),
      member({ userId: "p3", seat: 3 }),
    ];
    expect(nextHost(room, "host")).toBe("p3");
  });

  it("falls back to a spectator, then to nobody", () => {
    expect(nextHost([member({ userId: "h" }), member({ userId: "w", seat: null })], "h")).toBe("w");
    expect(nextHost([member({ userId: "h" })], "h")).toBeNull();
  });
});

describe("nameSuggestion with emoji", () => {
  it("when the cut falls inside an emoji, then drops the whole emoji instead of half of it", () => {
    // 8 letters + a family emoji (11 UTF-16 units) = 19; with " 2" only 18 fit, so the emoji goes.
    const name = "Abcdefgh👩‍👩‍👧‍👦";
    expect(nameSuggestion(name, "c", [member({ userId: "a", nickname: name })])).toBe("Abcdefgh 2");
  });
});
