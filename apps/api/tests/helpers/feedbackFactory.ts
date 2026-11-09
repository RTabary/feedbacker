import { randomUUID } from "node:crypto";
import type pg from "pg";
import { ALLOWED_ORIGIN } from "./testApp.ts";

export const validAnchor = {
  selector: "#save",
  tagName: "button",
  textExcerpt: "Enregistrer",
  rect: { x: 10, y: 20, width: 100, height: 40 },
};
export const validDisplayContext = { viewportWidth: 1280, viewportHeight: 720, scrollX: 0, scrollY: 120 };

export const validRequest = (override: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  productOrigin: ALLOWED_ORIGIN,
  pagePath: "/orders",
  body: "Le libellé est ambigu",
  authorName: "Camille",
  anchor: validAnchor,
  displayContext: validDisplayContext,
  ...override,
});

interface SeedRow {
  id?: string;
  productOrigin?: string;
  createdAt?: string;
}

export const seedFeedback = async (pool: pg.Pool, row: SeedRow = {}): Promise<string> => {
  const id = row.id ?? randomUUID();
  await pool.query(
    `INSERT INTO feedback (id, product_origin, page_path, body, author_name, anchor, display_context, created_at)
     VALUES ($1, $2, '/orders', 'Retour', 'Camille', $3, $4, $5)`,
    [
      id,
      row.productOrigin ?? ALLOWED_ORIGIN,
      JSON.stringify(validAnchor),
      JSON.stringify(validDisplayContext),
      row.createdAt ?? "2026-11-04T09:00:00.000Z",
    ],
  );
  return id;
};
