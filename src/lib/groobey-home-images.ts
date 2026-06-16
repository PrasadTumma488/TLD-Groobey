/** WebP path for a public PNG marketing asset. */
export function groobeyWebpFromPng(pngPath: string): string {
  return pngPath.replace(/\.png$/i, ".webp");
}

/** Responsive srcset for square category card images (320 / 640). */
export function groobeyCategoryImageSrcSet(pngPath: string): string {
  const stem = pngPath.replace(/\.png$/i, "");
  return `${stem}-320.webp 320w, ${stem}.webp 640w`;
}

export const GROOBEY_CATEGORY_IMAGE_SIZES =
  "(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw";

/** Responsive srcset for homepage hero banners. */
export function groobeySliderImageSrcSet(pngPath: string): string {
  const stem = pngPath.replace(/\.png$/i, "");
  return `${stem}-800.webp 800w, ${stem}.webp 1200w`;
}

export const GROOBEY_SLIDER_IMAGE_SIZES = "(min-width: 768px) 1200px, 100vw";

export type GroobeyMarketingImageProps = {
  /** Public PNG path — always used as fallback so images never break if WebP is missing. */
  pngSrc: string;
  alt: string;
  webpSrcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  className?: string;
  draggable?: boolean;
};
