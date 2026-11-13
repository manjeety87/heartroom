"use client";

import { useState } from "react";
import { Button } from "@heartroom/ui";

/**
 * The code, big enough to read out, and the link. Phones testing over plain http have no Web Share
 * or clipboard API (not a secure context), so the last fallback is a selected field to copy by hand.
 */
export function ShareRoom({ code }: { readonly code: string }) {
  const [showLink, setShowLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const link = `${window.location.origin}/r/${code}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Join my Heartroom", text: `Room ${code}`, url: link });
        return;
      }
      if ("clipboard" in navigator && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        return;
      }
    } catch {
      // Cancelled or refused: fall through to the visible link.
    }
    setShowLink(true);
  };

  return (
    <div className="flex flex-col gap-3 rounded-card bg-sheet p-4 shadow-float">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-caption text-pencil">Room code</span>
          <span className="font-display text-h2 font-extrabold tracking-[0.2em] text-ink">
            {code}
          </span>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            void share();
          }}
        >
          {copied ? "Link copied" : "Invite friends"}
        </Button>
      </div>
      {showLink && (
        <label className="flex flex-col gap-1 text-small text-pencil">
          Copy this link and send it
          <input
            readOnly
            value={`${window.location.origin}/r/${code}`}
            ref={(input) => {
              input?.select();
            }}
            onFocus={(event) => {
              event.target.select();
            }}
            className="min-h-11 rounded-tile bg-well px-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-pen"
          />
        </label>
      )}
    </div>
  );
}
