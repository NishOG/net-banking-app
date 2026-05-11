import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim();
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Fetching a transaction to check columns...");
  
  const { data, error } = await supabase.from('transactions').select('*').limit(1);

  if (error) {
    console.log("Error:", error);
  } else {
    console.log("Columns:", Object.keys(data[0] || {}));
  }
}

test();
