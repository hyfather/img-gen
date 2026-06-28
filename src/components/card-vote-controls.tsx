"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState, useTransition } from "react";
import type { CardVoteSummary, VoteChoice } from "@/lib/card-votes";

type CardVoteControlsProps = {
  cardId: string;
  initialSummary: CardVoteSummary;
};

export function CardVoteControls({ cardId, initialSummary }: CardVoteControlsProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function vote(choice: VoteChoice) {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/card-votes", {
        body: JSON.stringify({ cardId, vote: choice }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        summary?: CardVoteSummary;
      } | null;

      if (!response.ok || !result?.summary) {
        setError(result?.error || "Vote could not be saved.");
        return;
      }

      setSummary(result.summary);
    });
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <button
          aria-pressed={summary.userVote === "up"}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-black transition disabled:opacity-50 ${
            summary.userVote === "up"
              ? "bg-lime-300 text-slate-950"
              : "bg-slate-100 text-slate-700 hover:bg-lime-100"
          }`}
          disabled={isPending}
          type="button"
          onClick={() => vote("up")}
        >
          <ThumbsUp aria-hidden="true" size={14} />
          {summary.upvotes}
        </button>
        <button
          aria-pressed={summary.userVote === "down"}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-black transition disabled:opacity-50 ${
            summary.userVote === "down"
              ? "bg-rose-200 text-rose-950"
              : "bg-slate-100 text-slate-700 hover:bg-rose-50"
          }`}
          disabled={isPending}
          type="button"
          onClick={() => vote("down")}
        >
          <ThumbsDown aria-hidden="true" size={14} />
          {summary.downvotes}
        </button>
        <span className="ml-auto rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white">
          Score {summary.score}
        </span>
      </div>
      {error ? <p className="text-[11px] font-bold text-rose-600">{error}</p> : null}
    </div>
  );
}
