import { readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const LEGACY_LAST_VERSION = 38;
const LEGACY_DUPLICATES = new Map([
  ["002", new Set(["002_assemblyai_transcript_id.sql", "002_split_profiles_billing.sql"])],
  ["007", new Set(["007_add_summary_item_dedupe_keys.sql", "007_add_task_kanban_status.sql", "007_make_tasks_meeting_optional.sql"])],
  ["018", new Set(["018_meeting_groups.sql", "018_stripe_billing_gateway.sql"])],
  ["028", new Set(["028_activation_funnel.sql", "028_task_labels.sql"])],
  ["030", new Set(["030_integration_interest.sql", "030_meeting_templates.sql"])],
]);
const FILE_PATTERN = /^(\d{3}|\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

function duplicateIsAllowlisted(version, filenames) {
  const allowed = LEGACY_DUPLICATES.get(version);
  return allowed !== undefined && filenames.every((filename) => allowed.has(filename));
}

export function verifyMigrationFiles(filenames) {
  const errors = [];
  const versions = new Map();
  for (const filename of filenames.filter((name) => name.endsWith(".sql")).sort()) {
    const match = FILE_PATTERN.exec(filename);
    if (!match) {
      errors.push(`${filename}: use <UTC timestamp YYYYMMDDHHMMSS>_<snake_case_name>.sql`);
      continue;
    }
    const version = match[1];
    if (version.length === 3 && Number(version) > LEGACY_LAST_VERSION) {
      errors.push(`${filename}: sequential migration numbers ended at ${LEGACY_LAST_VERSION}; use npm run migration:new -- <name>`);
    }
    versions.set(version, [...(versions.get(version) ?? []), filename]);
  }
  for (const [version, names] of versions) {
    if (names.length > 1 && !duplicateIsAllowlisted(version, names)) {
      errors.push(`migration version ${version} is duplicated: ${names.join(", ")}`);
    }
  }
  return errors;
}

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

function normalizeName(value) {
  const name = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!name) throw new Error("Provide a migration name, for example: npm run migration:new -- referral_tracking");
  return name;
}

function verify(directory) {
  const errors = verifyMigrationFiles(readdirSync(directory));
  if (errors.length) throw new Error(`Migration policy failed:\n- ${errors.join("\n- ")}`);
  console.log(`Migration policy passed (${basename(directory)}).`);
}

function create(directory, rawName) {
  verify(directory);
  const path = join(directory, `${timestamp()}_${normalizeName(rawName ?? "")}.sql`);
  writeFileSync(path, "-- Write a forward-only, idempotent migration here.\n", { flag: "wx" });
  console.log(path);
}

function main(args) {
  const directory = resolve(process.cwd(), process.env.MIGRATIONS_DIR ?? "supabase/migrations");
  if (args[0] === "verify") return verify(directory);
  if (args[0] === "create") return create(directory, args.slice(1).join("_"));
  throw new Error("Usage: node scripts/migrations.mjs <verify|create> [migration_name]");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
