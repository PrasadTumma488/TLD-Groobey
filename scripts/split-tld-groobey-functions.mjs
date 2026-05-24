import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const handlersPath = path.join(root, "src/lib/tldGroobey.handlers.server.ts");
const clientPath = path.join(root, "src/lib/tldGroobey.functions.ts");

let handlers = fs.readFileSync(handlersPath, "utf8");
handlers = handlers.replace(
  /import \{ createServerFn \} from "@tanstack\/react-start";\r?\n/,
  "",
);

const exports = [
  { name: "createStaffAccount", method: "POST", schema: "createAccountSchema" },
  { name: "getSetupStatus", method: "GET", schema: null },
  { name: "syncGroobeyCodes", method: "POST", schema: "requesterTokenSchema" },
  { name: "ensureMyGroobeyCode", method: "POST", schema: "requesterTokenSchema" },
  { name: "saveShopDetails", method: "POST", schema: "shopDetailsSchema" },
  { name: "listStaffAccounts", method: "POST", schema: "requesterTokenSchema" },
  { name: "setStaffAccountActive", method: "POST", schema: "setStaffActiveSchema" },
  { name: "updateStaffAccount", method: "POST", schema: "updateStaffSchema" },
  { name: "updateMyProfile", method: "POST", schema: "updateMyProfileSchema" },
  { name: "deleteStaffAccount", method: "POST", schema: "deleteStaffSchema" },
  { name: "sendCustomerBillEmail", method: "POST", schema: "sendCustomerBillSchema" },
  { name: "getBillEmailDeliveryInfo", method: "POST", schema: "requesterTokenSchema" },
  { name: "sendWorkConfirmationEmail", method: "POST", schema: "sendWorkConfirmationSchema" },
  { name: "sendPasswordResetEmail", method: "POST", schema: "sendPasswordResetSchema" },
];

function findHandlerBody(source, exportName) {
  const startRe = new RegExp(`export const ${exportName} = createServerFn`);
  const start = source.search(startRe);
  if (start < 0) throw new Error(`export not found: ${exportName}`);
  const handlerIdx = source.indexOf(".handler(", start);
  if (handlerIdx < 0) throw new Error(`handler not found: ${exportName}`);
  const asyncIdx = source.indexOf("async", handlerIdx);
  const arrowIdx = source.indexOf("=>", asyncIdx);
  if (arrowIdx < 0) throw new Error(`arrow not found: ${exportName}`);

  let cursor = arrowIdx + 2;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor++;

  const open = source[cursor];
  if (open !== "{" && open !== "(") throw new Error(`unexpected opener for ${exportName}: ${open}`);

  let depth = 0;
  const openCh = open;
  const closeCh = open === "{" ? "}" : ")";
  for (let j = cursor; j < source.length; j++) {
    const ch = source[j];
    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) {
        const endStmt = source.slice(j + 1).match(/^\s*\)\s*;?/);
        const fullEnd = j + 1 + (endStmt ? endStmt[0].length : 0);
        return {
          start,
          end: start + (source.slice(start).search(/export const |$/) || source.length),
          replaceEnd: fullEnd,
          body: source.slice(cursor, j + 1),
          params: source.slice(asyncIdx, arrowIdx).trim(),
        };
      }
    }
  }
  throw new Error(`unbalanced for ${exportName}`);
}

function findExportEnd(source, start) {
  const next = source.slice(start + 1).search(/\nexport (const|async function) /);
  if (next < 0) return source.length;
  return start + 1 + next;
}

const handlerNames = [];
for (const exp of [...exports].reverse()) {
  const blockStart = handlers.search(new RegExp(`export const ${exp.name} = createServerFn`));
  const blockEnd = findExportEnd(handlers, blockStart);
  const block = handlers.slice(blockStart, blockEnd);

  const handlerIdx = block.indexOf(".handler(");
  const asyncIdx = block.indexOf("async", handlerIdx);
  const arrowIdx = block.indexOf("=>", asyncIdx);
  let cursor = arrowIdx + 2;
  while (cursor < block.length && /\s/.test(block[cursor])) cursor++;
  const open = block[cursor];
  const closeCh = open === "{" ? "}" : ")";
  let depth = 0;
  let bodyEnd = cursor;
  for (let j = cursor; j < block.length; j++) {
    if (block[j] === open) depth++;
    else if (block[j] === closeCh) {
      depth--;
      if (depth === 0) {
        bodyEnd = j + 1;
        break;
      }
    }
  }

  const params = block.slice(asyncIdx, arrowIdx).trim();
  let body = block.slice(cursor, bodyEnd).trim();
  const handlerName = `${exp.name}Handler`;
  handlerNames.unshift({ ...exp, handlerName });

  let fnHeader;
  if (params === "async ()") {
    fnHeader = `export async function ${handlerName}()`;
    if (body.startsWith("(")) body = `return ${body}`;
  } else if (params === "async ({ data })") {
    fnHeader = `export async function ${handlerName}(ctx: { data: unknown })`;
    body = body.startsWith("{") ? body.slice(1, -1).trim() : body;
    body = `const { data } = ctx as { data: Record<string, unknown> };\n${body}`;
  } else {
    throw new Error(`unknown params for ${exp.name}: ${params}`);
  }

  const replacement = `${fnHeader} {\n${body}\n}\n`;
  handlers = handlers.slice(0, blockStart) + replacement + handlers.slice(blockEnd);
}

fs.writeFileSync(handlersPath, handlers);

const clientLines = [
  'import { createServerFn } from "@tanstack/react-start";',
  "",
  'import {',
  "  createAccountSchema,",
  "  deleteStaffSchema,",
  "  requesterTokenSchema,",
  "  sendCustomerBillSchema,",
  "  sendPasswordResetSchema,",
  "  sendWorkConfirmationSchema,",
  "  setStaffActiveSchema,",
  "  shopDetailsSchema,",
  "  updateMyProfileSchema,",
  "  updateStaffSchema,",
  '} from "@/lib/tldGroobey.functions-schemas";',
  "",
  "type HandlerCtx = { data: unknown };",
  "",
  'async function invokeHandler<T extends HandlerCtx | void>(name: string, ctx?: T) {',
  '  const mod = await import("./tldGroobey.handlers.server");',
  "  const fn = mod[name as keyof typeof mod];",
  '  if (typeof fn !== "function") throw new Error(`Missing server handler: ${name}`);',
  "  return ctx === undefined ? (fn as () => Promise<unknown>)() : (fn as (c: HandlerCtx) => Promise<unknown>)(ctx);",
  "}",
  "",
];

for (const exp of handlerNames) {
  const validator = exp.schema ? `  .inputValidator((input) => ${exp.schema}.parse(input))` : "";
  const handlerLine =
    exp.schema ?
      `  .handler(async (ctx) => invokeHandler("${exp.handlerName}", ctx));`
    : `  .handler(async () => invokeHandler("${exp.handlerName}"));`;
  clientLines.push(
    `export const ${exp.name} = createServerFn({ method: "${exp.method}" })`,
    validator,
    handlerLine,
    "",
  );
}

fs.writeFileSync(clientPath, clientLines.join("\n"));

// syncGroobeyCodes and ensureMyGroobeyCode used inline z.object - add to schemas if missing
const schemasPath = path.join(root, "src/lib/tldGroobey.functions-schemas.ts");
let schemas = fs.readFileSync(schemasPath, "utf8");
if (!schemas.includes("syncGroobeyCodes")) {
  // requesterTokenSchema already covers sync/ensure
}

console.log("ok", handlerNames.length, "handlers; handlers lines:", handlers.split("\n").length);
