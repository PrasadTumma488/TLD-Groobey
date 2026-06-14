import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { type MouseEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { navigateFromNotification } from "@/lib/groobey-notification-nav";
import type { WorkspaceNotification } from "@/lib/groobey-workspace-notifications";
import { cn } from "@/lib/utils";

const kindDotClass: Record<string, string> = {
  order: "bg-sky-500",
  assignment: "bg-violet-500",
  attendance: "bg-amber-500",
  sale: "bg-emerald-500",
};

function NotificationRow({
  item,
  onSelect,
}: {
  item: WorkspaceNotification;
  onSelect: (item: WorkspaceNotification) => void;
}) {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        className={cn(
          "flex w-full gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted/60",
          !item.read && "bg-primary/8 ring-1 ring-primary/15",
        )}
        onClick={() => onSelect(item)}
      >
        <span
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            kindDotClass[item.kind] ?? "bg-muted-foreground",
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug">{item.title}</p>
          <p className="mt-0.5 text-xs font-semibold leading-snug text-muted-foreground">
            {item.body}
          </p>
          <p className="mt-1 text-[10px] font-medium text-muted-foreground/80">
            {item.createdAt.slice(0, 16).replace("T", " ")}
          </p>
        </span>
      </button>
    </li>
  );
}

export function GroobeyNotificationBell({
  items,
  unreadCount,
  onMarkAllRead,
  onMarkRead,
  onClearAll,
  onNavigate,
  className,
  compact = false,
}: {
  items: WorkspaceNotification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkRead?: (id: string) => void;
  onClearAll: () => void;
  onNavigate?: (item: WorkspaceNotification) => void;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const { unread, read } = useMemo(() => {
    const unreadRows: WorkspaceNotification[] = [];
    const readRows: WorkspaceNotification[] = [];
    for (const item of items) {
      if (item.read) readRows.push(item);
      else unreadRows.push(item);
    }
    return { unread: unreadRows, read: readRows };
  }, [items]);

  function handleItemClick(item: WorkspaceNotification) {
    onMarkRead?.(item.id);
    if (item.action) {
      if (onNavigate) onNavigate(item);
      else navigateFromNotification(item.action);
    }
    setOpen(false);
  }

  function handleMarkAllRead(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onMarkAllRead();
  }

  function handleClearAll(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onClearAll();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "relative shrink-0 rounded-full border border-border bg-card shadow-sm",
            compact ? "size-8" : "size-10 border-2",
            className,
          )}
          aria-label={
            unreadCount > 0 ?
              `${unreadCount} unread notifications`
            : "Open notifications menu"
          }
        >
          <Bell className={cn("shrink-0 text-foreground", compact ? "size-3.5" : "size-4")} aria-hidden />
          {unreadCount > 0 ?
            <span
              className={cn(
                "absolute flex items-center justify-center rounded-full bg-destructive font-black leading-none text-destructive-foreground ring-2 ring-card",
                compact ?
                  "-right-0.5 -top-0.5 min-h-4 min-w-4 px-0.5 text-[9px]"
                : "-right-0.5 -top-0.5 min-h-[1.125rem] min-w-[1.125rem] px-1 text-[10px]",
              )}
              aria-hidden
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(100vw-1.5rem,20rem)] rounded-2xl border-2 border-border bg-card p-0 shadow-lg"
      >
        <div className="rounded-t-2xl border-b border-border bg-muted/40 px-3 py-2.5">
          <p className="text-sm font-black">Alerts</p>
          <p className="text-[11px] font-semibold text-muted-foreground">
            {unreadCount > 0 ?
              `${unreadCount} unread · tap to open`
            : "All caught up"}
          </p>
        </div>
        <div className="max-h-[min(60dvh,18rem)] overflow-y-auto overscroll-contain p-1.5">
          {items.length === 0 ?
            <p className="px-2 py-8 text-center text-sm font-semibold text-muted-foreground">
              No alerts yet
            </p>
          : <div className="space-y-2">
              {unread.length ?
                <div>
                  <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Unread
                  </p>
                  <ul className="space-y-1" role="menu">
                    {unread.map((item) => (
                      <NotificationRow key={item.id} item={item} onSelect={handleItemClick} />
                    ))}
                  </ul>
                </div>
              : null}
              {read.length ?
                <div>
                  <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Earlier
                  </p>
                  <ul className="space-y-1 opacity-80" role="menu">
                    {read.map((item) => (
                      <NotificationRow key={item.id} item={item} onSelect={handleItemClick} />
                    ))}
                  </ul>
                </div>
              : null}
            </div>
          }
        </div>
        {items.length ?
          <div className="flex gap-2 border-t border-border p-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 flex-1 rounded-xl text-xs font-bold"
              disabled={unreadCount === 0}
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Mark all read
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 flex-1 rounded-xl text-xs font-bold"
              onClick={handleClearAll}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Clear
            </Button>
          </div>
        : null}
      </PopoverContent>
    </Popover>
  );
}
