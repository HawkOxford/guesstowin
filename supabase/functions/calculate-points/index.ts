import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Prediction {
  user_id: string;
  match_key: string;
  home_score: number | null;
  away_score: number | null;
}

interface Result {
  match_key: string;
  home_score: number;
  away_score: number;
  status: string;
}

function calcPoints(
  predH: number | null | undefined,
  predA: number | null | undefined,
  actH: number | null | undefined,
  actA: number | null | undefined
): number | null {
  if (predH == null || predA == null || actH == null || actA == null) return null;

  // Correct score
  if (predH === actH && predA === actA) return 3;

  // Correct result
  const predResult = predH > predA ? 'H' : predH < predA ? 'A' : 'D';
  const actResult = actH > actA ? 'H' : actH < actA ? 'A' : 'D';
  if (predResult === actResult) return 1;

  return 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { gameweek, liveResults } = await req.json();

    if (!gameweek || gameweek < 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid gameweek' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch predictions for this gameweek
    const { data: predictions, error: predError } = await sb
      .from('predictions')
      .select('user_id, match_key, home_score, away_score')
      .eq('gameweek', gameweek);

    if (predError) {
      console.error('Failed to fetch predictions:', predError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch predictions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch results from database
    const { data: dbResults, error: resultError } = await sb
      .from('results')
      .select('match_key, home_score, away_score, status')
      .eq('gameweek', gameweek);

    if (resultError) {
      console.error('Failed to fetch results:', resultError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch results' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build results map
    const resultsMap: Record<string, Result> = {};
    (dbResults || []).forEach((r: any) => {
      resultsMap[r.match_key] = r;
    });

    // Include liveResults if provided (for current GW)
    if (liveResults) {
      Object.entries(liveResults).forEach(([key, result]: [string, any]) => {
        if (!resultsMap[key]) {
          resultsMap[key] = result;
        }
      });
    }

    // Calculate points per user
    const userPoints: Record<string, number> = {};
    (predictions || []).forEach((pred: Prediction) => {
      // Try exact match first, then without gameweek prefix
      let result = resultsMap[pred.match_key];
      if (!result) {
        const cleanKey = pred.match_key.replace(/^\d+_/, '');
        result = resultsMap[cleanKey];
      }

      if (!result) return;

      const pts = calcPoints(pred.home_score, pred.away_score, result.home_score, result.away_score);
      if (pts === null) return;

      if (!userPoints[pred.user_id]) userPoints[pred.user_id] = 0;
      userPoints[pred.user_id] += pts;
    });

    // Upsert points to database
    const pointsRows = Object.entries(userPoints).map(([user_id, points]) => ({
      user_id,
      gameweek,
      points,
    }));

    if (pointsRows.length > 0) {
      const { error: upsertError } = await sb
        .from('user_gameweek_points')
        .upsert(pointsRows, { onConflict: 'user_id,gameweek' });

      if (upsertError) {
        console.error('Failed to upsert points:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to store points' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        gameweek,
        users: pointsRows.length,
        message: `Calculated points for ${pointsRows.length} users in GW${gameweek}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Calculate points error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
