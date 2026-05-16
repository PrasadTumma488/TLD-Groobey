import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { downloadGroceryCatalogTemplate } from "@/lib/groobey-excel-catalog";

export function GroobeyExcelCatalogUpload({
  onImport,
  importing = false,
}: {
  onImport: (file: File) => Promise<void>;
  importing?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file || importing) return;
    const lower = file.name.toLowerCase();
    if (
      !lower.endsWith(".xlsx") &&
      !lower.endsWith(".xls") &&
      !lower.endsWith(".csv")
    ) {
      return;
    }
    await onImport(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="grid gap-3 rounded-xl border-2 border-dashed border-primary/35 bg-card/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black text-foreground">
            <FileSpreadsheet className="size-4 shrink-0 text-primary" />
            Upload grocery list (Excel)
          </p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Columns: <strong>Item name</strong>, <strong>Pack size</strong>, <strong>Retail price</strong>, optional{" "}
            <strong>Default qty</strong>. Matching name + pack updates price and qty; new rows are added to the catalog.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-10 shrink-0 rounded-xl"
          onClick={() => downloadGroceryCatalogTemplate()}
        >
          <Download className="size-4" /> Template
        </Button>
      </div>
      <div
        role="button"
        tabIndex={0}
        className={`flex min-h-[7rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-6 text-center transition ${
          dragOver ? "border-primary bg-primary/10" : ""
        } ${importing ? "pointer-events-none opacity-60" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        {importing ? (
          <>
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-semibold">Importing…</p>
          </>
        ) : (
          <>
            <Upload className="size-8 text-primary" />
            <p className="text-sm font-bold text-foreground">Drop .xlsx / .csv here or click to choose</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="sr-only"
          disabled={importing}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
