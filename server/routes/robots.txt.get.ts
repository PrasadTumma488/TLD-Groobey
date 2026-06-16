import { defineEventHandler, setResponseHeader } from "h3";

import { groobeyRobotsTxt } from "@/lib/groobey-seo";

export default defineEventHandler((event) => {
  setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=86400");
  return groobeyRobotsTxt();
});
