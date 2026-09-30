#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import os from "node:os";
import path from "node:path";

// Checks every skill against the Agent Skills spec and this repo's rules:
// frontmatter, names, lengths, relative links, script syntax and the Claude
// Code plugin manifest. Exits 1 when anything fails.

const root = path.resolve(import.meta.dirname, "..");
const skillsDir = path.join(root, "skills");
const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

/** Parses the YAML subset skills use: scalars, folded blocks and one-level maps. */
function parseFrontmatter(text) {
  const data = {};
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^([a-z][\w-]*):\s*(.*)$/);
    if (!match) continue;
    const [, key, rest] = match;
    const block = [];
    while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) block.push(lines[++i]);
    if (rest === ">" || rest === "|" || rest === ">-" || rest === "|-") {
      data[key] = block.map((l) => l.trim()).join(rest.startsWith(">") ? " " : "\n");
    } else if (rest === "" && block.length) {
      data[key] = Object.fromEntries(
        block.map((l) => {
          const [k, ...v] = l.trim().split(":");
          return [k.trim(), v.join(":").trim().replace(/^["']|["']$/g, "")];
        }),
      );
    } else {
      data[key] = rest.replace(/^["']|["']$/g, "");
    }
  }
  return data;
}

const filesIn = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (name === "node_modules") return [];
    return statSync(file).isDirectory() ? filesIn(file) : [file];
  });

const skills = readdirSync(skillsDir).sort().filter((d) =>
  statSync(path.join(skillsDir, d)).isDirectory(),
);

for (const dir of skills) {
  const where = `skills/${dir}`;
  const file = path.join(skillsDir, dir, "SKILL.md");
  if (!existsSync(file)) {
    fail(where, "missing SKILL.md");
    continue;
  }
  const text = readFileSync(file, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    fail(where, "SKILL.md must start with YAML frontmatter between --- lines");
    continue;
  }
  const meta = parseFrontmatter(match[1]);
  const body = match[2];

  if (!meta.name) fail(where, "frontmatter needs a name");
  else {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.name) || meta.name.length > 64)
      fail(where, `name "${meta.name}" must be lowercase letters, digits and single hyphens, at most 64 characters`);
    if (meta.name !== dir) fail(where, `name "${meta.name}" must match the folder name`);
  }
  if (!meta.description) fail(where, "frontmatter needs a description");
  else if (meta.description.length > 1024)
    fail(where, `description is ${meta.description.length} characters; the limit is 1024`);
  if (meta.compatibility && meta.compatibility.length > 500)
    fail(where, `compatibility is ${meta.compatibility.length} characters; the limit is 500`);
  if (!meta.license) fail(where, "frontmatter needs a license");
  if (meta.metadata && typeof meta.metadata !== "object")
    fail(where, "metadata must be a map of strings");

  const lines = body.split("\n").length;
  if (lines > 500) fail(where, `SKILL.md body is ${lines} lines; keep it under 500`);

  // Relative links must point at files inside the skill. Code samples and
  // absolute paths are examples, not links.
  const prose = body.replace(/```[\s\S]*?```/g, "");
  for (const [, target] of prose.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
    if (/^[a-z]+:/i.test(target) || target.startsWith("/")) continue;
    if (!existsSync(path.join(skillsDir, dir, target)))
      fail(where, `link to ${target} points at a missing file`);
  }

  for (const script of filesIn(path.join(skillsDir, dir)).filter((f) => /\.(m?js|ts)$/.test(f))) {
    const where = path.relative(root, script);
    let file = script;
    if (script.endsWith(".ts")) {
      // `node --check` doesn't strip types, so strip them first. This also
      // rejects syntax Node can't run unbuilt, such as enums.
      try {
        file = path.join(os.tmpdir(), `validate-${path.basename(script, ".ts")}.mjs`);
        writeFileSync(file, stripTypeScriptTypes(readFileSync(script, "utf8")));
      } catch (error) {
        fail(where, error.message);
        continue;
      }
    }
    // Always Node: `bun --check` runs the script instead of only parsing it
    const check = spawnSync("node", ["--check", file], { encoding: "utf8" });
    if (check.status !== 0)
      fail(where, check.stderr.trim().split("\n").slice(0, 4).join(" "));
  }
}

// Every skill must be installable as a Claude Code plugin too
const manifestFile = path.join(root, ".claude-plugin", "marketplace.json");
if (existsSync(manifestFile)) {
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  const listed = new Set(
    manifest.plugins.flatMap((p) => p.skills ?? []).map((s) => path.basename(s)),
  );
  for (const dir of skills)
    if (!listed.has(dir)) fail(".claude-plugin/marketplace.json", `does not list skills/${dir}`);
  for (const plugin of manifest.plugins)
    for (const s of plugin.skills ?? [])
      if (!existsSync(path.join(root, plugin.source ?? "./", s)))
        fail(".claude-plugin/marketplace.json", `${s} does not exist`);
}

if (errors.length) {
  console.error(`${errors.length} problem${errors.length === 1 ? "" : "s"} found:\n`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`${skills.length} skills valid: ${skills.join(", ")}`);
