-- Create SECURITY DEFINER function to upsert points (bypasses RLS)
CREATE OR REPLACE FUNCTION upsert_user_gameweek_points(points_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  point_row jsonb;
BEGIN
  -- Loop through the jsonb array and upsert each row
  FOR point_row IN SELECT * FROM jsonb_array_elements(points_data)
  LOOP
    INSERT INTO user_gameweek_points (user_id, gameweek, points)
    VALUES (
      (point_row->>'user_id')::uuid,
      (point_row->>'gameweek')::int,
      (point_row->>'points')::int
    )
    ON CONFLICT (user_id, gameweek)
    DO UPDATE SET
      points = EXCLUDED.points,
      updated_at = now();
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION upsert_user_gameweek_points(jsonb) TO authenticated;
