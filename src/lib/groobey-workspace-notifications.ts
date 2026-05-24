import { useCallback, useEffect, useMemo, useRef, useState } from "react";



import { supabase } from "@/integrations/supabase/client";

import type { NotificationNavigateAction } from "@/lib/groobey-notification-nav";



export type WorkspaceNotificationKind = "order" | "attendance" | "assignment" | "sale";



export type WorkspaceNotification = {

  id: string;

  dedupeKey: string;

  title: string;

  body: string;

  createdAt: string;

  read: boolean;

  kind: WorkspaceNotificationKind;

  action?: NotificationNavigateAction;

};



export type WorkspaceNotificationMode =

  | "admin"

  | "delivery"

  | "order_taker"

  | "merchant"

  | null;



const STORAGE_PREFIX = "groobey-workspace-notifications";

const SYNC_SUFFIX = ":lastSyncAt";

const SYNC_INTERVAL_MS = 20_000;

const FIRST_SYNC_LOOKBACK_MS = 24 * 60 * 60 * 1000;



function storageKey(userId: string, mode: WorkspaceNotificationMode): string {

  return `${STORAGE_PREFIX}:${mode ?? "none"}:${userId}`;

}



function syncKey(userId: string, mode: WorkspaceNotificationMode): string {

  return `${storageKey(userId, mode)}${SYNC_SUFFIX}`;

}



function readStored(userId: string, mode: WorkspaceNotificationMode): WorkspaceNotification[] {

  if (typeof window === "undefined") return [];

  try {

    const raw = window.sessionStorage.getItem(storageKey(userId, mode));

    if (!raw) return [];

    const parsed = JSON.parse(raw) as WorkspaceNotification[];

    if (!Array.isArray(parsed)) return [];

    return parsed

      .map((row) => ({

        ...row,

        dedupeKey: row.dedupeKey || row.id,

        id: row.id || row.dedupeKey,

      }))

      .filter((row) => row.dedupeKey && row.title);

  } catch {

    return [];

  }

}



function writeStored(

  userId: string,

  mode: WorkspaceNotificationMode,

  items: WorkspaceNotification[],

): void {

  if (typeof window === "undefined") return;

  try {

    window.sessionStorage.setItem(storageKey(userId, mode), JSON.stringify(items.slice(0, 50)));

  } catch {

    // ignore quota errors

  }

}



function mergeNotice(

  list: WorkspaceNotification[],

  item: Omit<WorkspaceNotification, "id" | "read"> & { dedupeKey: string },

): WorkspaceNotification[] {

  const prior = list.find((row) => row.dedupeKey === item.dedupeKey);

  const next: WorkspaceNotification = {

    ...item,

    id: item.dedupeKey,

    read: prior?.read ?? false,

  };

  if (prior && prior.title === next.title && prior.body === next.body && prior.read) {

    return list;

  }

  return [next, ...list.filter((row) => row.dedupeKey !== item.dedupeKey)].slice(0, 50);

}



const orderStatusLabel: Record<string, string> = {

  pending: "Pending",

  confirmed: "Confirmed",

  packed: "Packed",

  out_for_delivery: "Out for delivery",

  delivered: "Delivered",

  cancelled: "Cancelled",

};



const saleStatusLabel: Record<string, string> = {

  pending: "pending review",

  verified: "verified",

  rejected: "rejected",

};



function saleBillLabel(row: { bill_number?: string | null; id?: string | null }): string {

  const bill = String(row.bill_number || "").trim();

  return bill || `sale ${String(row.id || "").slice(0, 8)}`;

}



function adminOrderAction(status: string): NotificationNavigateAction {

  return { dashboard: "admin", tab: "sales", focus: status === "delivered" ? "orders" : "sales" };

}



function orderTakerAction(

  orderId: string,

  billNumber: string | null | undefined,

): NotificationNavigateAction {

  return {

    dashboard: "orders",

    tab: "bill",

    focus: "bill",

    orderId,

    billNumber: billNumber?.trim() || undefined,

  };

}



function shouldNotifyOrderTaker(prevStatus: string, status: string): boolean {
  return status === "delivered" && prevStatus !== "delivered";
}



function readLastSyncAt(userId: string, mode: WorkspaceNotificationMode): string {

  if (typeof window === "undefined") return new Date(Date.now() - FIRST_SYNC_LOOKBACK_MS).toISOString();

  const stored = window.sessionStorage.getItem(syncKey(userId, mode));

  if (stored) return stored;

  return new Date(Date.now() - FIRST_SYNC_LOOKBACK_MS).toISOString();

}



