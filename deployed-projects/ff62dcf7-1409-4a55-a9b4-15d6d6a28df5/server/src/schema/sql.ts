export const createTablesSql = `
CREATE TABLE IF NOT EXISTS generated_art (
  id UUID PRIMARY KEY,
  prompt TEXT NOT NULL,
  style TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  seed INT NOT NULL,
  image_data_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS generated_art_created_at_idx ON generated_art (created_at DESC);
`;
