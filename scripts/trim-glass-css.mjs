// Cuts Glassy UI's stylesheet down to the pieces Padel Loop uses.
//
// liquid.css ships every Glassy UI component. We keep the glass surface and the
// floating pieces in the redesign plan (panel, dialog, sheet, popover, menu,
// toast) and remove the rest. Run after any `shadcn add @glassyui/...`, because
// the CLI restores the full file:
//
//   node scripts/trim-glass-css.mjs
//
// Adding a component that's listed in DROP? Take it off the list first.

import { readFileSync, writeFileSync } from "node:fs";
import postcss from "postcss";

const FILE = "src/components/glassyui/styles/liquid.css";

const DROP = new Set([
  "accordion", "alert", "avatar", "badge", "breadcrumb", "button", "check",
  "checkbox", "command", "dock", "input", "kbd", "lens", "page", "pagination",
  "progress", "radio", "refraction", "scene", "scroll", "scrollbar", "segmented",
  "select", "skeleton", "slider", "spinner", "switch", "tabs", "textarea",
  "tooltip",
]);

const classesIn = (selector) =>
  [...selector.matchAll(/\.lg-([a-z]+)/g)].map((match) => match[1]);

// A selector goes only if all it targets is dropped pieces. A shared :is() list
// that also names a piece we keep stays, because it's harmless and still needed.
function isDropped(selector) {
  const classes = classesIn(selector);
  if (!classes.some((name) => DROP.has(name))) return false;
  return !selector.includes(":is(") || classes.every((name) => DROP.has(name));
}

const before = readFileSync(FILE, "utf8");
const root = postcss.parse(before);

root.walkRules((rule) => {
  if (rule.parent.type === "atrule" && rule.parent.name.endsWith("keyframes")) return;
  const kept = rule.selectors.filter((selector) => !isDropped(selector));
  if (kept.length === 0) rule.remove();
  else if (kept.length !== rule.selectors.length) rule.selectors = kept;
});

// Remove what only the dropped pieces used: animations, registered properties,
// then any media or layer block that's now empty.
const text = () => root.toString();

root.walkAtRules(/keyframes$/, (atRule) => {
  const copy = text().replace(atRule.toString(), "");
  if (!copy.includes(atRule.params)) atRule.remove();
});

root.walkAtRules("property", (atRule) => {
  const copy = text().replace(atRule.toString(), "");
  if (!copy.includes(`var(${atRule.params}`)) atRule.remove();
});

root.walkAtRules((atRule) => {
  if (atRule.nodes && atRule.nodes.length === 0) atRule.remove();
});

writeFileSync(FILE, text());
console.log(`liquid.css: ${before.length} -> ${text().length} characters`);
