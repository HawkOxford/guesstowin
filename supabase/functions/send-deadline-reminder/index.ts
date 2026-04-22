import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const FOOTBALL_API_KEY = Deno.env.get('FOOTBALL_DATA_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!RESEND_API_KEY || !FOOTBALL_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get current GW and fixtures
    const fixturesRes = await fetch(
      'https://api.football-data.org/v4/competitions/PL/matches?status=SCHEDULED',
      {
        headers: {
          'X-Auth-Token': FOOTBALL_API_KEY,
        },
      }
    );

    if (!fixturesRes.ok) {
      throw new Error('Failed to fetch fixtures from API');
    }

    const fixturesData = await fixturesRes.json();
    const allMatches = fixturesData.matches || [];

    // Filter for weekend fixtures only
    const weekendMatches = allMatches.filter((m: any) => {
      const date = new Date(m.utcDate);
      const ukDay = date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Europe/London' });
      return ukDay === 'Saturday' || ukDay === 'Sunday';
    });

    if (weekendMatches.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No upcoming weekend fixtures found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sort by date and get the next gameweek's fixtures
    weekendMatches.sort((a: any, b: any) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
    const firstKickoff = new Date(weekendMatches[0].utcDate);
    const gwStart = new Date(weekendMatches[0].utcDate);
    const gwEnd = new Date(gwStart);
    gwEnd.setDate(gwEnd.getDate() + 2); // Assume GW ends within 2 days

    const gwFixtures = weekendMatches.filter((m: any) => {
      const mDate = new Date(m.utcDate);
      return mDate >= gwStart && mDate <= gwEnd;
    });

    // Estimate current GW number from results table
    const { data: results } = await supabase
      .from('results')
      .select('gameweek, status')
      .eq('status', 'finished')
      .order('gameweek', { ascending: false })
      .limit(100);

    const finishedGWs = new Set((results || []).map((r: any) => r.gameweek));
    const maxFinishedGW = finishedGWs.size > 0 ? Math.max(...Array.from(finishedGWs)) : 26;
    const currentGW = maxFinishedGW + 1;

    // Get all player emails
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, player_name')
      .in('player_name', ['Jake', 'Glurk', 'Josh', 'Richard', 'Teflon', 'Alex', 'Gaz', 'Liam', 'Craig', 'Marcus']);

    if (profilesError || !profiles || profiles.length === 0) {
      throw new Error('Failed to fetch player profiles');
    }

    // Get current standings
    const { data: predictions } = await supabase
      .from('predictions')
      .select('user_id, gameweek, match_key, home_score, away_score')
      .lte('gameweek', currentGW - 1);

    const { data: allResults } = await supabase
      .from('results')
      .select('gameweek, match_key, home_score, away_score, status')
      .eq('status', 'finished')
      .lte('gameweek', currentGW - 1);

    // Calculate points per player
    const playerPoints: { [key: string]: number } = {};
    profiles.forEach((p: any) => {
      playerPoints[p.id] = 0;
    });

    (predictions || []).forEach((pred: any) => {
      const result = (allResults || []).find(
        (r: any) => r.gameweek === pred.gameweek && r.match_key === pred.match_key
      );
      if (result && pred.home_score !== null && pred.away_score !== null) {
        const predResult = pred.home_score > pred.away_score ? 'H' : pred.home_score < pred.away_score ? 'A' : 'D';
        const actualResult = result.home_score > result.away_score ? 'H' : result.home_score < result.away_score ? 'A' : 'D';

        if (pred.home_score === result.home_score && pred.away_score === result.away_score) {
          playerPoints[pred.user_id] = (playerPoints[pred.user_id] || 0) + 3;
        } else if (predResult === actualResult) {
          playerPoints[pred.user_id] = (playerPoints[pred.user_id] || 0) + 1;
        }
      }
    });

    // Sort players by points
    const standings = profiles
      .map((p: any) => ({
        name: p.player_name,
        points: playerPoints[p.id] || 0,
      }))
      .sort((a: any, b: any) => b.points - a.points);

    // Build fixtures HTML
    const fixturesHTML = gwFixtures
      .map((m: any) => {
        const date = new Date(m.utcDate);
        const day = date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' });
        const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
        const home = m.homeTeam.name.replace(' FC', '').replace(' United', ' Utd');
        const away = m.awayTeam.name.replace(' FC', '').replace(' United', ' Utd');
        return `
          <tr>
            <td style="padding: 8px; color: #999; font-size: 0.85rem;">${day} ${time}</td>
            <td style="padding: 8px; text-align: right; font-weight: 500;">${home}</td>
            <td style="padding: 8px; color: #666; text-align: center;">v</td>
            <td style="padding: 8px; font-weight: 500;">${away}</td>
          </tr>
        `;
      })
      .join('');

    // Build standings HTML
    const standingsHTML = standings
      .map((p: any, idx: number) => `
        <tr>
          <td style="padding: 6px; color: #999; text-align: center;">${idx + 1}</td>
          <td style="padding: 6px; font-weight: 500;">${p.name}</td>
          <td style="padding: 6px; text-align: right; color: #00e676;">${p.points}</td>
        </tr>
      `)
      .join('');

    // Email HTML template
    const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GW${currentGW} Deadline Reminder</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080d08; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #fff;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="margin: 0; font-size: 2.5rem; font-weight: 700; letter-spacing: -0.02em;">
        GUESS TO WIN<span style="color: #00e676;">.</span>
      </h1>
      <p style="margin: 8px 0 0 0; font-size: 0.9rem; color: #999;">2025/26 Season</p>
    </div>

    <!-- Main Card -->
    <div style="background-color: #111; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">⏱</div>
        <h2 style="margin: 0; font-size: 1.5rem; font-weight: 600;">Gameweek ${currentGW}</h2>
        <p style="margin: 8px 0 0 0; font-size: 1.1rem; color: #00e676; font-weight: 500;">Predictions close in 24 hours</p>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="https://hawkoxford.github.io/guesstowin" style="display: inline-block; background-color: #00e676; color: #080d08; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 1rem;">
          Submit Your Predictions
        </a>
      </div>

      <div style="border-top: 1px solid #222; padding-top: 20px;">
        <h3 style="margin: 0 0 12px 0; font-size: 0.95rem; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.05em;">Fixtures This Week</h3>
        <table style="width: 100%; border-collapse: collapse; color: #fff;">
          ${fixturesHTML}
        </table>
      </div>
    </div>

    <!-- Standings Card -->
    <div style="background-color: #111; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 16px 0; font-size: 0.95rem; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.05em;">Current Standings</h3>
      <table style="width: 100%; border-collapse: collapse; color: #fff;">
        ${standingsHTML}
      </table>
    </div>

    <!-- Footer -->
    <div style="text-align: center; color: #666; font-size: 0.85rem;">
      <p style="margin: 0;">Weekend warriors only · Correct score = 3pts · Correct result = 1pt</p>
      <p style="margin: 8px 0 0 0;">
        <a href="https://hawkoxford.github.io/guesstowin" style="color: #00e676; text-decoration: none;">hawkoxford.github.io/guesstowin</a>
      </p>
    </div>

  </div>
</body>
</html>
    `;

    // Hardcoded player emails (Guess to Win private group)
    const playerEmails: { [key: string]: string } = {
      'Jake': 'jake14vanags@gmail.com',
      'Glurk': 'glurk@example.com', // TODO: Get real emails
      'Josh': 'josh@example.com',
      'Richard': 'richard@example.com',
      'Teflon': 'teflon@example.com',
      'Alex': 'alex@example.com',
      'Gaz': 'gaz@example.com',
      'Liam': 'liam@example.com',
      'Craig': 'craig@example.com',
      'Marcus': 'marcus@example.com',
    };

    // Send emails via Resend
    const emailPromises = profiles.map(async (p: any) => {
      const email = playerEmails[p.player_name];
      if (!email || email.includes('@example.com')) {
        console.log(`Skipping ${p.player_name} - no valid email`);
        return { name: p.player_name, sent: false, reason: 'No valid email' };
      }

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Guess to Win <notifications@predictr.me>',
            to: [email],
            subject: `⏱ GW${currentGW} predictions close in 24 hours`,
            html: emailHTML,
          }),
        });

        if (!res.ok) {
          const errorData = await res.text();
          console.error(`Failed to send to ${p.player_name}:`, errorData);
          return { name: p.player_name, sent: false, reason: errorData };
        }

        return { name: p.player_name, sent: true };
      } catch (error) {
        console.error(`Error sending to ${p.player_name}:`, error);
        return { name: p.player_name, sent: false, reason: String(error) };
      }
    });

    const results_send = await Promise.all(emailPromises);
    const sentCount = results_send.filter((r) => r.sent).length;

    return new Response(
      JSON.stringify({
        success: true,
        gameweek: currentGW,
        fixtures_count: gwFixtures.length,
        emails_sent: sentCount,
        emails_total: profiles.length,
        results: results_send,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
