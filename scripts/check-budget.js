#!/usr/bin/env node
/**
 * Performance budget check script
 * Fails if bundle size exceeds threshold
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const BUDGET = {
  esm: 2500,
  cjs: 2500,
};

function getGzipSize(filePath) {
  try {
    const output = execSync(`gzip -c "${filePath}" | wc -c`, { encoding: 'utf-8' }).trim();
    return Number.parseInt(output, 10);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

const distDir = resolve(process.cwd(), 'dist');
const files = {
  esm: resolve(distDir, 'index.js'),
  cjs: resolve(distDir, 'index.cjs'),
};

let hasError = false;

for (const [key, filePath] of Object.entries(files)) {
  if (!existsSync(filePath)) {
    console.error(`❌ ${key}: File not found: ${filePath}`);
    hasError = true;
    continue;
  }

  const size = getGzipSize(filePath);
  const budget = BUDGET[key];

  if (size > budget) {
    console.error(`❌ ${key}: ${size} bytes gzipped (budget: ${budget} bytes)`);
    hasError = true;
  } else {
    console.info(`✅ ${key}: ${size} bytes gzipped (budget: ${budget} bytes)`);
  }
}

if (hasError) {
  console.error('\n🚫 Bundle size budget exceeded!');
  process.exit(1);
} else {
  console.info('\n✅ All bundle sizes within budget');
  process.exit(0);
}
