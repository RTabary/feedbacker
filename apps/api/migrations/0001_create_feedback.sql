-- Up Migration
CREATE TABLE feedback (
  id uuid PRIMARY KEY,
  product_origin text NOT NULL,
  page_path text NOT NULL CHECK (page_path LIKE '/%' AND char_length(page_path) <= 2048),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  author_name text NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 100),
  anchor jsonb NOT NULL CHECK (jsonb_typeof(anchor) = 'object'),
  display_context jsonb NOT NULL CHECK (jsonb_typeof(display_context) = 'object'),
  created_at timestamptz NOT NULL
);

CREATE INDEX feedback_product_order_idx ON feedback (product_origin, created_at DESC, id DESC);

-- Down Migration
DROP TABLE feedback;
