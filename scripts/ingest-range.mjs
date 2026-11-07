#!/usr/bin/env node
// Merge forthcoming range metadata into catalog.json.
// Refuses to write when a new piece is missing a gallery angle, a turntable
// frame, or its showcase video, and never removes the original 20 pieces.
// Usage:
//   node scripts/ingest-range.mjs --metadata metadata.json [--root .] [--catalog catalog.json] [--write]
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const Range = require('../range.js');

const MIN_IMAGE = 2048;
const MIN_VIDEO = 20000;
const FRAME_COUNT = 24;

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1];
}

export function normaliseTier(value) {
  const v = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (v === 'everyday') return 'everyday';
  if (v === 'futuristic') return 'futuristic';
  if (v === 'inbetween' || v === 'in-between') return 'inbetween';
  return '';
}

export function normaliseGender(value) {
  const v = String(value || '').trim().toLowerCase();
  if (['men', 'mens', "men's", 'male', 'man'].includes(v)) return 'men';
  if (['women', 'womens', "women's", 'female', 'woman'].includes(v)) return 'women';
  return '';
}

export function normaliseCollection(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'golf') return 'golf';
  if (v === 'fashion' || v === 'menswear' || v === 'womenswear') return 'fashion';
  return '';
}

function asList(value) {
  if (Array.isArray(value)) return value.map(item => String(item));
  if (value == null || value === '') return [];
  return String(value).split(/\n|;\s*/).map(item => item.trim()).filter(Boolean);
}

function readMetadata(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.pieces)) return data.pieces;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.products)) return data.products;
  throw new Error('metadata.json must be an array, or an object with pieces, items, or products');
}

export function toCatalogPiece(raw) {
  const id = String(raw.id || raw.slug || '').trim();
  const gender = normaliseGender(raw.gender);
  const collection = normaliseCollection(raw.collection);
  const tier = normaliseTier(raw.tier);
  const price = Number(raw.priceGBP ?? raw.price_gbp ?? raw.price);
  const note = String(raw.description || raw.note || '').trim();
  const assetId = raw.assetId ?? raw.asset_id ?? raw.folder;
  const dir = String(raw.dir || raw.assetDir || raw.assets?.dir || (assetId != null ? `assets/p/${String(assetId).padStart(2, '0')}` : '')).replace(/\/$/, '');
  const intent = Range.designIntent(asList(raw.designFeatures ?? raw.design_features ?? raw.features));
  const errors = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) errors.push('id must be a lowercase slug');
  if (Range.ORIGINAL_IDS.includes(id)) errors.push('id belongs to the original 20 and cannot be replaced');
  if (!String(raw.name || '').trim()) errors.push('name is required');
  if (!gender) errors.push('gender must be men or women');
  if (!collection) errors.push('collection must be fashion or golf');
  if (!tier) errors.push('tier must be everyday, in-between, or futuristic');
  if (!Number.isFinite(price) || price <= 0) errors.push('priceGBP must be a positive number');
  if (!note) errors.push('description is required');
  if (!/^assets\/p\/\d{2}$/.test(dir)) errors.push('dir must look like assets/p/21');
  const folder = Number(dir.slice('assets/p/'.length));
  if (folder < 21 || folder > 40) errors.push('new pieces use asset folders 21–40 so the original 01–20 stay put');
  return {
    errors,
    omittedRatings: intent.omitted,
    piece: {
      id,
      name: String(raw.name || '').trim(),
      price,
      img: `${dir}/front.webp`,
      note,
      tags: asList(raw.tags).filter(tag => !Range.UPF.test(tag)).slice(0, 8),
      days: Number(raw.days) > 0 ? Number(raw.days) : 14,
      tier,
      gender,
      collection,
      dir,
      frames: FRAME_COUNT,
      ...(intent.features.length ? {features: intent.features} : {}),
      ...(collection === 'golf' ? {swing: true} : {})
    }
  };
}

function expectedFiles(dir) {
  const files = Range.ANGLES.map(angle => `${dir}/${angle}.webp`);
  for (let i = 1; i <= FRAME_COUNT; i++) files.push(`${dir}/t${String(i).padStart(2, '0')}.webp`);
  files.push(`${dir}/show.mp4`, `${dir}/show.jpg`);
  return files;
}

export function missingAssets(root, piece) {
  const missing = [];
  for (const rel of expectedFiles(piece.dir)) {
    const file = path.join(root, rel);
    let size = -1;
    try { size = fs.statSync(file).size; } catch { missing.push(`${rel} (missing)`); continue; }
    const min = rel.endsWith('.mp4') ? MIN_VIDEO : rel.endsWith('.jpg') || rel.endsWith('.webp') ? MIN_IMAGE : MIN_IMAGE;
    if (size < min) missing.push(`${rel} (${size} bytes, needs at least ${min})`);
  }
  return missing;
}

export function ingest({metadataFile, root, catalogFile, write}) {
  const incoming = readMetadata(metadataFile);
  const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  const original = catalog.filter(piece => Range.ORIGINAL_IDS.includes(piece.id));
  if (original.length !== Range.ORIGINAL_IDS.length) {
    throw new Error(`catalog is missing original pieces: expected ${Range.ORIGINAL_IDS.length}, found ${original.length}`);
  }
  const errors = [];
  const pieces = [];
  const seen = new Set(Range.ORIGINAL_IDS);
  const omittedRatings = [];
  for (const raw of incoming) {
    const built = toCatalogPiece(raw);
    if (built.errors.length) {
      errors.push(`${raw.id || raw.slug || '(no id)'}: ${built.errors.join('; ')}`);
      continue;
    }
    if (seen.has(built.piece.id)) {
      errors.push(`${built.piece.id}: duplicate id`);
      continue;
    }
    seen.add(built.piece.id);
    const missing = missingAssets(root, built.piece);
    if (missing.length) errors.push(`${built.piece.id}: ${missing.join(', ')}`);
    else pieces.push(built.piece);
    if (built.omittedRatings.length) omittedRatings.push({id: built.piece.id, omitted: built.omittedRatings});
  }
  const report = {ok: errors.length === 0, added: pieces.map(piece => piece.id), errors, omittedRatings, kept: original.length};
  if (!report.ok) return report;
  if (write) {
    const next = original.concat(pieces);
    fs.writeFileSync(catalogFile, JSON.stringify(next, null, 2) + '\n');
    report.wrote = catalogFile;
  }
  return report;
}

const isMain = process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href || process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const metadataFile = arg('--metadata');
  if (!metadataFile) {
    console.error('Pass --metadata metadata.json. No catalogue change was made.');
    process.exit(2);
  }
  const root = path.resolve(arg('--root', '.'));
  const catalogFile = path.resolve(arg('--catalog', 'catalog.json'));
  const write = process.argv.includes('--write');
  try {
    const report = ingest({metadataFile: path.resolve(metadataFile), root, catalogFile, write});
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
