// Check GW data using Supabase JS client (same as the app)
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://iufbdwsmbwrtcqzkvyey.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZmJkd3NtYndydGNxemt2eWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTg2MzcsImV4cCI6MjA5MDE5NDYzN30.Q3B-7qr4xWcGpa1UJWKSAd1iu6_-WHaiDcPV4HJ8SNk';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkData() {
  console.log('\n=== CHECKING GW DATA (using Supabase JS client) ===\n');

  // Try without status filter first
  const { data: allResults, error: allResultsError } = await sb
    .from('results')
    .select('*')
    .limit(10);

  console.log('All results (no filter, limit 10):');
  if (allResultsError) {
    console.error('  Error:', allResultsError);
  } else {
    console.log(`  ${allResults?.length || 0} rows`);
    if (allResults && allResults.length > 0) {
      console.log('  First row:', allResults[0]);
    }
  }

  // Now try with status filter (line 507)
  const { data: results, error: resultsError } = await sb
    .from('results')
    .select('gameweek,match_key,home_score,away_score,status')
    .eq('status', 'finished')
    .limit(5000);

  console.log('\nResults (status=finished):');

  if (resultsError) {
    console.error('Results query error:', resultsError);
  } else {
    console.log(`Results: ${results?.length || 0} rows`);

    // Group by gameweek
    const byGW = {};
    (results || []).forEach(r => {
      if (!byGW[r.gameweek]) byGW[r.gameweek] = 0;
      byGW[r.gameweek]++;
    });

    console.log('Results by gameweek:');
    Object.keys(byGW).sort((a, b) => a - b).forEach(gw => {
      console.log(`  GW${gw}: ${byGW[gw]} fixtures`);
    });
  }

  // Check predictions (line 508)
  const { data: predictions, error: predsError } = await sb
    .from('predictions')
    .select('user_id,gameweek,match_key,home_score,away_score')
    .limit(10000);

  if (predsError) {
    console.error('Predictions query error:', predsError);
  } else {
    console.log(`\nPredictions: ${predictions?.length || 0} rows`);

    // Count GW29 predictions
    const gw29 = (predictions || []).filter(p => p.gameweek === 29);
    console.log(`GW29 predictions: ${gw29.length} rows`);
  }

  // Check profiles (line 509)
  const { data: profiles, error: profilesError } = await sb
    .from('profiles')
    .select('id,player_name');

  if (profilesError) {
    console.error('Profiles query error:', profilesError);
  } else {
    console.log(`\nProfiles: ${profiles?.length || 0} rows`);
    if (profiles) {
      profiles.forEach(p => console.log(`  ${p.player_name}`));
    }
  }
}

checkData().catch(console.error).finally(() => process.exit(0));
