// Test RLS by trying authenticated vs unauthenticated queries
const SUPABASE_URL = 'https://iufbdwsmbwrtcqzkvyey.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZmJkd3NtYndydGNxemt2eWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTg2MzcsImV4cCI6MjA5MDE5NDYzN30.Q3B-7qr4xWcGpa1UJWKSAd1iu6_-WHaiDcPV4HJ8SNk';

async function testRLS() {
  console.log('\n=== TESTING RLS PERMISSIONS ===\n');

  // Test without auth
  const url1 = `${SUPABASE_URL}/rest/v1/results?gameweek=eq.27&limit=5`;
  const response1 = await fetch(url1, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json'
    }
  });
  const data1 = await response1.json();
  console.log('Without Authorization header:');
  console.log(`  Status: ${response1.status}`);
  console.log(`  Rows: ${Array.isArray(data1) ? data1.length : 'error'}`);
  if (Array.isArray(data1) && data1.length > 0) {
    console.log(`  First row: ${data1[0].match_key}`);
  } else {
    console.log(`  Response: ${JSON.stringify(data1)}`);
  }

  // Test with auth header
  const response2 = await fetch(url1, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  const data2 = await response2.json();
  console.log('\nWith Authorization header:');
  console.log(`  Status: ${response2.status}`);
  console.log(`  Rows: ${Array.isArray(data2) ? data2.length : 'error'}`);
  if (Array.isArray(data2) && data2.length > 0) {
    console.log(`  First row: ${data2[0].match_key}`);
  } else {
    console.log(`  Response: ${JSON.stringify(data2)}`);
  }

  console.log('\n=== CONCLUSION ===');
  if (Array.isArray(data2) && data2.length > 0) {
    console.log('✓ Data exists and is readable with auth header');
    console.log('✓ RLS policies allow authenticated (anon role) access');
  } else {
    console.log('✗ Data not readable even with auth header');
    console.log('✗ RLS policies may be blocking anon role');
  }
}

testRLS().catch(console.error);
