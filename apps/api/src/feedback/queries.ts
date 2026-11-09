import { Feedback, type CreateFeedbackRequest } from "@feedbacker/contracts";
import type pg from "pg";

interface FeedbackRow {
  id: string;
  product_origin: string;
  page_path: string;
  body: string;
  author_name: string;
  anchor: unknown;
  display_context: unknown;
  created_at: Date;
}

const COLUMNS = "id, product_origin, page_path, body, author_name, anchor, display_context, created_at";

const toFeedback = (row: FeedbackRow): Feedback =>
  Feedback.parse({
    id: row.id,
    productOrigin: row.product_origin,
    pagePath: row.page_path,
    body: row.body,
    authorName: row.author_name,
    anchor: row.anchor,
    displayContext: row.display_context,
    createdAt: row.created_at.toISOString(),
  });

export const listFeedbackByOrigin = async (pool: pg.Pool, origin: string): Promise<Feedback[]> => {
  const { rows } = await pool.query<FeedbackRow>(
    `SELECT ${COLUMNS} FROM feedback WHERE product_origin = $1 ORDER BY created_at DESC, id DESC`,
    [origin],
  );
  return rows.map(toFeedback);
};

export interface InsertResult {
  feedback: Feedback;
  created: boolean;
}

/** Une nouvelle tentative avec le même `id` renvoie le retour existant, sans rien écraser (R14). */
export const insertFeedback = async (
  pool: pg.Pool,
  request: CreateFeedbackRequest,
  createdAt: Date,
): Promise<InsertResult> => {
  const inserted = await pool.query<FeedbackRow>(
    `INSERT INTO feedback (id, product_origin, page_path, body, author_name, anchor, display_context, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING
     RETURNING ${COLUMNS}`,
    [
      request.id,
      request.productOrigin,
      request.pagePath,
      request.body,
      request.authorName,
      JSON.stringify(request.anchor),
      JSON.stringify(request.displayContext),
      createdAt,
    ],
  );
  const [created] = inserted.rows;
  if (created) return { feedback: toFeedback(created), created: true };
  const existing = await pool.query<FeedbackRow>(`SELECT ${COLUMNS} FROM feedback WHERE id = $1`, [request.id]);
  const [row] = existing.rows;
  if (!row) throw new Error("Feedback disappeared between insert and read");
  return { feedback: toFeedback(row), created: false };
};
