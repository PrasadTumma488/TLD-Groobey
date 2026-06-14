import { defineEventHandler } from "h3";

import { groobeySitemapXml } from "@/lib/groobey-seo";

export default defineEventHandler((event) => {
  event.node.res.setHeader("Content-Type", "application/xml; charset=utf-8");
  event.node.res.setHeader("Cache-Control", "public, max-age=3600");
  return groobeySitemapXml();
});
