#!/usr/bin/env node
// Minimal env-sync placeholder: scans for common env keys and ensures .env.example exists
const fs = require('fs');
const path = require('path');

const example = path.resolve(process.cwd(), '.env.example');
if (!fs.existsSync(example)) {
  fs.writeFileSync(example, '# Add environment variables here\n');
  console.log('.env.example created (placeholder)');
} else {
  console.log('.env.example exists');
}
