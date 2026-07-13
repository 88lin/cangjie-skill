import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { load as loadYaml } from "js-yaml";

export type SourceType = "github" | "bundled";
export type Quality = "verified" | "community" | "experimental";
export type RegistryStatus = "active" | "experimental" | "archived";

export interface RegistryEntry {
  schema_version: 1;
  slug: string;
  name: string;
  summary: string;
  source_type: SourceType;
  source_url: string;
  skill_path?: string;
  skill_count: number;
  domains: string[];
  language: string[];
  status: RegistryStatus;
  quality: Quality;
  featured?: boolean;
  use_cases: string[];
  install?: {
    clone?: string;
    copy?: string;
  };
}

export interface CatalogStats {
  packs: number;
  skills: number;
  domains: number;
  contributors: number;
}

const registryDir = resolve(process.cwd(), "../registry");

let catalogPromise: Promise<RegistryEntry[]> | undefined;

export function loadCatalog(): Promise<RegistryEntry[]> {
  catalogPromise ??= readCatalog();
  return catalogPromise;
}

async function readCatalog(): Promise<RegistryEntry[]> {
  const folders = (await readdir(registryDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const entries = await Promise.all(
    folders.map(async (folder) => {
      const raw = await readFile(join(registryDir, folder, "entry.yaml"), "utf8");
      return loadYaml(raw) as RegistryEntry;
    }),
  );

  return entries.sort((a, b) => {
    if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

export function getCatalogStats(entries: RegistryEntry[]): CatalogStats {
  const domains = new Set(entries.flatMap((entry) => entry.domains));
  const contributors = new Set(
    entries.map((entry) => new URL(entry.source_url).pathname.split("/").filter(Boolean)[0]),
  );

  return {
    packs: entries.length,
    skills: entries.reduce((sum, entry) => sum + entry.skill_count, 0),
    domains: domains.size,
    contributors: contributors.size,
  };
}

export function searchableText(entry: RegistryEntry): string {
  return [
    entry.name,
    entry.slug,
    entry.summary,
    ...entry.domains,
    ...entry.use_cases,
  ]
    .join(" ")
    .toLocaleLowerCase("zh-CN");
}

export function filterCatalog(
  entries: RegistryEntry[],
  options: { query?: string; domain?: string; quality?: string; source?: string },
): RegistryEntry[] {
  const query = options.query?.trim().toLocaleLowerCase("zh-CN") ?? "";

  return entries.filter((entry) => {
    if (query && !searchableText(entry).includes(query)) return false;
    if (options.domain && !entry.domains.includes(options.domain)) return false;
    if (options.quality && entry.quality !== options.quality) return false;
    if (options.source && entry.source_type !== options.source) return false;
    return true;
  });
}
