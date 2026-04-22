import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // POST: Sync results to database
    if (req.method === 'POST' && action === 'sync-results') {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        throw new Error('Missing Supabase environment variables');
      }

      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const body = await req.json();
      const results = body.results || [];

      if (results.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No results provided' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Upsert results to database
      const { error } = await supabase
        .from('results')
        .upsert(results, { onConflict: 'gameweek,match_key' });

      if (error) {
        console.error('Error upserting results:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, count: results.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET: Proxy football-data.org API
    const path = url.searchParams.get('path');
    const query = url.searchParams.get('query');

    if (!path) {
      return new Response(
        JSON.stringify({ error: 'Missing path parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const FOOTBALL_API_KEY = Deno.env.get('FOOTBALL_DATA_TOKEN');

    if (!FOOTBALL_API_KEY) {
      throw new Error('FOOTBALL_DATA_TOKEN not set in environment');
    }

    // Build football-data.org API URL
    const apiUrl = `https://api.football-data.org${path}${query ? '?' + query : ''}`;

    // Fetch from football-data.org
    const response = await fetch(apiUrl, {
      headers: {
        'X-Auth-Token': FOOTBALL_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Football API error:', response.status, errorText);
      return new Response(
        JSON.stringify({
          error: 'Football API error',
          status: response.status,
          message: errorText
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
