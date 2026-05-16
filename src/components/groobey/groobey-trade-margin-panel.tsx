import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineFeedback } from "@/components/groobey/workspace-ui";
import { clampMarginPercent, tradeUnitFromRetail } from "@/lib/groobey-trade-margin";

export type MarginSaveResult = { error?: string; notice?: string };

export function TradeMarginPanel({
  title,
  description,
  marginPercent,
  sampleRetail = 100,
  saving,
  onSave,
}: {
  title: string;
  description: string;
  marginPercent: number;
  sampleRetail?: number;
  saving?: boolean;
  onSave: (nextPercent: number) => Promise<MarginSaveResult | void>;
}) {
  const [draft, setDraft] = useState(String(marginPercent));
  const [feedback, setFeedback] = useState<MarginSaveResult>({});

  useEffect(() => {
    setDraft(String(marginPercent));
  }, [marginPercent]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback({});
    const pct = clampMarginPercent(Number(draft || 0));
    try {
      const result = await onSave(pct);
      if (result?.error) {
        setFeedback({ error: result.error });
        return;
      }
      setFeedback({
        notice: result?.notice ?? `Groobey margin saved at ${pct}%.`,
      });
    } catch (e) {
      setFeedback({
        error: e instanceof Error ? e.message : "Could not save margin.",
      });
    }
  }

  const pct = clampMarginPercent(Number(draft || 0));
  const sampleTrade = tradeUnitFromRetail(sampleRetail, pct);

  return (
    <form
      className="rounded-xl border border-border bg-card/70 p-3"
      onSubmit={(e) => void handleSubmit(e)}
    >
      <p className="text-sm font-black">{title}</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{description}</p>
      <label className="mt-3 grid gap-1.5 text-sm font-semibold">
        Groobey margin (% off retail)
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (feedback.error || feedback.notice) setFeedback({});
          }}
          className="h-11 max-w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2 sm:max-w-[10rem]"
        />
      </label>
      <p className="mt-2 text-xs font-semibold text-muted-foreground">
        Example: ₹{sampleRetail} retail → ₹{sampleTrade} trade per unit ({pct}% margin). Each new
        sale loads the latest % from the server when submitted.
      </p>
      <Button type="submit" variant="groobey" className="mt-3 min-h-10 w-full rounded-xl sm:w-auto" disabled={saving}>
        {saving ? "Saving…" : "Save margin"}
      </Button>
      <InlineFeedback error={feedback.error} notice={feedback.notice} className="mt-3" />
    </form>
  );
}
