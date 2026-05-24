import { CheckCircle2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { GroobeySelect } from "@/components/groobey/groobey-select-field";
import { GroobeyWorkspaceFormCard } from "@/components/groobey/workspace-ui";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import {
  DELIVERY_MINUTE_SLOTS,
  deliveryHourOptions,
} from "@/lib/groobey-delivery-order-fields";

type CustomerOrder = Database["public"]["Tables"]["customer_orders"]["Row"];

export function DeliveryBillLogForm({
  orders,
  resetNonce = 0,
  submitting = false,
  onSubmit,
}: {
  orders: CustomerOrder[];
  resetNonce?: number;
  submitting?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [orderId, setOrderId] = useState("");
  const [deliveryHour, setDeliveryHour] = useState("");
  const [deliveryMinute, setDeliveryMinute] =
    useState<(typeof DELIVERY_MINUTE_SLOTS)[number]>("00");

  const billOptions = useMemo(() => {
    const active = orders.filter((o) =>
      ["confirmed", "packed", "out_for_delivery"].includes(o.status),
    );
    return [
      {
        value: "__choose_bill__",
        label:
          active.length ?
            "Choose Bill ID to deliver"
          : "No assigned orders - ask admin to assign",
      },
      ...active.map((o) => ({
        value: o.id,
        label: `${o.bill_number || "No ID"} · ${o.customer_name} · ₹${Math.round(Number(o.total_amount || 0))}`,
      })),
    ];
  }, [orders]);

  const selected = useMemo(
    () => orders.find((o) => o.id === orderId) ?? null,
    [orderId, orders],
  );

  useEffect(() => {
    setOrderId("");
    setDeliveryHour("");
    setDeliveryMinute("00");
  }, [resetNonce]);

  const hourOptions = useMemo(() => deliveryHourOptions(), []);
  const deliveredAtValue =
    deliveryHour !== "" ?
      `${String(Number(deliveryHour)).padStart(2, "0")}:${deliveryMinute}`
    : "";

  return (
    <form className="groobey-workspace-form space-y-3" onSubmit={onSubmit}>
      <input type="hidden" name="orderId" value={orderId} readOnly />
      <input type="hidden" name="deliveredAt" value={deliveredAtValue} readOnly />

      <p className="text-center text-xs font-semibold text-muted-foreground sm:text-left">
        Choose a Bill ID from your assigned orders, set delivery time, then submit. Customer bill
        only - adds to your monthly report and marks delivered.
      </p>

      <GroobeyWorkspaceFormCard>
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-semibold text-foreground">
            Bill ID to deliver
            <GroobeySelect
              value={orderId || "__choose_bill__"}
              onValueChange={(v) => setOrderId(v === "__choose_bill__" ? "" : v)}
              options={billOptions}
            />
          </label>

          {selected ?
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-2">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-black text-primary">
                    {selected.bill_number || "-"}
                  </p>
                  <p className="mt-0.5 text-sm font-bold">{selected.customer_name}</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="font-semibold text-muted-foreground">Order amount</dt>
                  <dd className="mt-0.5 text-base font-black tabular-nums">
                    ₹{Math.round(Number(selected.total_amount || 0))}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted-foreground">Delivery charge</dt>
                  <dd className="mt-0.5 text-base font-black tabular-nums">
                    ₹{Math.round(Number(selected.delivery_charge || 0))}
                  </dd>
                </div>
              </dl>
            </div>
          : null}

          <div className="border-t border-border/60 pt-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <CheckCircle2 className="size-4 text-primary" aria-hidden />
              Delivered time
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-foreground">
                Hour
                <GroobeySelect
                  value={deliveryHour || "__choose_hour__"}
                  onValueChange={(v) => setDeliveryHour(v === "__choose_hour__" ? "" : v)}
                  options={[{ value: "__choose_hour__", label: "Choose hour" }, ...hourOptions]}
                />
              </label>
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-foreground">
                Minutes
                <GroobeySelect
                  value={deliveryMinute}
                  onValueChange={(v) =>
                    setDeliveryMinute(v as (typeof DELIVERY_MINUTE_SLOTS)[number])
                  }
                  options={DELIVERY_MINUTE_SLOTS.map((m) => ({ value: m, label: `:${m}` }))}
                />
              </label>
            </div>
          </div>

          <Button
            type="submit"
            variant="groobey"
            className="min-h-11 w-full rounded-xl"
            disabled={submitting || !orderId || deliveryHour === ""}
          >
            <CheckCircle2 className="size-4 shrink-0" />
            {submitting ? "Saving…" : "Log delivery & mark delivered"}
          </Button>
        </div>
      </GroobeyWorkspaceFormCard>
    </form>
  );
}
