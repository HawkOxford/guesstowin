-- Create table for storing calculated points per user per gameweek
CREATE TABLE IF NOT EXISTS user_gameweek_points (
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  gameweek int NOT NULL,
  points int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, gameweek)
);

-- Enable RLS
ALTER TABLE user_gameweek_points ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read points
CREATE POLICY "Points are publicly readable"
  ON user_gameweek_points FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Only authenticated users can insert/update their own points
-- (In practice, this will be done via a function, but allowing for direct writes during development)
CREATE POLICY "Users can update own points"
  ON user_gameweek_points FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_gameweek_points_gameweek ON user_gameweek_points(gameweek);
CREATE INDEX IF NOT EXISTS idx_user_gameweek_points_user_id ON user_gameweek_points(user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_gameweek_points_updated_at
  BEFORE UPDATE ON user_gameweek_points
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
