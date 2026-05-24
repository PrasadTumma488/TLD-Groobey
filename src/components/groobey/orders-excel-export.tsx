import { CalendarDays, Download, FileSpreadsheet, IndianRupee } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  buildOrdersReportRows,
  exportOrdersExcel,
  ordersReportTotals,
  type OrdersReportSource,
} from "@/lib/groobey-excel-exports";

export function OrdersExcelExport({
  orders,
  periodLabel,
  workerName,
  shopNameById,
  statusLabels,
}: {
  orders: OrdersReportSource[];
  periodLabel: string;
  workerName: string;
  shopNameById: Map<string, string>;
  statusLabels: Record<string, string>;
}) {
  const reportRows = useMemo(
    () => buildOrdersReportRows(orders, shopNameById, statusLabels),
    [orders, shopNameById, statusLabels],
  );
  const totals = useMemo(() => ordersReportTotals(reportRows), [reportRows]);

  return (
    <div className="space-y-3 rounded-xl border-2 border-primary/25 bg-primary/5 p-3">
      <div className="flex flex-wrap items-start gap-2">
        <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">Orders Excel</p>
          <p className="mt-0.5 text-xs font-semibold leading-relaxed text-muted-foreground">
            Download <strong>Orders Excel</strong> for this list ({periodLabel}): 12-hour times,
            order amount, delivery charges, and total - same layout as Deliveries Excel.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryChip
          icon={CalendarDays}
          label="Orders in export"
          value={String(reportRows.length)}
        />
        <SummaryChip icon={IndianRupee} label="Order amount" value={`₹${totals.orderAmount}`} />
        <SummaryChip icon={IndianRupee} label="Delivery fees" value={`₹${totals.deliveryCharge}`} />
        <SummaryChip icon={IndianRupee} label="Grand total" value={`₹${totals.grandTotal}`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/80 px-3 py-2.5">
        <p className="text-xs font-semibold text-muted-foreground">
          {periodLabel} · {reportRows.length} order{reportRows.length === 1 ? "" : "s"} ready for
          Orders Excel
        </p>
        <Button
          type="button"
          variant="groobey"
          size="sm"
          className="shrink-0 rounded-xl text-xs font-bold"
          disabled={!reportRows.length}
          onClick={() => void exportOrdersExcel(reportRows, periodLabel, workerName)}
        >
          <Download className="size-3.5" aria-hidden />
          Orders Excel
        </Button>
      </div>

      {!reportRows.length ?
        <p className="text-xs font-semibold text-muted-foreground">
          No orders match the current filters. Change status or period, then download Orders Excel.
        </p>
      : null}
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
