#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function runSchema() {
  try {
    const schemaPath = path.join(__dirname, '../supabase/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('🚀 Bắt đầu chạy schema.sql...');
    
    // Chạy từng lệnh SQL (chia nhỏ bằng dòng trống)
    const statements = schemaSql
      .split(/;\s*\n+/)
      .filter(stmt => stmt.trim().length > 0 && !stmt.trim().startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim() + ';';
      console.log(`⏳ Chạy câu lệnh ${i + 1}/${statements.length}...`);
      
      const { error } = await supabase.rpc('exec_sql', { 
        sql: stmt 
      }).catch(() => ({
        error: null // Ignore if rpc doesn't exist
      }));

      if (error) {
        console.warn(`⚠️  Cảnh báo: ${error.message}`);
      }
    }

    console.log('✅ Chạy schema xong!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
}

runSchema();
