-- Drop the restrictive write policy (Edge Function uses service role key)
DROP POLICY IF EXISTS "Users can update own points" ON user_gameweek_points;

-- Keep only the read policy
-- "Points are publicly readable" policy already exists from create_points_table.sql
