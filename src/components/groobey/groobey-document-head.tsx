import { GROOBEY_FAVICON_VERSION } from "@/lib/groobey-favicon-version";
import {
  GROOBEY_GOOGLE_SITE_VERIFICATION,
  GROOBEY_SEO_DEFAULT_DESCRIPTION,
  GROOBEY_SEO_DEFAULT_TITLE,
  GROOBEY_SEO_SITE_NAME,
  groobeyAbsoluteUrl,
  groobeyGaMeasurementId,
  groobeyShareImageUrl,
} from "@/lib/groobey-seo";

const favicon = (file: string) => `${file}?v=${GROOBEY_FAVICON_VERSION}`;

/**
 * Primary HTML document head — visible in view-source like a classic index.html
 * (charset, SEO meta, Open Graph, Twitter, verification). Route HeadContent adds
 * page-specific title/description/canonical after this block.
 */
export function GroobeyDocumentHead() {
  const siteUrl = groobeyAbsoluteUrl("/");
  const ogImage = groobeyShareImageUrl();
  const gaId = groobeyGaMeasurementId();

  return (
    <>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />

      <title>{GROOBEY_SEO_DEFAULT_TITLE}</title>
      <meta name="description" content={GROOBEY_SEO_DEFAULT_DESCRIPTION} />
      <meta name="author" content={GROOBEY_SEO_SITE_NAME} />

      <meta name="google-site-verification" content={GROOBEY_GOOGLE_SITE_VERIFICATION} />

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap"
        rel="stylesheet"
        media="print"
        onLoad={(event) => {
          (event.currentTarget as HTMLLinkElement).media = "all";
        }}
      />
      <noscript>
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </noscript>

      <meta property="og:title" content={GROOBEY_SEO_DEFAULT_TITLE} />
      <meta property="og:description" content={GROOBEY_SEO_DEFAULT_DESCRIPTION} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={siteUrl} />
      <meta property="og:site_name" content={GROOBEY_SEO_SITE_NAME} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="en_IN" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={GROOBEY_SEO_DEFAULT_TITLE} />
      <meta name="twitter:description" content={GROOBEY_SEO_DEFAULT_DESCRIPTION} />
      <meta name="twitter:image" content={ogImage} />

      <link rel="canonical" href={siteUrl} />
      <link rel="sitemap" type="application/xml" href={groobeyAbsoluteUrl("/sitemap.xml")} />

      <link rel="icon" href={favicon("/favicon.ico")} sizes="any" />
      <link rel="icon" type="image/png" sizes="32x32" href={favicon("/favicon-32x32.png")} />
      <link rel="apple-touch-icon" href={favicon("/apple-touch-icon.png")} sizes="180x180" />
      <link rel="manifest" href="/manifest.webmanifest" />

      {gaId ?
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
            }}
          />
        </>
      : null}
    </>
  );
}
