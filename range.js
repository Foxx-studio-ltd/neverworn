// Range filters and catalogue helpers. Shared by the page and the ingest script.
(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Range = api;
})(function () {
  const TIERS = [['all', 'All'], ['everyday', 'Everyday'], ['inbetween', 'In-between'], ['futuristic', 'Futuristic']];
  const GENDERS = [['all', 'All'], ['women', 'Women'], ['men', 'Men']];
  const COLLECTIONS = [['all', 'All'], ['fashion', 'Fashion'], ['golf', 'Golf']];
  const FILTERS = [['gender', 'Who', GENDERS], ['collection', 'Collection', COLLECTIONS], ['tier', 'Tier', TIERS]];
  const TIER_LABEL = {everyday: 'Everyday', inbetween: 'In-between', futuristic: 'Futuristic'};
  const GENDER_LABEL = {women: 'Women', men: 'Men'};
  const COLLECTION_LABEL = {fashion: 'Fashion', golf: 'Golf'};
  // The original Drop 01 ids. Ingest may append pieces; it must not remove these.
  const ORIGINAL_IDS = [
    'halo-puffer', 'alloy-bomber', 'orbit-flightsuit', 'prism-trench', 'exo-bodice',
    'chrome-cloud-gilet', 'pagoda-suit', 'signal-dress', 'seam-hoodie', 'fold-shirt',
    'arc-jeans', 'ripple-knit', 'vector-parka', 'lumen-blazer', 'strata-dress',
    'grid-overshirt', 'nebula-cape', 'coral-shell', 'mercury-gown', 'helix-exosuit'
  ];
  const ANGLES = ['front', '3q', 'side', 'back', 'detail'];
  const UPF = /\bUPF\b|\bultraviolet protection factor\b/i;

  function pieceMatches(piece, sel) {
    const tier = (sel && sel.tier) || 'all';
    const gender = (sel && sel.gender) || 'all';
    const collection = (sel && sel.collection) || 'all';
    if (tier !== 'all' && piece.tier !== tier) return false;
    if (gender !== 'all' && piece.gender !== gender) return false;
    if (collection !== 'all' && piece.collection !== collection) return false;
    return true;
  }

  function optionCount(catalog, group, value, sel) {
    const next = Object.assign({tier: 'all', gender: 'all', collection: 'all'}, sel, {[group]: value});
    return catalog.filter(piece => pieceMatches(piece, next)).length;
  }

  function defaultMode(piece) {
    if (piece && piece.collection === 'golf') return 'video';
    if (piece && piece.video) return 'try';
    return 'views';
  }

  function mediaPlan(piece) {
    const mode = defaultMode(piece);
    const tabs = [];
    if (piece.video) tabs.push({id: 'try', label: 'Try on'});
    tabs.push({id: 'views', label: 'Views'});
    tabs.push({id: '3d', label: 'Turntable'});
    tabs.push({id: 'video', label: piece.collection === 'golf' ? 'Swing' : 'Video'});
    return {
      mode,
      tabs,
      videoLabel: piece.collection === 'golf' ? 'Swing · showcase' : 'Showcase · AI-generated model',
      turntableLabel: 'Turntable · not true 3D',
      turntableNote: `360° turntable from ${piece.frames || 24} frames. Drag sideways to spin. This is a sequence of stills, not a true 3D model.`
    };
  }

  function emptyCopy(sel) {
    const gender = (sel && sel.gender) || 'all';
    const collection = (sel && sel.collection) || 'all';
    if (collection === 'golf') {
      const who = gender === 'men' ? "Men's golf" : gender === 'women' ? "Women's golf" : 'Golf';
      return who + ' will show here when each piece has its gallery, turntable, and swing video in the catalogue. Nothing is listed until those files are in place.';
    }
    if (gender === 'men') return 'No men’s pieces in this tier yet. The current men’s cards are only pieces whose photographs show them worn by men.';
    return 'No pieces match these filters.';
  }

  function designIntent(features) {
    const kept = [];
    const omitted = [];
    for (const raw of features || []) {
      const text = String(raw || '').trim();
      if (!text) continue;
      if (UPF.test(text)) { omitted.push(text); continue; }
      kept.push(text);
    }
    return {features: kept, omitted};
  }

  function genderLabel(value) { return GENDER_LABEL[value] || ''; }
  function collectionLabel(value) { return COLLECTION_LABEL[value] || ''; }
  function tierLabel(value) { return TIER_LABEL[value] || ''; }

  return {
    FILTERS, TIERS, GENDERS, COLLECTIONS, TIER_LABEL, ORIGINAL_IDS, ANGLES, UPF,
    pieceMatches, optionCount, defaultMode, mediaPlan, emptyCopy, designIntent,
    genderLabel, collectionLabel, tierLabel
  };
});
