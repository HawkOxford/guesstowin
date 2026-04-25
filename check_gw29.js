// Quick script to check GW29 data using fetch
const SUPABASE_URL = 'https://iufbdwsmbwrtcqzkvyey.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZmJkd3NtYndydGNxemt2eWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTg2MzcsImV4cCI6MjA5MDE5NDYzN30.Q3B-7qr4xWcGpa1UJWKSAd1iu6_-WHaiDcPV4HJ8SNk';

async function query(table, params) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
}

async function checkGW29() {
  console.log('\n=== CHECKING DATABASE STATE ===\n');

  // Check table row counts
  const tables = ['results', 'predictions', 'profiles'];
  for (let table of tables) {
    const data = await query(table, 'select=id&limit=5000');
    console.log(`${table}: ${Array.isArray(data) ? data.length : 'ERROR'} rows`);
  }

  console.log('\n=== CHECKING GW DATA ===\n');

  // Check what gameweeks actually have data
  const allResults = await query('results', 'select=gameweek&limit=1000');
  if (Array.isArray(allResults)) {
    const gws = [...new Set(allResults.map(r => r.gameweek))].sort((a, b) => a - b);
    console.log(`Gameweeks with results data: ${gws.join(', ')}`);
    console.log(`Highest GW: ${Math.max(...gws)}`);
    console.log(`Total results rows: ${allResults.length}`);
  }

  // Check results for GW26, 27, 28, 29, 30
  for (let gw of [26, 27, 28, 29, 30]) {
    const data = await query('results', `gameweek=eq.${gw}&order=match_key`);
    if (Array.isArray(data)) {
      console.log(`\n--- GW${gw}: ${data.length} fixtures ---`);
      data.forEach(r => {
        console.log(`  ${r.match_key}: ${r.home_score}-${r.away_score} (${r.status})`);
      });
    } else {
      console.log(`\n--- GW${gw}: ERROR ---`);
      console.log(JSON.stringify(data, null, 2));
    }
  }

  // Check how many predictions exist for GW29
  const preds = await query('predictions', 'gameweek=eq.29&select=user_id,match_key,home_score,away_score');
  console.log(`\n--- GW29 Predictions: ${preds.length} total ---`);

  // Group by match_key
  const byMatch = {};
  preds.forEach(p => {
    if (!byMatch[p.match_key]) byMatch[p.match_key] = 0;
    byMatch[p.match_key]++;
  });
  Object.entries(byMatch).forEach(([match, count]) => {
    console.log(`  ${match}: ${count} predictions`);
  });
}

checkGW29().catch(console.error);
