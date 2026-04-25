-- QUERY 1: Show predictions by user for GW29 and GW30
SELECT
  profiles.player_name,
  predictions.gameweek,
  COUNT(*) as prediction_count
FROM predictions
JOIN profiles ON profiles.id = predictions.user_id
WHERE predictions.gameweek IN (29, 30)
GROUP BY profiles.player_name, predictions.gameweek
ORDER BY profiles.player_name, predictions.gameweek;
