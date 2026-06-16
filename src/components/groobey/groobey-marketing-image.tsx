import {
  groobeyWebpFromPng,
  type GroobeyMarketingImageProps,
} from "@/lib/groobey-home-images";

/** WebP when available; PNG fallback guarantees images always render. */
export function GroobeyMarketingImage({
  pngSrc,
  alt,
  webpSrcSet,
  sizes,
  width,
  height,
  loading = "lazy",
  fetchPriority = "auto",
  className,
  draggable,
}: GroobeyMarketingImageProps) {
  const webpSrc = groobeyWebpFromPng(pngSrc);

  return (
    <picture>
      <source
        type="image/webp"
        srcSet={webpSrcSet ?? webpSrc}
        sizes={webpSrcSet ? sizes : undefined}
      />
      <img
        src={pngSrc}
        alt={alt}
        className={className}
        width={width}
        height={height}
        sizes={sizes}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        draggable={draggable}
      />
    </picture>
  );
}
