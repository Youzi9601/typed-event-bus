#!/usr/bin/env node
/**
 * Performance budget check script
 * Fails if bundle size exceeds threshold
 * Pure Node implementation (zlib.gzipSync) — no Unix gzip/wc dependency.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET = {
  esm: 2520,
  cjs: 2520,
};

function getGzipSize(filePath) {
  try {
    return gzipSync(readFileSync(filePath)).byteLength;
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
