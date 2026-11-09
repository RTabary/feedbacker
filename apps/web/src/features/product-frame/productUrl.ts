import { ProductOrigin } from "@feedbacker/contracts";

export type ProductUrl =
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "valid"; url: string; origin: string };

export const parseProductUrl = (search: string): ProductUrl => {
  const value = new URLSearchParams(search).get("url");
  if (!value) return { kind: "missing" };
  if (!URL.canParse(value)) return { kind: "invalid" };
  const url = new URL(value);
  // Des identifiants dans l'adresse peuvent déguiser le vrai site : https://confiance@autre.site
  if (url.username || url.password || !ProductOrigin.safeParse(url.origin).success) return { kind: "invalid" };
  return { kind: "valid", url: url.href, origin: url.origin };
};
