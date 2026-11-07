import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ingest, toCatalogPiece} from '../scripts/ingest-range.mjs';

const ORIGINAL = JSON.parse(fs.readFileSync(new URL('../catalog.json', import.meta.url), 'utf8'));

function writePieceFiles(root, dir) {
  fs.mkdirSync(path.join(root, dir), {recursive: true});
  const angles = ['front', '3q', 'side', 'back', 'detail'];
  for (const angle of angles) fs.writeFileSync(path.join(root, dir, angle + '.webp'), Buffer.alloc(3000, 1));
  for (let i = 1; i <= 24; i++) fs.writeFileSync(path.join(root, dir, `t${String(i).padStart(2, '0')}.webp`), Buffer.alloc(3000, 1));
  fs.writeFileSync(path.join(root, dir, 'show.jpg'), Buffer.alloc(3000, 1));
  fs.writeFileSync(path.join(root, dir, 'show.mp4'), Buffer.alloc(21000, 1));
}

function metadata(pieces) {
  return {pieces};
}

test('a complete golf piece can be staged, and an incomplete one cannot', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-ingest-'));
  const catalogFile = path.join(root, 'catalog.json');
  fs.writeFileSync(catalogFile, JSON.stringify(ORIGINAL));
  writePieceFiles(root, 'assets/p/21');
  fs.mkdirSync(path.join(root, 'assets/p/22'), {recursive: true});
  const meta = path.join(root, 'metadata.json');
  fs.writeFileSync(meta, JSON.stringify(metadata([
    {
      slug: 'fairway-polo',
      name: 'Fairway Polo',
      gender: 'male',
      collection: 'golf',
      tier: 'in-between',
      priceGBP: 140,
      description: 'A polo cut to move through a swing.',
      designFeatures: ['Shoulder ease', 'UPF 40 claim we must not publish'],
      assetId: 21,
      tags: ['golf', 'polo']
    },
    {
      id: 'missing-skirt',
      name: 'Missing Skirt',
      gender: 'women',
      collection: 'golf',
      tier: 'everyday',
      price_gbp: 160,
      note: 'Listed before its files exist.',
      dir: 'assets/p/22'
    }
  ])));
  const refused = ingest({metadataFile: meta, root, catalogFile, write: true});
  assert.equal(refused.ok, false);
  assert.match(refused.errors.join('\n'), /missing-skirt/);
  assert.equal(JSON.parse(fs.readFileSync(catalogFile, 'utf8')).length, 20);

  const only = path.join(root, 'one.json');
  fs.writeFileSync(only, JSON.stringify(metadata([JSON.parse(fs.readFileSync(meta, 'utf8')).pieces[0]])));
  const accepted = ingest({metadataFile: only, root, catalogFile, write: true});
  assert.equal(accepted.ok, true, accepted.errors.join('\n'));
  assert.deepEqual(accepted.added, ['fairway-polo']);
  const next = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  assert.equal(next.length, 21);
  assert.deepEqual(next.slice(0, 20).map(piece => piece.id), ORIGINAL.map(piece => piece.id));
  const polo = next[20];
  assert.equal(polo.gender, 'men');
  assert.equal(polo.collection, 'golf');
  assert.equal(polo.tier, 'inbetween');
  assert.equal(polo.price, 140);
  assert.equal(polo.swing, true);
  assert.equal(polo.dir, 'assets/p/21');
  assert.deepEqual(polo.features, ['Shoulder ease']);
  assert.equal(polo.frames, 24);
  fs.rmSync(root, {recursive: true, force: true});
});

test('folders 01–20 and original ids are refused', () => {
  const early = toCatalogPiece({
    id: 'halo-puffer', name: 'Replacement', gender: 'men', collection: 'fashion', tier: 'everyday',
    priceGBP: 10, description: 'Should not replace the puffer.', dir: 'assets/p/21'
  });
  assert.ok(early.errors.some(error => /original 20/.test(error)));
  const folder = toCatalogPiece({
    id: 'new-coat', name: 'New Coat', gender: 'women', collection: 'fashion', tier: 'everyday',
    priceGBP: 10, description: 'Wrong folder.', dir: 'assets/p/04'
  });
  assert.ok(folder.errors.some(error => /21–40/.test(error)));
});
