import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { load as loadYaml } from "js-yaml";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const registryDir = join(root, "registry");
const schemaPath = join(root, "schemas/registry-entry.schema.json");

const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const folders = (await readdir(registryDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const errors = [];
const slugs = new Set();
let totalSkills = 0;

for (const folder of folders) {
  const entryPath = join(registryDir, folder, "entry.yaml");
  let entry;

  try {
    entry = loadYaml(await readFile(entryPath, "utf8"));
  } catch (error) {
    errors.push(`${folder}: cannot read entry.yaml (${error.message})`);
    continue;
  }

  if (!validate(entry)) {
    for (const issue of validate.errors ?? []) {
      errors.push(`${folder}${issue.instancePath || "/"}: ${issue.message}`);
    }
  }

  if (entry?.slug !== folder) {
    errors.push(`${folder}: folder name must equal slug "${entry?.slug ?? "missing"}"`);
  }
  if (slugs.has(entry?.slug)) {
    errors.push(`${folder}: duplicate slug "${entry.slug}"`);
  }
  slugs.add(entry?.slug);
  totalSkills += Number(entry?.skill_count ?? 0);
}

if (folders.length === 0) errors.push("registry: no entries found");

if (errors.length > 0) {
  console.error(`Registry validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Registry valid: ${folders.length} packs, ${totalSkills} atomic skills.`);
