import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log("Testing Supabase connection...");
console.log("URL:", url);
console.log("Key (first 20 chars):", key?.substring(0, 20));

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.from("assignments").select("*").limit(1);
  
  if (error) {
    console.error("❌ Connection error:", error);
  } else {
    console.log("✅ Connected! Data:", data);
  }
}

test();
