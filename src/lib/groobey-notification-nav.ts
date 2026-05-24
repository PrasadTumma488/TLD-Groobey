export type NotificationNavigateAction = {
  dashboard: "admin" | "orders" | "staff" | "shop-owner";
  tab?: string;
  focus?: "queue" | "bill" | "attendance" | "sales" | "orders";
  orderId?: string;
  billNumber?: string;
};

type NavigateHandler = (action: NotificationNavigateAction) => void;

let handler: NavigateHandler | null = null;

export function setGroobeyNotificationNavigate(fn: NavigateHandler | null): void {
  handler = fn;
}

export function navigateFromNotification(action: NotificationNavigateAction): void {
  handler?.(action);
}
