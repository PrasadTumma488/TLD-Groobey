/** Resolve shop owner inbox from shop.created_by → profiles.email */

export type ShopWithOwner = {
  id: string;
  name?: string | null;
  created_by: string | null;
};

export function buildShopOwnerEmailByShopId(
  shops: ShopWithOwner[],
  profileEmailByUserId: Map<string, string>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const shop of shops) {
    const ownerId = shop.created_by?.trim();
    if (!ownerId) continue;
    const email = profileEmailByUserId.get(ownerId)?.trim();
    if (email) map.set(shop.id, email);
  }
  return map;
}

export function shopOwnerEmailForOrder(
  order: { shop_id?: string | null; work_from_shop_id?: string | null },
  emailByShopId: Map<string, string>,
): string {
  const shopId = order.shop_id?.trim() || order.work_from_shop_id?.trim();
  if (!shopId) return "";
  return emailByShopId.get(shopId) ?? "";
}
