import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const Range = require('../range.js');
const catalog = JSON.parse(fs.readFileSync(new URL('../catalog.json', import.meta.url), 'utf8'));

// Front-image and garment-copy evidence for the original 20.
// Men only where the front photograph shows a man and the piece is not a dress, gown, skirt, or corset.
// Halo Puffer's front image is not a clear men's presentation, so it is not labelled men.
const MEN = {
  'alloy-bomber': 'front image shows a man in the cropped silver bomber',
  'prism-trench': 'front image shows a man in the holographic trench',
  'chrome-cloud-gilet': 'front image shows a man wearing the chrome gilet',
  'fold-shirt': 'front image shows a man in the origami shirt',
  'grid-overshirt': 'front image shows a man in the quilted overshirt',
  'helix-exosuit': 'front image shows a man in the bodysuit'
};
const WOMEN_GARMENT = {
  'exo-bodice': 'copy: corset over a gathered skirt',
  'signal-dress': 'copy: column dress',
  'strata-dress': 'copy: midi dress',
  'mercury-gown': 'copy: floor-length gown'
};

test('original 20 stay in the catalogue, classified, and fully illustrated', () => {
  assert.deepEqual(catalog.map(piece => piece.id), Range.ORIGINAL_IDS);
  for (const piece of catalog) {
    assert.equal(piece.collection, 'fashion', piece.id);
    assert.ok(piece.gender === 'women' || piece.gender === 'men', piece.id);
    if (MEN[piece.id]) assert.equal(piece.gender, 'men', MEN[piece.id]);
    else assert.equal(piece.gender, 'women', piece.id);
    const dir = new URL('../' + piece.dir + '/', import.meta.url);
    for (const angle of Range.ANGLES) assert.ok(fs.statSync(new URL(angle + '.webp', dir)).size > 2048, piece.id + ' ' + angle);
    for (let i = 1; i <= 24; i++) {
      const frame = `t${String(i).padStart(2, '0')}.webp`;
      assert.ok(fs.statSync(new URL(frame, dir)).size > 2048, piece.id + ' ' + frame);
    }
    assert.ok(fs.statSync(new URL('show.mp4', dir)).size > 20000, piece.id + ' video');
    assert.ok(fs.statSync(new URL('show.jpg', dir)).size > 2048, piece.id + ' poster');
    assert.equal(piece.swing, undefined, piece.id);
  }
  assert.equal(catalog.filter(piece => piece.gender === 'men').length, Object.keys(MEN).length);
  for (const id of Object.keys(WOMEN_GARMENT)) {
    assert.equal(catalog.find(piece => piece.id === id).gender, 'women', WOMEN_GARMENT[id]);
  }
});

test('filters combine, and golf is empty until real pieces arrive', () => {
  const all = {tier: 'all', gender: 'all', collection: 'all'};
  assert.equal(Range.optionCount(catalog, 'gender', 'all', all), 20);
  assert.equal(Range.optionCount(catalog, 'gender', 'women', all), 14);
  assert.equal(Range.optionCount(catalog, 'gender', 'men', all), 6);
  assert.equal(Range.optionCount(catalog, 'collection', 'golf', all), 0);
  assert.equal(Range.optionCount(catalog, 'collection', 'fashion', all), 20);
  assert.equal(catalog.filter(piece => Range.pieceMatches(piece, {tier: 'all', gender: 'men', collection: 'golf'})).length, 0);
  assert.equal(catalog.filter(piece => Range.pieceMatches(piece, {tier: 'all', gender: 'women', collection: 'golf'})).length, 0);
  assert.deepEqual(
    catalog.filter(piece => Range.pieceMatches(piece, {tier: 'everyday', gender: 'men', collection: 'fashion'})).map(piece => piece.id),
    ['fold-shirt']
  );
  assert.deepEqual(
    catalog.filter(piece => Range.pieceMatches(piece, {tier: 'inbetween', gender: 'men', collection: 'all'})).map(piece => piece.id),
    ['grid-overshirt']
  );
  assert.deepEqual(
    catalog.filter(piece => Range.pieceMatches(piece, {tier: 'futuristic', gender: 'men', collection: 'fashion'})).map(piece => piece.id).sort(),
    ['alloy-bomber', 'chrome-cloud-gilet', 'helix-exosuit', 'prism-trench']
  );
  assert.equal(catalog.filter(piece => Range.pieceMatches(piece, {tier: 'everyday', gender: 'women', collection: 'fashion'})).length, 3);
});

test('a fixture catalogue can combine men and golf without publishing it', () => {
  const fixture = [
    {id: 'a', tier: 'everyday', gender: 'men', collection: 'golf'},
    {id: 'b', tier: 'everyday', gender: 'women', collection: 'golf'},
    {id: 'c', tier: 'futuristic', gender: 'men', collection: 'fashion'},
    {id: 'd', tier: 'inbetween', gender: 'women', collection: 'fashion'}
  ];
  const ids = sel => fixture.filter(piece => Range.pieceMatches(piece, sel)).map(piece => piece.id);
  assert.deepEqual(ids({tier: 'all', gender: 'all', collection: 'all'}), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids({tier: 'all', gender: 'men', collection: 'all'}), ['a', 'c']);
  assert.deepEqual(ids({tier: 'all', gender: 'all', collection: 'golf'}), ['a', 'b']);
  assert.deepEqual(ids({tier: 'all', gender: 'men', collection: 'golf'}), ['a']);
  assert.deepEqual(ids({tier: 'all', gender: 'women', collection: 'golf'}), ['b']);
  assert.deepEqual(ids({tier: 'everyday', gender: 'women', collection: 'golf'}), ['b']);
  assert.deepEqual(ids({tier: 'futuristic', gender: 'men', collection: 'golf'}), []);
});

test('golf opens on the swing video, and turntables are described as stills', () => {
  const halo = catalog.find(piece => piece.id === 'halo-puffer');
  const seam = catalog.find(piece => piece.id === 'seam-hoodie');
  assert.equal(Range.defaultMode(halo), 'try');
  assert.equal(Range.defaultMode(seam), 'views');
  const golf = {id: 'fixture-golf', collection: 'golf', frames: 24, video: true};
  const plan = Range.mediaPlan(golf);
  assert.equal(plan.mode, 'video');
  assert.equal(plan.tabs.find(tab => tab.id === 'video').label, 'Swing');
  assert.equal(plan.videoLabel, 'Swing · showcase');
  assert.match(plan.turntableNote, /not a true 3D model/);
  assert.equal(plan.tabs.find(tab => tab.id === '3d').label, 'Turntable');
});

test('performance lines stay design intent and UPF numbers are dropped', () => {
  const intent = Range.designIntent(['Ease through the swing', 'UPF 50 sun claim', '']);
  assert.deepEqual(intent.features, ['Ease through the swing']);
  assert.deepEqual(intent.omitted, ['UPF 50 sun claim']);
});
