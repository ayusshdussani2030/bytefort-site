// setup.js — Create KV namespace for maintenance mode
// Run: npx wranglerkv namespace create bytefort-maint

// If you already have a KV namespace, skip this and just update wrangler.toml
// with your namespace ID.

const { execSync } = require('child_process');

try {
  console.log('Creating KV namespace...');
  const result = execSync('npx wrangler kv:namespace create BYTEFORT_MAINT', { encoding: 'utf8' });
  const match = result.match(/id\s*=\s*"?([a-f0-9]{32})"?/i);
  if (match) {
    console.log('\n✅ Created!');
    console.log('\nUpdate your wrangler.toml with this ID:');
    console.log(`\n[kv_namespaces]
  { binding = "BYTEFORT_MAINT", id = "${match[1]}", preview_id = "${match[1]}" }`);
  } else {
    console.log('Output:', result);
    console.log('\nCopy the namespace ID from the output and add it to wrangler.toml');
  }
} catch (e) {
  console.log('Error:', e.message);
  console.log('\nIf you already have a KV namespace, update wrangler.toml manually.');
}
