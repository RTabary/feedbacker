import { fr } from "./fr.ts";

type Catalog = typeof fr;
type PluralBase = {
  [Key in keyof Catalog]: Key extends `${infer Base}.one` ? Base : never;
}[keyof Catalog];
type Key = Exclude<keyof Catalog, `${string}.one` | `${string}.other`> | PluralBase;
type Params = Record<string, string | number>;

const pluralRules = new Intl.PluralRules("fr");

const lookup = (key: string, params: Params): string | undefined => {
  const catalog: Record<string, string> = fr;
  const exact = catalog[key];
  if (exact !== undefined) return exact;
  if (typeof params.count !== "number") return undefined;
  const category = pluralRules.select(params.count) === "one" ? "one" : "other";
  return catalog[`${key}.${category}`];
};

export const t = (key: Key, params: Params = {}): string => {
  const template = lookup(key, params);
  if (template === undefined) throw new Error(`Unknown translation key: ${key}`);
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  );
};

export const formatDateTime = (isoDate: string, timeZone?: string): string =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone }).format(new Date(isoDate));
