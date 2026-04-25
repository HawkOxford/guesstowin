// Check what tables exist in Supabase
const SUPABASE_URL = 'https://iufbdwsmbwrtcqzkvyey.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZmJkd3NtYndydGNxemt2eWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTg2MzcsImV4cCI6MjA5MDE5NDYzN30.Q3B-7qr4xWcGpa1UJWKSAd1iu6_-WHaiDcPV4HJ8SNk';

async function checkTables() {
  console.log('\n=== TESTING SUPABASE CONNECTION ===\n');

  // Try different table names
  const tableNames = ['results', 'predictions', 'profiles', 'Results', 'Predictions', 'Profiles'];

  for (let table of tableNames) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`;
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (response.ok) {
      console.log(`✓ Table '${table}' exists: ${Array.isArray(data) ? data.length : 'not array'} rows (first row)`);
      if (Array.isArray(data) && data.length > 0) {
        console.log(`  Columns: ${Object.keys(data[0]).join(', ')}`);
      }
    } else {
      console.log(`✗ Table '${table}': ${data.message || 'error'}`);
    }
  }

  // Try to get actual row counts
  console.log('\n=== ROW COUNTS (if tables exist) ===\n');
  for (let table of ['results', 'predictions', 'profiles']) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=count`;
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    });

    const count = response.headers.get('content-range');
    console.log(`${table}: ${count || 'unknown'}`);
  }
}

checkTables().catch(console.error);
