import { CalendarDays, Download, FileSpreadsheet, IndianRupee } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  buildDeliveryReportForScope,
  monthReportTotals,
} from "@/lib/groobey-delivery-log";
import { exportDeliveryMonthExcel } from "@/lib/groobey-excel-exports";
import type { Database } from "@/integrations/supabase/types";

type AttendanceRow = Database["public"]["Tables"]["attendance"]["Row"];
type CustomerOrder = Database["public"]["Tables"]["customer_orders"]["Row"];

function formatReportDate(iso: string): string {
  const day = iso.slice(0, 10);
  if (day.length < 10) return iso;
  try {
    return new Date(`${day}T12:00:00`).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return day;
  }
}

export function DeliveryAttendanceReport({
  monthKey,
  monthLabel,
  workerName,
  attendanceRows,
  deliveredOrders,
  scope = "month",
  todayIso,
}: {
  monthKey: string;
  monthLabel: string;
  workerName: string;
  attendanceRows: AttendanceRow[];
  deliveredOrders: CustomerOrder[];
  scope?: "month" | "today";
  todayIso?: string;
}) {
  const today = todayIso ?? new Date().toISOString().slice(0, 10);

  const reportRows = useMemo(
    () =>
      buildDeliveryReportForScope(
        attendanceRows,
        deliveredOrders,
        scope === "today" ? { date: today } : { monthKey },
      ),
    [attendanceRows, deliveredOrders, monthKey, scope, today],
  );

  const totals = useMemo(() => monthReportTotals(reportRows), [reportRows]);
  const workingDays = useMemo(() => {
    const days = new Set(reportRows.map((r) => r.date?.slice(0, 10)).filter(Boolean));
    return days.size;
  }, [reportRows]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SummaryChip
          icon={CalendarDays}
          label={scope === "today" ? "Today" : "Days with deliveries"}
          value={scope === "today" ? String(reportRows.length) : String(workingDays)}
        />
        <SummaryChip
          icon={FileSpreadsheet}
          label="Bills delivered"
          value={String(reportRows.length)}
        />
        <SummaryChip
          icon={IndianRupee}
          label="Order amount"
          value={`₹${totals.orderAmount}`}
        />
        <SummaryChip
          icon={IndianRupee}
          label="Delivery fees"
          value={`₹${totals.deliveryCharge}`}
        />
        <SummaryChip
          icon={IndianRupee}
          label="Grand total"
          value={`₹${totals.grandTotal}`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
        <p className="text-xs font-semibold text-muted-foreground">
          {scope === "today" ?
            `${formatReportDate(today)} · ${reportRows.length} bill${reportRows.length === 1 ? "" : "s"}`
          : `${monthLabel} · ${reportRows.length} bills`}
          {" · "}
          Download Excel for the full list (12-hour times, order / delivery / total columns).
        </p>
        <Button
          type="button"
          variant="groobey"
          size="sm"
          className="shrink-0 rounded-xl text-xs font-bold"
          disabled={!reportRows.length}
          onClick={() => void exportDeliveryMonthExcel(reportRows, monthLabel, workerName)}
        >
          <Download className="size-3.5" />
          Export Excel
        </Button>
      </div>

      {!reportRows.length ?
        <p className="text-sm text-muted-foreground">
          No deliveries for this period. Mark orders delivered in the queue above, then export Excel
          here.
        </p>
      : <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Bill ID</th>
                <th className="px-3 py-2 text-right">Order</th>
                <th className="px-3 py-2 text-right">Delivery</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((row) => (
                <tr
                  key={`tbl-${row.billId}-${row.date}-${row.deliveredAt}`}
                  className="border-b border-border/60"
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    {row.date ? formatReportDate(row.date) : "-"}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2 font-semibold">
                    {row.customerName}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.deliveredAt}</td>
                  <td className="px-3 py-2 font-mono font-bold text-primary">{row.billId}</td>
                  <td className="px-3 py-2 text-right tabular-nums">₹{row.orderAmount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">₹{row.deliveryCharge}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold">₹{row.rowTotal}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-primary/30 bg-primary/5 font-bold">
                <td className="px-3 py-2" colSpan={4}>
                  Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums">₹{totals.orderAmount}</td>
                <td className="px-3 py-2 text-right tabular-nums">₹{totals.deliveryCharge}</td>
                <td className="px-3 py-2 text-right tabular-nums">₹{totals.grandTotal}</td>
              </tr>
            </tbody>
          </table>
        </div>
      }
    </div>
  );
}

function SummaryChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/70 px-2.5 py-2">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3 shrink-0" aria-hidden />
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-black tabular-nums">{value}</p>
    </div>
  );
}
