import { useServerFn } from "@tanstack/react-start";
import {
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  GroobeySheetDialogBody,
  GroobeySheetDialogContent,
  GroobeySheetDialogHeader,
} from "@/components/groobey/groobey-sheet-dialog";
import { ShopComboCard } from "@/components/groobey/groobey-shop-ui";
import { EmptyState } from "@/components/groobey/workspace-ui";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { isShopCombosSchemaError } from "@/lib/groobey-shop-combos-schema";
import { uploadShopComboImage } from "@/lib/groobey-shop-combo-images";
import { SHOP_COMBOS_CATEGORY_ID, shopBrowseCategories } from "@/lib/groobey-shop-browse";
import { ensureShopCombosSchema, getShopCombosSchemaStatus } from "@/lib/tldGroobey.functions";
import { cn } from "@/lib/utils";

type ShopCombo = Database["public"]["Tables"]["shop_combos"]["Row"];

const SUPABASE_SQL_EDITOR =
  "https://supabase.com/dashboard/project/idhgenxhczbgddihdlid/sql/new";

function sortCombos(rows: ShopCombo[]) {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/** Category picker for admin catalog (products + combos). */
export function AdminCatalogCategoryRail({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const categories = shopBrowseCategories();

  return (
    <div className="groobey-admin-catalog-rail groobey-scrollbar" role="tablist" aria-label="Catalog categories">
      <button
        type="button"
        role="tab"
        aria-selected={activeId === "all"}
        className={cn("groobey-admin-catalog-chip", activeId === "all" && "is-active")}
        onClick={() => onSelect("all")}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          role="tab"
          aria-selected={activeId === category.id}
          className={cn("groobey-admin-catalog-chip", activeId === category.id && "is-active")}
          onClick={() => onSelect(category.id)}
        >
          {category.image ?
            <img src={category.image} alt="" className="groobey-admin-catalog-chip-img" loading="lazy" />
          : null}
          {category.label}
        </button>
      ))}
    </div>
  );
}

export { SHOP_COMBOS_CATEGORY_ID };