function writeLastSyncAt(userId: string, mode: WorkspaceNotificationMode, iso: string): void {

  if (typeof window === "undefined") return;

  try {

    window.sessionStorage.setItem(syncKey(userId, mode), iso);

  } catch {

    // ignore

  }

}



export function useGroobeyWorkspaceNotifications(opts: {

  userId?: string;

  mode: WorkspaceNotificationMode;

  shopIds?: string[];

  onRefresh?: () => void;

}) {

  const { userId, mode, shopIds = [], onRefresh } = opts;

  const [items, setItems] = useState<WorkspaceNotification[]>([]);

  const shopIdSet = useMemo(() => new Set(shopIds), [shopIds]);

  const syncingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const updateItems = useCallback(
    (updater: (current: WorkspaceNotification[]) => WorkspaceNotification[]) => {
      if (!userId || !mode) return;
      setItems((current) => {
        if (!mountedRef.current) return current;
        const next = updater(current);
        writeStored(userId, mode, next);
        return next;
      });
    },
    [userId, mode],
  );



  useEffect(() => {

    if (!userId || !mode) {

      setItems([]);

      return;

    }

    setItems(readStored(userId, mode));

  }, [userId, mode]);



  useEffect(() => {

    if (!userId || !mode) return;

    const onStorage = (event: StorageEvent) => {

      if (event.key === storageKey(userId, mode)) {

        setItems(readStored(userId, mode));

      }

    };

    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);

  }, [userId, mode]);



  const ingest = useCallback(

    (item: Omit<WorkspaceNotification, "id" | "read"> & { dedupeKey: string }) => {

      if (!userId || !mode) return;

      updateItems((current) => mergeNotice(current, item));

    },

    [mode, updateItems, userId],

  );



  const syncFromDatabase = useCallback(async () => {

    if (!userId || !mode || syncingRef.current) return;

    syncingRef.current = true;

    const since = readLastSyncAt(userId, mode);

    const syncedAt = new Date().toISOString();



    try {

      if (mode === "admin") {

        const { data: orders } = await supabase

          .from("customer_orders")

          .select("id,bill_number,customer_name,status,updated_at,created_at")

          .gte("updated_at", since)

          .order("updated_at", { ascending: false })

          .limit(25);



        for (const row of orders ?? []) {

          const billNo = String(row.bill_number || "order").trim();

          const customer = String(row.customer_name || "Customer").trim();

          const status = String(row.status || "");

          const stamp = String(row.updated_at || row.created_at || syncedAt);

          if (status === "delivered") {
            ingest({
              dedupeKey: `order:${row.id}:${status}`,
              kind: "order",
              title: "Order delivered",
              body: `${billNo} · ${customer} - delivery completed.`,
              createdAt: stamp,
              action: adminOrderAction(status),
            });
            continue;
          }

          const createdAt = String(row.created_at || "");
          if (createdAt >= since && status === "pending") {
            ingest({
              dedupeKey: `order:new:${row.id}`,
              kind: "order",
              title: "New customer order",
              body: `${billNo} · ${customer} - assign delivery in Sales.`,
              createdAt: stamp,
              action: adminOrderAction(status),
            });
          }
        }



        const { data: sales } = await supabase

          .from("sales")

          .select("id,bill_number,status,updated_at,created_at")

          .gte("updated_at", since)

          .order("updated_at", { ascending: false })

          .limit(20);



        for (const row of sales ?? []) {

          const status = String(row.status || "");

          const stamp = String(row.updated_at || row.created_at || syncedAt);

          const bill = saleBillLabel(row);

          const title =

            status === "pending" ? "Sale pending review"

            : status === "verified" ? "Sale approved"

            : status === "rejected" ? "Sale rejected"

            : `Sale ${saleStatusLabel[status] ?? status}`;

          ingest({

            dedupeKey: `sale:${row.id}:${status}`,

            kind: "sale",

            title,

            body: `${bill} · ${saleStatusLabel[status] ?? status}`,

            createdAt: stamp,

            action: { dashboard: "admin", tab: "sales", focus: "sales" },

          });

        }



        const { data: attendance } = await supabase

          .from("attendance")

          .select("id,notes,created_at")

          .gte("created_at", since)

          .order("created_at", { ascending: false })

          .limit(15);



        for (const row of attendance ?? []) {

          const notes = String(row.notes || "");

          const isDeliveryLog = notes.includes("GROOBEY_DELIVERY_LOG_v1");

          ingest({

            dedupeKey: `attendance:${row.id}`,

            kind: "attendance",

            title: isDeliveryLog ? "Delivery logged" : "Staff work update",

            body: isDeliveryLog ?

              notes.match(/^bill_id=(.+)$/m)?.[1]?.trim() ?

                `Bill ${notes.match(/^bill_id=(.+)$/m)![1]} logged by delivery staff.`

              : "Delivery staff submitted a delivery log."

            : notes.slice(0, 120),

            createdAt: String(row.created_at || syncedAt),

            action: { dashboard: "admin", tab: "attendance", focus: "attendance" },

          });

        }

      }



      if (mode === "order_taker") {

        const { data: orders } = await supabase

          .from("customer_orders")

          .select("id,bill_number,customer_name,status,updated_at,created_at,created_by")

          .eq("created_by", userId)

          .gte("updated_at", since)

          .order("updated_at", { ascending: false })

          .limit(25);



        for (const row of orders ?? []) {

          const billNo = String(row.bill_number || "order").trim();

          const customer = String(row.customer_name || "Customer").trim();

          const status = String(row.status || "");

          if (status !== "delivered") continue;

          const stamp = String(row.updated_at || row.created_at || syncedAt);

          ingest({

            dedupeKey: `order:${row.id}:${status}`,

            kind: "order",

            title: "Order delivered",

            body: `${billNo} · ${customer} - delivery completed.`,

            createdAt: stamp,

            action: { dashboard: "orders", tab: "orders", orderId: String(row.id) },

          });

        }

      }



      if (mode === "merchant" && shopIdSet.size > 0) {

        const shopList = [...shopIdSet];

        const { data: orders } = await supabase

          .from("customer_orders")

          .select("id,bill_number,customer_name,status,updated_at,created_at,shop_id")

          .in("shop_id", shopList)

          .gte("updated_at", since)

          .order("updated_at", { ascending: false })

          .limit(25);



        for (const row of orders ?? []) {

          const billNo = String(row.bill_number || "order").trim();

          const customer = String(row.customer_name || "Customer").trim();

          const status = String(row.status || "");

          const stamp = String(row.updated_at || row.created_at || syncedAt);
          const createdAt = String(row.created_at || "");
          const isNew = createdAt >= since;

          ingest({
            dedupeKey: `order:${row.id}:${status}`,
            kind: "order",
            title: isNew ? "New order for your shop" : `Shop order ${orderStatusLabel[status] ?? status}`,

            body: `${billNo} · ${customer}`,

            createdAt: stamp,

            action: { dashboard: "shop-owner", focus: "orders" },

          });

        }



        const { data: sales } = await supabase

          .from("sales")

          .select("id,bill_number,status,updated_at,created_at,shop_id,verified_by")

          .in("shop_id", shopList)

          .gte("updated_at", since)

          .order("updated_at", { ascending: false })

          .limit(20);



        for (const row of sales ?? []) {

          const status = String(row.status || "");

          if (status !== "verified" && status !== "rejected") continue;

          if (String(row.verified_by || "") === userId) continue;

          const stamp = String(row.updated_at || row.created_at || syncedAt);

          const bill = saleBillLabel(row);

          const title =

            status === "verified" ? "Sale approved"

            : "Sale rejected";

          ingest({

            dedupeKey: `sale:${row.id}:${status}`,

            kind: "sale",

            title,

            body: `Your shop · ${bill} · ${saleStatusLabel[status] ?? status}`,

            createdAt: stamp,

            action: { dashboard: "shop-owner", focus: "sales" },

          });

        }

      }



      if (mode === "delivery") {
        const { data: assigned } = await supabase
          .from("customer_orders")
          .select("id,bill_number,customer_name,status,updated_at,created_at")
          .eq("assigned_delivery_user_id", userId)
          .in("status", ["confirmed", "packed", "out_for_delivery"])
          .gte("updated_at", since)
          .order("updated_at", { ascending: false })
          .limit(30);

        for (const row of assigned ?? []) {
          const billNo = String(row.bill_number || "order").trim();
          const customer = String(row.customer_name || "Customer").trim();
          const stamp = String(row.updated_at || row.created_at || syncedAt);
          ingest({
            dedupeKey: `assignment:${row.id}`,
            kind: "assignment",
            title: "New delivery assigned",
            body: `${billNo} · ${customer} - open your delivery queue.`,
            createdAt: stamp,
            action: { dashboard: "staff", focus: "queue", orderId: String(row.id) },
          });
        }
      }



      writeLastSyncAt(userId, mode, syncedAt);

    } finally {

      syncingRef.current = false;

    }

  }, [ingest, mode, shopIdSet, userId]);



  useEffect(() => {

    if (!userId || !mode) return;

    void syncFromDatabase();

    const timer = window.setInterval(() => void syncFromDatabase(), SYNC_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void syncFromDatabase();
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };

  }, [mode, syncFromDatabase, userId]);



  useEffect(() => {

    if (!userId || !mode) return;



    const orderChangeConfig =
      mode === "order_taker" ?
        {
          event: "*" as const,
          schema: "public" as const,
          table: "customer_orders" as const,
          filter: `created_by=eq.${userId}`,
        }
      : mode === "delivery" ?
        {
          event: "*" as const,
          schema: "public" as const,
          table: "customer_orders" as const,
          filter: `assigned_delivery_user_id=eq.${userId}`,
        }
      : { event: "*" as const, schema: "public" as const, table: "customer_orders" as const };

    const channel = supabase

      .channel(`groobey-notify-${mode}-${userId}`)

      .on(

        "postgres_changes",

        orderChangeConfig,

        (payload) => {

          const row = payload.new as Record<string, unknown> | null;

          const old = payload.old as Record<string, unknown> | null;

          if (!row?.id) return;



          const orderId = String(row.id);

          const billNo = String(row.bill_number || "order").trim();

          const customer = String(row.customer_name || "Customer").trim();

          const status = String(row.status || "");

          const assignedTo = row.assigned_delivery_user_id as string | null | undefined;

          const createdBy = row.created_by as string | null | undefined;

          const shopId = row.shop_id as string | null | undefined;

          const prevStatus = String(old?.status || "");

          const stamp = String(
            row.updated_at || row.created_at || new Date().toISOString(),
          );



          if (mode === "delivery") {

            if (assignedTo !== userId) return;

            if (payload.eventType === "UPDATE") {

              const prevAssigned = old?.assigned_delivery_user_id as string | null | undefined;

              if (prevAssigned !== userId && assignedTo === userId) {

                ingest({

                  dedupeKey: `assignment:${orderId}`,

                  kind: "assignment",

                  title: "New delivery assigned",

                  body: `${billNo} · ${customer} - open your delivery queue.`,

                  createdAt: stamp,

                  action: { dashboard: "staff", focus: "queue", orderId },

                });

                onRefresh?.();

                return;

              }

            }

            return;

          }



          if (mode === "order_taker") {

            if (createdBy && createdBy !== userId) return;

            if (payload.eventType === "UPDATE") {
              if (!shouldNotifyOrderTaker(prevStatus, status)) return;

              ingest({

                dedupeKey: `order:${orderId}:${status}`,

                kind: "order",

                title: "Order delivered",

                body: `${billNo} · ${customer} - delivery completed.`,

                createdAt: stamp,

                action: { dashboard: "orders", tab: "orders", orderId },

              });

              onRefresh?.();

            }

            return;

          }



          if (mode === "merchant") {

            if (!shopId || !shopIdSet.has(shopId)) return;

            if (payload.eventType === "INSERT") {

              ingest({

                dedupeKey: `order:${orderId}:${status}`,

                kind: "order",

                title: "New order for your shop",

                body: `${billNo} · ${customer}`,

                createdAt: stamp,

                action: { dashboard: "shop-owner", focus: "orders" },

              });

              onRefresh?.();

              return;

            }

            if (payload.eventType === "UPDATE" && prevStatus !== status) {

              ingest({

                dedupeKey: `order:${orderId}:${status}`,

                kind: "order",

                title: `Shop order ${orderStatusLabel[status] ?? status}`,

                body: `${billNo} · ${customer}`,

                createdAt: stamp,

                action: { dashboard: "shop-owner", focus: "orders" },

              });

              onRefresh?.();

            }

            return;

          }



          if (mode === "admin") {

            if (payload.eventType === "INSERT") {

              ingest({

                dedupeKey: `order:${orderId}:${status}`,

                kind: "order",

                title: "New customer order",

                body: `${billNo} · ${customer} - assign delivery in Sales.`,

                createdAt: stamp,

                action: adminOrderAction(status),

              });

              onRefresh?.();

              return;

            }

            if (
              payload.eventType === "UPDATE" &&
              status === "delivered" &&
              prevStatus !== "delivered"
            ) {
              ingest({

                dedupeKey: `order:${orderId}:${status}`,

                kind: "order",

                title: "Order delivered",

                body: `${billNo} · ${customer} - delivery completed.`,

                createdAt: stamp,

                action: adminOrderAction(status),

              });

              onRefresh?.();

            }

          }

        },

      )

      .on(

        "postgres_changes",

        { event: "INSERT", schema: "public", table: "attendance" },

        (payload) => {

          if (mode !== "admin") return;

          const row = payload.new as Record<string, unknown>;

          const notes = String(row.notes || "");

          const isDeliveryLog = notes.includes("GROOBEY_DELIVERY_LOG_v1");

          ingest({

            dedupeKey: `attendance:${String(row.id)}`,

            kind: "attendance",

            title: isDeliveryLog ? "Delivery logged" : "Staff work update",

            body: isDeliveryLog ?

              notes.match(/^bill_id=(.+)$/m)?.[1]?.trim() ?

                `Bill ${notes.match(/^bill_id=(.+)$/m)![1]} logged by delivery staff.`

              : "Delivery staff submitted a delivery log."

            : notes.slice(0, 120),

            createdAt: new Date().toISOString(),

            action: { dashboard: "admin", tab: "attendance", focus: "attendance" },

          });

          onRefresh?.();

        },

      )

      .on(

        "postgres_changes",

        { event: "*", schema: "public", table: "sales" },

        (payload) => {

          const row = payload.new as Record<string, unknown> | null;

          const old = payload.old as Record<string, unknown> | null;

          if (!row?.id) return;



          const saleId = String(row.id);

          const bill = saleBillLabel(row);

          const saleStatus = String(row.status || "");

          const prevStatus = String(old?.status || "");

          const shopId = row.shop_id as string | null | undefined;

          const verifiedBy = row.verified_by as string | null | undefined;

          const stamp = new Date().toISOString();



          if (payload.eventType === "UPDATE" && prevStatus === saleStatus) return;

          if (payload.eventType === "UPDATE" && verifiedBy === userId) return;



          const title =

            payload.eventType === "INSERT" ? "New sale submitted"

            : saleStatus === "verified" ? "Sale approved"

            : saleStatus === "rejected" ? "Sale rejected"

            : `Sale ${saleStatusLabel[saleStatus] ?? saleStatus}`;



          const body = `${bill} · ${saleStatusLabel[saleStatus] ?? saleStatus}`;



          if (mode === "admin") {

            if (payload.eventType === "INSERT" || prevStatus !== saleStatus) {

              ingest({

                dedupeKey: `sale:${saleId}:${saleStatus}`,

                kind: "sale",

                title,

                body,

                createdAt: stamp,

                action: { dashboard: "admin", tab: "sales", focus: "sales" },

              });

              onRefresh?.();

            }

            return;

          }



          if (mode === "delivery") {

            if (payload.eventType === "UPDATE" && prevStatus !== saleStatus) {

              ingest({

                dedupeKey: `sale:${saleId}:${saleStatus}`,

                kind: "sale",

                title,

                body: `${body} - shop owner or admin`,

                createdAt: stamp,

                action: { dashboard: "staff", focus: "queue" },

              });

              onRefresh?.();

            }

            return;

          }



          if (mode === "merchant") {

            if (!shopId || !shopIdSet.has(shopId)) return;

            if (payload.eventType === "UPDATE" && prevStatus !== saleStatus) {

              ingest({

                dedupeKey: `sale:${saleId}:${saleStatus}`,

                kind: "sale",

                title,

                body: `Your shop · ${body}`,

                createdAt: stamp,

                action: { dashboard: "shop-owner", focus: "sales" },

              });

              onRefresh?.();

            }

          }

        },

      )

      .subscribe();



    return () => {

      void supabase.removeChannel(channel);

    };

  }, [ingest, mode, onRefresh, shopIdSet, userId]);



  const unreadCount = useMemo(() => items.filter((row) => !row.read).length, [items]);



  const markAllRead = useCallback(() => {

    updateItems((current) => current.map((row) => ({ ...row, read: true })));

  }, [updateItems]);



  const markRead = useCallback(

    (id: string) => {

      updateItems((current) =>

        current.map((row) => (row.id === id || row.dedupeKey === id ? { ...row, read: true } : row)),

      );

    },

    [updateItems],

  );



  const clearAll = useCallback(() => {
    updateItems(() => []);
  }, [updateItems]);

  const addNotice = useCallback(
    (item: Omit<WorkspaceNotification, "id" | "read" | "dedupeKey"> & { dedupeKey?: string }) => {
      ingest({
        ...item,
        dedupeKey: item.dedupeKey ?? `manual:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      });
    },
    [ingest],
  );

  return { items, unreadCount, markAllRead, markRead, clearAll, syncFromDatabase, addNotice };
}
