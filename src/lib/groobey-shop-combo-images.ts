import { supabase } from "@/integrations/supabase/client";

export const SHOP_COMBO_IMAGE_BUCKET = "shop-combo-images";
export const SHOP_COMBO_IMAGE_SIZE = 500;

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAX_BYTES = 3 * 1024 * 1024;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };
    img.src = url;
  });
}

/** Crop cover and export a square combo image (500×500) for consistent shop cards. */
export async function normalizeComboImageFile(
  file: File,
  size = SHOP_COMBO_IMAGE_SIZE,
): Promise<File> {
  const img = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare image.");

  const scale = Math.max(size / img.width, size / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Could not save image."))),
      "image/jpeg",
      0.9,
    );
  });

  const base = file.name.replace(/\.[^.]+$/, "") || "combo";
  return new File([blob], `${base}-${size}.jpg`, { type: "image/jpeg" });
}

export async function uploadShopComboImage(
  comboId: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext) && file.type !== "image/jpeg") {
    return { url: null, error: "Use JPG, PNG, WebP, or GIF." };
  }
  if (file.size > MAX_BYTES) {
    return { url: null, error: "Image must be under 3 MB." };
  }

  let uploadFile = file;
  if (typeof document !== "undefined") {
    try {
      uploadFile = await normalizeComboImageFile(file);
    } catch {
      uploadFile = file;
    }
  }

  const path = `${comboId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(SHOP_COMBO_IMAGE_BUCKET).upload(path, uploadFile, {
    cacheControl: "3600",
    upsert: true,
    contentType: "image/jpeg",
  });
  if (error) return { url: null, error: error.message };

  const { data } = supabase.storage.from(SHOP_COMBO_IMAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}