export function AdminCombosPanel({
  sessionUserId,
  requesterToken,
  onNotice,
  onError,
  embedded = false,
}: {
  sessionUserId: string | undefined;
  requesterToken: string | undefined;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  embedded?: boolean;
}) {
  const fetchSchemaStatus = useServerFn(getShopCombosSchemaStatus);
  const runSchemaSetup = useServerFn(ensureShopCombosSchema);

  const [schemaReady, setSchemaReady] = useState<boolean | null>(null);
  const [schemaSetupBusy, setSchemaSetupBusy] = useState(false);
  const [combos, setCombos] = useState<ShopCombo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ShopCombo | null>(null);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSchemaStatus = useCallback(async () => {
    try {
      const status = await fetchSchemaStatus();
      setSchemaReady(Boolean(status?.ready));
      return Boolean(status?.ready);
    } catch {
      setSchemaReady(false);
      return false;
    }
  }, [fetchSchemaStatus]);

  const loadCombos = useCallback(async () => {
    const { data, error } = await supabase
      .from("shop_combos")
      .select("*")
      .order("sort_order")
      .order("name");

    if (error) {
      if (isShopCombosSchemaError(error.message)) {
        setSchemaReady(false);
        setCombos([]);
      } else {
        onError(error.message);
      }
      setLoading(false);
      return;
    }

    setSchemaReady(true);
    setCombos(sortCombos((data ?? []) as ShopCombo[]));
    setLoading(false);
  }, [onError]);

  const runSetup = useCallback(
    async (silent = false) => {
      if (!requesterToken) {
        if (!silent) onError("Sign in again, then retry combo setup.");
        return;
      }
      setSchemaSetupBusy(true);
      if (!silent) onError("");
      try {
        await runSchemaSetup({ data: { requesterToken } });
        setSchemaReady(true);
        setLoading(true);
        await loadCombos();
        if (!silent) onNotice("Combo packs are ready.");
      } catch (e) {
        setSchemaReady(false);
        if (!silent) {
          onError(
            e instanceof Error ?
              e.message
            : "Could not set up combo packs. Run npm run db:push once with your Supabase database password.",
          );
        }
      } finally {
        setSchemaSetupBusy(false);
      }
    },
    [requesterToken, runSchemaSetup, loadCombos, onError, onNotice],
  );

  useEffect(() => {
    void (async () => {
      const ready = await refreshSchemaStatus();
      if (ready) {
        await loadCombos();
        return;
      }
      setLoading(false);
      if (requesterToken) {
        await runSetup(true);
      }
    })();
  }, [refreshSchemaStatus, loadCombos, requesterToken, runSetup]);

  useEffect(() => {
    if (!schemaReady) return;
    const channel = supabase
      .channel("admin-shop-combos")
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_combos" }, () => {
        void loadCombos();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [schemaReady, loadCombos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return combos;
    return combos.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    );
  }, [combos, query]);

  const liveCount = useMemo(() => combos.filter((c) => c.is_active).length, [combos]);

  const previewCombo = useMemo(
    () => ({
      id: editing?.id ?? "preview",
      name: name.trim() || "Combo name",
      description: description.trim() || "What shoppers will see on the card.",
      price: Number(price || 0) || 0,
      imageUrl: imagePreview,
    }),
    [name, description, price, imagePreview, editing?.id],
  );

  function resetForm() {
    setEditing(null);
    setName("");
    setDescription("");
    setPrice("");
    setSortOrder(String(combos.length));
    setIsActive(true);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openCreateSheet() {
    resetForm();
    setSheetOpen(true);
    onError("");
  }

  function openEditSheet(combo: ShopCombo) {
    setEditing(combo);
    setName(combo.name);
    setDescription(combo.description);
    setPrice(String(combo.price));
    setSortOrder(String(combo.sort_order));
    setIsActive(combo.is_active);
    setImageFile(null);
    setImagePreview(combo.image_url);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSheetOpen(true);
    onError("");
  }

  function closeSheet() {
    setSheetOpen(false);
    resetForm();
  }

  function onPickImage(file: File | null) {
    setImageFile(file);
    if (!file) {
      setImagePreview(editing?.image_url ?? null);
      return;
    }
    setImagePreview(URL.createObjectURL(file));
  }

  async function persistCombo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      onError("Combo name is required.");
      return;
    }
    const parsedPrice = Number(price || 0);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      onError("Enter a valid price.");
      return;
    }

    setSaving(true);
    onError("");

    const payload = {
      name: trimmedName,
      description: description.trim(),
      price: parsedPrice,
      sort_order: Math.max(0, Math.round(Number(sortOrder || 0))),
      is_active: isActive,
      created_by: sessionUserId ?? null,
    };

    let comboId = editing?.id;

    if (editing) {
      const { error } = await supabase.from("shop_combos").update(payload).eq("id", editing.id);
      if (error) {
        setSaving(false);
        onError(error.message);
        return;
      }
    } else {
      const { data, error } = await supabase.from("shop_combos").insert(payload).select("*").single();
      if (error || !data) {
        setSaving(false);
        onError(error?.message ?? "Could not create combo.");
        return;
      }
      comboId = data.id;
    }

    if (imageFile && comboId) {
      const { url, error: uploadError } = await uploadShopComboImage(comboId, imageFile);
      if (uploadError) {
        setSaving(false);
        onError(uploadError);
        return;
      }
      const { error: imageErr } = await supabase
        .from("shop_combos")
        .update({ image_url: url })
        .eq("id", comboId);
      if (imageErr) {
        setSaving(false);
        onError(imageErr.message);
        return;
      }
    }

    await loadCombos();
    setSaving(false);
    onNotice(editing ? "Combo saved — shoppers see it in the shop now." : "Combo added to the shop.");
    closeSheet();
  }

  async function deleteCombo(combo: ShopCombo) {
    if (!window.confirm(`Remove “${combo.name}” from the shop?`)) return;
    const { error } = await supabase.from("shop_combos").delete().eq("id", combo.id);
    if (error) {
      onError(error.message);
      return;
    }
    if (editing?.id === combo.id) closeSheet();
    onNotice("Combo removed.");
    await loadCombos();
  }

  async function toggleVisible(combo: ShopCombo) {
    const { error } = await supabase
      .from("shop_combos")
      .update({ is_active: !combo.is_active })
      .eq("id", combo.id);
    if (error) {
      onError(error.message);
      return;
    }
    await loadCombos();
  }

  if (schemaReady === false) {
    return (
      <div className="groobey-admin-combos-setup space-y-4">
        <div className="groobey-admin-combos-setup-card">
          <div className="groobey-admin-combos-setup-icon" aria-hidden>
            <Wrench className="size-7 text-primary" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h3 className="text-base font-black text-foreground">Set up combo packs first</h3>
            <p className="text-sm font-semibold leading-relaxed text-muted-foreground">
              The shop needs a one-time database table (<code className="text-xs">shop_combos</code>
              ). After setup, you can add photos and combo cards that appear under{" "}
              <strong>Combos</strong> in the customer shop.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="groobey"
                className="min-h-11 rounded-xl"
                disabled={schemaSetupBusy || !requesterToken}
                onClick={() => void runSetup(false)}
              >
                {schemaSetupBusy ?
                  <Loader2 className="size-4 animate-spin" />
                : <Sparkles className="size-4" />}
                Set up combo packs
              </Button>
              <Button type="button" variant="outline" className="min-h-11 rounded-xl" asChild>
                <a href={SUPABASE_SQL_EDITOR} target="_blank" rel="noreferrer">
                  Open Supabase SQL Editor
                </a>
              </Button>
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground">
              If the button fails, run{" "}
              <code className="rounded bg-muted px-1 py-0.5">npm run env:db-password -- YOUR_PASSWORD</code>{" "}
              then <code className="rounded bg-muted px-1 py-0.5">npm run db:push</code>, or paste migration{" "}
              <code className="rounded bg-muted px-1 py-0.5">20260608160000_shop_combos.sql</code> in SQL Editor.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("groobey-admin-combos space-y-4", embedded && "groobey-admin-combos--embedded")}>
      {!embedded ?
        <div className="groobey-admin-combos-hero">
          <div className="min-w-0">
            <p className="text-sm font-black text-foreground">Combo packs for the shop</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">
              Tap a card to edit. Photos update live for shoppers in the Combos category.
            </p>
          </div>
          <div className="groobey-admin-combos-stats">
            <span className="groobey-admin-combos-stat">
              <strong>{liveCount}</strong> live
            </span>
            <span className="groobey-admin-combos-stat">
              <strong>{combos.length}</strong> total
            </span>
          </div>
        </div>
      : <div className="groobey-admin-combos-embedded-head">
          <p className="text-xs font-semibold text-muted-foreground">
            <strong className="text-foreground">{liveCount}</strong> live ·{" "}
            <strong className="text-foreground">{combos.length}</strong> total combo packs
          </p>
        </div>
      }

      <div className="groobey-admin-combos-toolbar">
        <label className="groobey-admin-combos-search">
          <Search className="size-4 shrink-0 opacity-50" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search combos…"
            autoComplete="off"
          />
        </label>
        <Button
          type="button"
          variant="groobey"
          className="groobey-admin-combos-add-btn min-h-11 shrink-0 rounded-xl"
          onClick={openCreateSheet}
        >
          <Plus className="size-4" />
          Add combo
        </Button>
      </div>

      {loading ?
        <div className="groobey-admin-combos-gallery" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="groobey-admin-combos-gallery-card groobey-admin-combos-gallery-card--skeleton" />
          ))}
        </div>
      : filtered.length === 0 ?
        <EmptyState
          icon={Sparkles}
          title={query.trim() ? "No matching combos" : "No combos yet"}
          text={
            query.trim() ?
              "Try another search or add a new combo pack."
            : "Add your first combo — shoppers will see it as a photo card under Combos."
          }
        />
      : <div className="groobey-admin-combos-gallery groobey-scrollbar">
          {filtered.map((combo) => (
            <article
              key={combo.id}
              className={cn(
                "groobey-admin-combos-gallery-card",
                !combo.is_active && "groobey-admin-combos-gallery-card--hidden",
              )}
            >
              <button
                type="button"
                className="groobey-admin-combos-gallery-hit"
                onClick={() => openEditSheet(combo)}
              >
                <div className="groobey-admin-combos-gallery-media">
                  {combo.image_url ?
                    <img src={combo.image_url} alt="" className="groobey-admin-combos-gallery-img" />
                  : <span className="groobey-admin-combos-gallery-placeholder">
                      <ImagePlus className="size-9 opacity-35" aria-hidden />
                      <span>Add photo</span>
                    </span>
                  }
                  <span className="groobey-admin-combos-gallery-price">₹{combo.price}</span>
                  {!combo.is_active ?
                    <span className="groobey-admin-combos-gallery-badge">Hidden</span>
                  : null}
                </div>
                <div className="groobey-admin-combos-gallery-body">
                  <p className="groobey-admin-combos-gallery-name">{combo.name}</p>
                  {combo.description ?
                    <p className="groobey-admin-combos-gallery-desc">{combo.description}</p>
                  : null}
                </div>
              </button>
              <div className="groobey-admin-combos-gallery-actions">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 flex-1 rounded-lg text-xs font-bold"
                  onClick={() => openEditSheet(combo)}
                >
                  <Pencil className="size-3.5" /> Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-lg px-3 text-xs font-bold"
                  onClick={() => void toggleVisible(combo)}
                  aria-label={combo.is_active ? "Hide combo" : "Show combo"}
                >
                  {combo.is_active ?
                    <EyeOff className="size-3.5" />
                  : <Eye className="size-3.5" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-lg px-3 text-xs font-bold text-destructive"
                  onClick={() => void deleteCombo(combo)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      }

      <Dialog open={sheetOpen} onOpenChange={(open) => (open ? setSheetOpen(true) : closeSheet())}>
        <GroobeySheetDialogContent className="groobey-admin-combo-sheet">
          <GroobeySheetDialogHeader
            title={editing ? "Edit combo pack" : "New combo pack"}
            description="This is how the card appears in the customer shop Combos category."
            onClose={closeSheet}
          />
          <div className="groobey-admin-combo-mobile-preview" aria-label="Shop preview">
            <div className="groobey-admin-combo-mobile-preview-media">
              {previewCombo.imageUrl ?
                <img src={previewCombo.imageUrl} alt="" className="groobey-admin-combo-mobile-preview-img" />
              : <ImagePlus className="size-6 opacity-35" aria-hidden />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="groobey-admin-combo-mobile-preview-name">{previewCombo.name}</p>
              <p className="groobey-admin-combo-mobile-preview-price">₹{previewCombo.price}</p>
            </div>
          </div>
          <GroobeySheetDialogBody>
            <div className="groobey-admin-combo-sheet-layout">
              <form id="groobey-admin-combo-form" className="groobey-admin-combo-sheet-form" onSubmit={persistCombo}>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Combo name
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
                    placeholder="Weekend veggie pack"
                  />
                </label>

                <label className="grid gap-1.5 text-sm font-semibold">
                  What&apos;s inside
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    className="rounded-xl border border-input bg-card px-3 py-2 text-sm font-semibold outline-none ring-ring focus:ring-2"
                    placeholder={"Rice 5kg\nToor dal 1kg\nSunflower oil 1L\n(one item per line)"}
                  />
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    One item per line — shoppers see these as bullet points in the combo popup.
                  </span>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-semibold">
                    Price (₹)
                    <input
                      type="number"
                      required
                      min={0}
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="h-11 rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold">
                    Sort order
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                      className="h-11 rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
                    />
                  </label>
                </div>

                <label className="groobey-admin-combo-visible-toggle">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span>Show in customer shop</span>
                </label>

                <div className="groobey-admin-combo-upload">
                  <p className="text-sm font-semibold">Combo photo</p>
                  <label className="groobey-admin-combo-upload-trigger">
                    <div className="groobey-admin-combo-upload-box">
                      {imagePreview ?
                        <img src={imagePreview} alt="" className="groobey-admin-combo-upload-preview" />
                      : <span className="groobey-admin-combo-upload-empty">
                          <ImagePlus className="size-10 opacity-40" aria-hidden />
                          <span>Tap to upload photo</span>
                        </span>
                      }
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="groobey-admin-combo-upload-input"
                      onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    Square photo · saved as 500×500 · JPG/PNG/WebP up to 3 MB
                  </p>
                </div>

                <div className="groobey-admin-combo-form-actions flex-wrap gap-2 pt-1">
                  <Button type="submit" variant="groobey" className="min-h-11 rounded-xl" disabled={saving}>
                    {saving ?
                      <Loader2 className="size-4 animate-spin" />
                    : editing ?
                      <Pencil className="size-4" />
                    : <Plus className="size-4" />}
                    {editing ? "Save combo" : "Add combo"}
                  </Button>
                  <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={closeSheet}>
                    Cancel
                  </Button>
                </div>
              </form>

              <div className="groobey-admin-combo-preview-panel hidden sm:block">
                <p className="groobey-admin-combo-preview-label">Shop preview</p>
                <ShopComboCard
                  combo={previewCombo}
                  quantity={0}
                  onAdd={() => undefined}
                  onUpdateQty={() => undefined}
                />
              </div>
            </div>
          </GroobeySheetDialogBody>
          <div className="groobey-sheet-dialog-footer groobey-admin-combo-sheet-footer">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full rounded-xl text-sm font-bold"
              onClick={closeSheet}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="groobey-admin-combo-form"
              variant="groobey"
              className="min-h-11 w-full rounded-xl text-sm font-bold"
              disabled={saving}
            >
              {saving ?
                <Loader2 className="size-4 animate-spin" />
              : editing ?
                "Save combo"
              : "Add combo"}
            </Button>
          </div>
        </GroobeySheetDialogContent>
      </Dialog>
    </div>
  );
}
