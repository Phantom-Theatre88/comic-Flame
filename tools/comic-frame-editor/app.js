const NS = 'http://www.w3.org/2000/svg';
const PAPER = {
  B5: [182, 257], A4: [210, 297], B4: [257, 364], A3: [297, 420], B6: [128, 182]
};

const DB_NAME = 'mangaPanelDesignerV1';
const DB_STORE = 'projects';
const DB_KEY = 'currentProject';

const state = {
  paperSize: 'B5', orientation: 'portrait', spreadMode: 'single', safeMargin: 12, bleed: 3,
  showSafe: true, showBleed: true, showGrid: false, showSnapGuides: true,
  snap: true, gapX: 4, gapY: 4, snapThreshold: 3,
  panels: [], selectedId: null, nextId: 1, drag: null,
  snapGuides: [], reference: null,
  pages: [], currentPageId: 1, pageSeq: 2,
  imageEditMode: false
};

const $ = id => document.getElementById(id);
const canvas = $('canvas');

function cloneData(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
function round01(v) { return Math.round(v * 10) / 10; }
function fmt(v) { return `${round01(v)}`; }
function safeFileName(s) { return (s || 'manga-panels').replace(/[\\/:*?"<>|]/g, '_'); }
function escapeXml(s = '') { return String(s).replace(/[<>&'\"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c])); }
function panelById(id) { return state.panels.find(p => p.id === id); }
function currentPage() { return state.pages.find(p => p.id === state.currentPageId); }

function paperDimensions() {
  let [w, h] = PAPER[state.paperSize];
  if (state.orientation === 'landscape') [w, h] = [h, w];
  if (state.spreadMode === 'spread') w *= 2;
  return { w, h };
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

function bbox(points) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, minX, maxX, minY, maxY };
}
function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}
function centroid(points) {
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length
  };
}
function pointInPolygon(point, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || 0.000001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function markDirty() {
  const el = $('saveStatus');
  el.textContent = '未保存の変更あり';
  el.className = 'save-status dirty';
}
function markSaved(text = '保存済み') {
  const el = $('saveStatus');
  el.textContent = text;
  el.className = 'save-status saved';
}

function makeBlankPage(id, name) {
  return {
    id, name,
    paper: {
      size: state.paperSize, orientation: state.orientation, spreadMode: state.spreadMode,
      safeMargin: state.safeMargin, bleed: state.bleed
    },
    view: {
      showSafe: state.showSafe, showBleed: state.showBleed,
      showGrid: state.showGrid, showSnapGuides: state.showSnapGuides
    },
    snap: {
      enabled: state.snap, gapX: state.gapX, gapY: state.gapY, threshold: state.snapThreshold
    },
    panels: [], nextId: 1, reference: null
  };
}

function captureCurrentPage() {
  return {
    id: state.currentPageId,
    name: ($('pageName').value || currentPage()?.name || `P${state.currentPageId}`).trim(),
    paper: {
      size: state.paperSize, orientation: state.orientation, spreadMode: state.spreadMode,
      safeMargin: state.safeMargin, bleed: state.bleed
    },
    view: {
      showSafe: state.showSafe, showBleed: state.showBleed,
      showGrid: state.showGrid, showSnapGuides: state.showSnapGuides
    },
    snap: {
      enabled: state.snap, gapX: state.gapX, gapY: state.gapY, threshold: state.snapThreshold
    },
    panels: cloneData(state.panels), nextId: state.nextId,
    reference: cloneData(state.reference)
  };
}

function saveCurrentPageState() {
  const page = captureCurrentPage();
  const idx = state.pages.findIndex(p => p.id === state.currentPageId);
  if (idx >= 0) state.pages[idx] = page;
  else state.pages.push(page);
}

function applyPage(page) {
  if (!page) return;
  state.currentPageId = page.id;
  state.paperSize = page.paper?.size || 'B5';
  state.orientation = page.paper?.orientation || 'portrait';
  state.spreadMode = page.paper?.spreadMode || 'single';
  state.safeMargin = page.paper?.safeMargin ?? 12;
  state.bleed = page.paper?.bleed ?? 3;
  state.showSafe = page.view?.showSafe ?? true;
  state.showBleed = page.view?.showBleed ?? true;
  state.showGrid = page.view?.showGrid ?? false;
  state.showSnapGuides = page.view?.showSnapGuides ?? true;
  state.snap = page.snap?.enabled ?? true;
  state.gapX = page.snap?.gapX ?? 4;
  state.gapY = page.snap?.gapY ?? 4;
  state.snapThreshold = page.snap?.threshold ?? 3;
  state.panels = cloneData(page.panels || []);
  state.nextId = page.nextId || Math.max(0, ...state.panels.map(p => p.id || 0)) + 1;
  state.reference = cloneData(page.reference || null);
  state.selectedId = null;
  state.imageEditMode = false;
  $('pageName').value = page.name || `P${page.id}`;
  syncControls();
  updatePageControls();
  render();
}

function ensureInitialPage() {
  if (state.pages.length) return;
  state.pages = [makeBlankPage(1, 'P1')];
  state.currentPageId = 1;
  state.pageSeq = 2;
  $('pageName').value = 'P1';
}

function updatePageControls() {
  const select = $('pageSelect');
  const value = String(state.currentPageId);
  select.innerHTML = '';
  state.pages.forEach((page, index) => {
    const option = document.createElement('option');
    option.value = page.id;
    option.textContent = `${index + 1}. ${page.name || `P${index + 1}`}`;
    select.appendChild(option);
  });
  select.value = value;
  $('deletePageBtn').disabled = state.pages.length <= 1;
}

function addPage(duplicate = false) {
  saveCurrentPageState();
  const id = state.pageSeq++;
  let page;
  if (duplicate) {
    page = cloneData(currentPage());
    page.id = id;
    page.name = `P${state.pages.length + 1}`;
  } else {
    page = makeBlankPage(id, `P${state.pages.length + 1}`);
  }
  state.pages.push(page);
  applyPage(page);
  markDirty();
}

function deleteCurrentPage() {
  if (state.pages.length <= 1) return;
  const idx = state.pages.findIndex(p => p.id === state.currentPageId);
  state.pages.splice(idx, 1);
  const next = state.pages[Math.max(0, idx - 1)] || state.pages[0];
  applyPage(next);
  markDirty();
}

function addPanel(type = 'rect') {
  const { w, h } = paperDimensions();
  const cx = w / 2, cy = h / 2;
  let points;
  if (type === 'trap') points = [{x:cx-45,y:cy-30},{x:cx+35,y:cy-30},{x:cx+45,y:cy+30},{x:cx-35,y:cy+30}];
  else if (type === 'slant') points = [{x:cx-45,y:cy-30},{x:cx+45,y:cy-20},{x:cx+45,y:cy+30},{x:cx-45,y:cy+20}];
  else points = [{x:cx-45,y:cy-30},{x:cx+45,y:cy-30},{x:cx+45,y:cy+30},{x:cx-45,y:cy+30}];
  const id = state.nextId++;
  state.panels.push({ id, name: `P${id}`, points, image: null });
  state.selectedId = id;
  state.imageEditMode = false;
  markDirty();
  render();
}

function imageGeometry(panel) {
  if (!panel?.image) return null;
  const b = bbox(panel.points);
  const img = panel.image;
  if (!b.w || !b.h || !img.naturalW || !img.naturalH) return null;
  const imageRatio = img.naturalW / img.naturalH;
  const boxRatio = b.w / b.h;
  let baseW, baseH;
  if (imageRatio > boxRatio) {
    baseH = b.h;
    baseW = baseH * imageRatio;
  } else {
    baseW = b.w;
    baseH = baseW / imageRatio;
  }
  const scale = Math.max(0.05, img.scale || 1);
  const width = baseW * scale;
  const height = baseH * scale;
  return {
    x: b.x + b.w / 2 - width / 2 + (img.offsetX || 0),
    y: b.y + b.h / 2 - height / 2 + (img.offsetY || 0),
    width, height
  };
}

function drawGrid(w, h) {
  if (!state.showGrid) return;
  const g = svgEl('g', {'aria-hidden':'true'});
  for (let x = 5; x < w; x += 5) g.appendChild(svgEl('line', {x1:x,y1:0,x2:x,y2:h,class:'grid-line'}));
  for (let y = 5; y < h; y += 5) g.appendChild(svgEl('line', {x1:0,y1:y,x2:w,y2:y,class:'grid-line'}));
  canvas.appendChild(g);
}

function drawReference() {
  const r = state.reference;
  if (!r || !r.visible || !r.src) return;
  const image = svgEl('image', {
    href: r.src, x: r.x, y: r.y, width: r.w, height: r.h,
    opacity: r.opacity, preserveAspectRatio: 'none',
    class: `reference-image${r.locked ? ' locked' : ''}`
  });
  if (!r.locked) image.addEventListener('pointerdown', startReferenceDrag);
  canvas.appendChild(image);
}

function drawSnapGuides() {
  if (!state.showSnapGuides || !state.snapGuides.length) return;
  const { w, h } = paperDimensions();
  state.snapGuides.forEach(g => {
    if (g.axis === 'x') {
      canvas.appendChild(svgEl('line', {x1:g.value,y1:0,x2:g.value,y2:h,class:`snap-guide${g.gap?' gap':''}`}));
      if (g.label) {
        const t = svgEl('text', {x:g.value+1.2,y:7,class:'snap-label'});
        t.textContent = g.label;
        canvas.appendChild(t);
      }
    } else {
      canvas.appendChild(svgEl('line', {x1:0,y1:g.value,x2:w,y2:g.value,class:`snap-guide${g.gap?' gap':''}`}));
      if (g.label) {
        const t = svgEl('text', {x:3,y:g.value-1.2,class:'snap-label'});
        t.textContent = g.label;
        canvas.appendChild(t);
      }
    }
  });
}

function render() {
  const { w, h } = paperDimensions();
  const pad = Math.max(20, state.bleed + 15);
  canvas.setAttribute('viewBox', `${-pad} ${-pad} ${w + pad*2} ${h + pad*2}`);
  canvas.setAttribute('width', Math.max(520, w * 2.1));
  canvas.setAttribute('height', Math.max(680, h * 2.1));
  canvas.innerHTML = '';

  const defs = svgEl('defs');
  canvas.appendChild(defs);

  if (state.showBleed && state.bleed > 0) {
    canvas.appendChild(svgEl('rect', {x:-state.bleed,y:-state.bleed,width:w+state.bleed*2,height:h+state.bleed*2,class:'bleed-guide'}));
  }
  canvas.appendChild(svgEl('rect', {x:0,y:0,width:w,height:h,class:'paper'}));
  drawGrid(w, h);
  drawReference();
  if (state.showSafe && state.safeMargin > 0) {
    canvas.appendChild(svgEl('rect', {x:state.safeMargin,y:state.safeMargin,width:w-state.safeMargin*2,height:h-state.safeMargin*2,class:'safe-guide'}));
  }
  if (state.spreadMode === 'spread') canvas.appendChild(svgEl('line', {x1:w/2,y1:0,x2:w/2,y2:h,class:'gutter-guide'}));

  state.panels.forEach(panel => {
    const selected = panel.id === state.selectedId;

    if (panel.image?.src) {
      const clipId = `clip-${state.currentPageId}-${panel.id}`;
      const clip = svgEl('clipPath', {id: clipId});
      clip.appendChild(svgEl('polygon', {points: panel.points.map(p => `${p.x},${p.y}`).join(' ')}));
      defs.appendChild(clip);
      const g = imageGeometry(panel);
      if (g) {
        canvas.appendChild(svgEl('image', {
          href: panel.image.src, x:g.x, y:g.y, width:g.width, height:g.height,
          preserveAspectRatio:'none', 'clip-path':`url(#${clipId})`, class:'panel-image'
        }));
      }
    }

    const poly = svgEl('polygon', {
      points: panel.points.map(p => `${p.x},${p.y}`).join(' '),
      class: `panel-shape${selected ? ' selected' : ''}${selected && state.imageEditMode && panel.image ? ' image-edit' : ''}`,
      'data-panel-id': panel.id
    });
    poly.addEventListener('pointerdown', e => startPanelDrag(e, panel.id));
    canvas.appendChild(poly);

    const c = centroid(panel.points);
    const label = svgEl('text', {x:c.x,y:c.y,class:'panel-label'});
    label.textContent = panel.name;
    canvas.appendChild(label);

    if (selected && !state.imageEditMode) {
      panel.points.forEach((p, i) => {
        const handle = svgEl('circle', {cx:p.x,cy:p.y,r:2.8,class:'vertex-handle','data-index':i});
        handle.addEventListener('pointerdown', e => startVertexDrag(e, panel.id, i));
        canvas.appendChild(handle);
      });
      panel.points.forEach((a, i) => {
        const j = (i + 1) % panel.points.length;
        const b = panel.points[j];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const handle = svgEl('rect', {
          x:mx-2.6,y:my-2.6,width:5.2,height:5.2,rx:0.8,
          class:'edge-handle','data-edge-index':i
        });
        handle.addEventListener('pointerdown', e => startEdgeDrag(e, panel.id, i, j, {x:mx,y:my}));
        canvas.appendChild(handle);
      });
    }
  });

  drawSnapGuides();
  updateInspector();
  updateReferenceControls();
  updatePageControls();
}

function clientToSvg(e) {
  const pt = canvas.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(canvas.getScreenCTM().inverse());
}

function startPanelDrag(e, id) {
  if (e.target.classList.contains('vertex-handle') || e.target.classList.contains('edge-handle')) return;
  e.preventDefault(); e.stopPropagation();
  const wasSelected = state.selectedId === id;
  if (!wasSelected) state.imageEditMode = false;
  state.selectedId = id;
  const p = clientToSvg(e), panel = panelById(id);
  if (state.imageEditMode && wasSelected && panel.image) {
    state.drag = {
      type:'image', id, start:p,
      original:{x:panel.image.offsetX || 0, y:panel.image.offsetY || 0}
    };
  } else {
    state.drag = {type:'panel',id,start:p,original:panel.points.map(q=>({...q}))};
  }
  canvas.setPointerCapture(e.pointerId);
  render();
}
function startVertexDrag(e, id, index) {
  e.preventDefault(); e.stopPropagation();
  state.selectedId = id;
  const panel = panelById(id);
  state.drag = {type:'vertex',id,index,original:{...panel.points[index]}};
  canvas.setPointerCapture(e.pointerId);
}
function startEdgeDrag(e, id, indexA, indexB, midpoint) {
  e.preventDefault(); e.stopPropagation();
  state.selectedId = id;
  const panel = panelById(id);
  state.drag = {
    type:'edge', id, indexA, indexB, startMidpoint:midpoint,
    originalA:{...panel.points[indexA]}, originalB:{...panel.points[indexB]}
  };
  canvas.setPointerCapture(e.pointerId);
}
function startReferenceDrag(e) {
  e.preventDefault(); e.stopPropagation();
  if (!state.reference || state.reference.locked) return;
  const p = clientToSvg(e);
  state.drag = {type:'reference',start:p,original:{x:state.reference.x,y:state.reference.y}};
  canvas.setPointerCapture(e.pointerId);
}

function guidesForAxis(axis, excludeId) {
  const { w, h } = paperDimensions();
  const max = axis === 'x' ? w : h;
  const safeMin = state.safeMargin;
  const safeMax = max - state.safeMargin;
  const center = max / 2;
  const guides = [
    {value:0,label:'用紙端'}, {value:max,label:'用紙端'},
    {value:safeMin,label:'内枠'}, {value:safeMax,label:'内枠'},
    {value:center,label: axis === 'x' && state.spreadMode === 'spread' ? '中央/ノド' : '中央'}
  ];
  state.panels.filter(p => p.id !== excludeId).forEach(p => {
    const b = bbox(p.points);
    if (axis === 'x') {
      guides.push({value:b.minX,label:`${p.name}左`},{value:b.maxX,label:`${p.name}右`});
      guides.push({value:b.minX-state.gapX,label:`${state.gapX}mm`,gap:true},{value:b.maxX+state.gapX,label:`${state.gapX}mm`,gap:true});
    } else {
      guides.push({value:b.minY,label:`${p.name}上`},{value:b.maxY,label:`${p.name}下`});
      guides.push({value:b.minY-state.gapY,label:`${state.gapY}mm`,gap:true},{value:b.maxY+state.gapY,label:`${state.gapY}mm`,gap:true});
    }
  });
  return guides;
}

function nearestSnap(value, axis, excludeId, disabled = false) {
  if (!state.snap || disabled) return {value:round01(value), guide:null};
  const threshold = state.snapThreshold;
  let best = null;
  for (const g of guidesForAxis(axis, excludeId)) {
    const d = Math.abs(value - g.value);
    if (d <= threshold && (!best || d < best.d)) best = {...g,d};
  }
  return best ? {value:best.value,guide:{axis,value:best.value,label:best.label,gap:best.gap}} : {value:round01(value),guide:null};
}

function snapPanel(originalPoints, dx, dy, id, bypass) {
  const moved = originalPoints.map(q => ({x:q.x+dx,y:q.y+dy}));
  const b = bbox(moved);
  let bestX = null, bestY = null;
  if (state.snap && !bypass) {
    const xCandidates = [b.minX,b.maxX], yCandidates = [b.minY,b.maxY];
    const xGuides = guidesForAxis('x', id), yGuides = guidesForAxis('y', id);
    xCandidates.forEach(edge => xGuides.forEach(g => {
      const delta = g.value - edge, d = Math.abs(delta);
      if (d <= state.snapThreshold && (!bestX || d < bestX.d)) bestX = {delta,d,g};
    }));
    yCandidates.forEach(edge => yGuides.forEach(g => {
      const delta = g.value - edge, d = Math.abs(delta);
      if (d <= state.snapThreshold && (!bestY || d < bestY.d)) bestY = {delta,d,g};
    }));
  }
  state.snapGuides = [];
  if (bestX) state.snapGuides.push({axis:'x',value:bestX.g.value,label:bestX.g.label,gap:bestX.g.gap});
  if (bestY) state.snapGuides.push({axis:'y',value:bestY.g.value,label:bestY.g.label,gap:bestY.g.gap});
  const sx = bestX ? bestX.delta : 0, sy = bestY ? bestY.delta : 0;
  return moved.map(p => ({x:round01(p.x+sx),y:round01(p.y+sy)}));
}

function snapPoint(x, y, id, bypass) {
  const sx = nearestSnap(x, 'x', id, bypass), sy = nearestSnap(y, 'y', id, bypass);
  state.snapGuides = [sx.guide, sy.guide].filter(Boolean);
  return {x:sx.value,y:sy.value};
}

function snapEdge(originalA, originalB, dx, dy, id, bypass) {
  let a = {x:originalA.x+dx,y:originalA.y+dy};
  let b = {x:originalB.x+dx,y:originalB.y+dy};
  if (!state.snap || bypass) {
    state.snapGuides = [];
    return [{x:round01(a.x),y:round01(a.y)},{x:round01(b.x),y:round01(b.y)}];
  }
  let bestX = null, bestY = null;
  const xGuides = guidesForAxis('x', id), yGuides = guidesForAxis('y', id);
  [a.x,b.x].forEach(v => xGuides.forEach(g => {
    const delta = g.value-v, d=Math.abs(delta);
    if (d <= state.snapThreshold && (!bestX || d < bestX.d)) bestX={delta,d,g};
  }));
  [a.y,b.y].forEach(v => yGuides.forEach(g => {
    const delta = g.value-v, d=Math.abs(delta);
    if (d <= state.snapThreshold && (!bestY || d < bestY.d)) bestY={delta,d,g};
  }));
  state.snapGuides=[];
  if(bestX) state.snapGuides.push({axis:'x',value:bestX.g.value,label:bestX.g.label,gap:bestX.g.gap});
  if(bestY) state.snapGuides.push({axis:'y',value:bestY.g.value,label:bestY.g.label,gap:bestY.g.gap});
  const sx=bestX?bestX.delta:0, sy=bestY?bestY.delta:0;
  return [
    {x:round01(a.x+sx),y:round01(a.y+sy)},
    {x:round01(b.x+sx),y:round01(b.y+sy)}
  ];
}

canvas.addEventListener('pointermove', e => {
  if (!state.drag) return;
  const p = clientToSvg(e), bypass = e.altKey;

  if (state.drag.type === 'reference') {
    const dx = p.x - state.drag.start.x, dy = p.y - state.drag.start.y;
    state.reference.x = round01(state.drag.original.x + dx);
    state.reference.y = round01(state.drag.original.y + dy);
    state.snapGuides=[];
    markDirty(); render(); return;
  }

  const panel = panelById(state.drag.id);
  if (!panel) return;
  if (state.drag.type === 'image') {
    const dx = p.x - state.drag.start.x, dy = p.y - state.drag.start.y;
    panel.image.offsetX = round01(state.drag.original.x + dx);
    panel.image.offsetY = round01(state.drag.original.y + dy);
    state.snapGuides = [];
  } else if (state.drag.type === 'panel') {
    const dx = p.x - state.drag.start.x, dy = p.y - state.drag.start.y;
    panel.points = snapPanel(state.drag.original, dx, dy, panel.id, bypass);
  } else if (state.drag.type === 'vertex') {
    panel.points[state.drag.index] = snapPoint(p.x, p.y, panel.id, bypass);
  } else if (state.drag.type === 'edge') {
    const dx = p.x - state.drag.startMidpoint.x, dy = p.y - state.drag.startMidpoint.y;
    const [a,b] = snapEdge(state.drag.originalA, state.drag.originalB, dx, dy, panel.id, bypass);
    panel.points[state.drag.indexA] = a;
    panel.points[state.drag.indexB] = b;
  }
  markDirty(); render();
});
canvas.addEventListener('pointerup', () => { state.drag=null; state.snapGuides=[]; render(); });
canvas.addEventListener('pointercancel', () => { state.drag=null; state.snapGuides=[]; render(); });
canvas.addEventListener('pointerdown', e => {
  if (e.target === canvas || e.target.classList.contains('paper')) {
    state.selectedId = null; state.imageEditMode = false; state.snapGuides=[]; render();
  }
});

canvas.addEventListener('dragover', e => {
  if ([...(e.dataTransfer?.items || [])].some(item => item.kind === 'file')) e.preventDefault();
});
canvas.addEventListener('drop', e => {
  e.preventDefault();
  const file = [...(e.dataTransfer?.files || [])].find(f => /^image\/(png|jpeg)$/.test(f.type));
  if (!file) return;
  const point = clientToSvg(e);
  const panel = [...state.panels].reverse().find(p => pointInPolygon(point, p.points));
  if (!panel) return alert('画像を入れるコマの上へドロップしてください。');
  state.selectedId = panel.id;
  loadImageIntoPanel(panel, file);
});

function updateInspector() {
  const panel = panelById(state.selectedId);
  $('emptySelection').hidden = !!panel;
  $('selectionPanel').hidden = !panel;
  if (!panel) return;
  const b = bbox(panel.points), {w:pw,h:ph} = paperDimensions();
  $('panelName').value = panel.name;
  $('metricX').textContent = `${fmt(b.x)} mm`;
  $('metricY').textContent = `${fmt(b.y)} mm`;
  $('metricW').textContent = `${fmt(b.w)} mm`;
  $('metricH').textContent = `${fmt(b.h)} mm`;
  $('metricRatio').textContent = b.h ? `${(b.w/b.h).toFixed(2)}:1` : '-';
  $('metricArea').textContent = `${((polygonArea(panel.points)/(pw*ph))*100).toFixed(1)}%`;

  const hasImage = !!panel.image?.src;
  $('panelImageControls').hidden = !hasImage;
  if (hasImage) {
    $('imageEditMode').checked = state.imageEditMode;
    $('imageScale').value = Math.round((panel.image.scale || 1) * 100);
    $('imageScaleValue').textContent = `${Math.round((panel.image.scale || 1) * 100)}%`;
    $('imageOffsetX').value = fmt(panel.image.offsetX || 0);
    $('imageOffsetY').value = fmt(panel.image.offsetY || 0);
  }

  const list = $('vertexList'); list.innerHTML='';
  panel.points.forEach((p,i) => {
    const row=document.createElement('div'); row.className='vertex-row';
    const n=document.createElement('span'); n.textContent=`V${i+1}`;
    const ix=document.createElement('input'); ix.type='number'; ix.step='0.1'; ix.value=fmt(p.x);
    const iy=document.createElement('input'); iy.type='number'; iy.step='0.1'; iy.value=fmt(p.y);
    ix.addEventListener('change',()=>{p.x=round01(parseFloat(ix.value)||0);markDirty();render();});
    iy.addEventListener('change',()=>{p.y=round01(parseFloat(iy.value)||0);markDirty();render();});
    row.append(n,ix,iy); list.appendChild(row);
  });
}

function fitReferenceToPaper() {
  if (!state.reference) return;
  const {w,h}=paperDimensions();
  const ar=state.reference.naturalW/state.reference.naturalH, paperAr=w/h;
  if (ar > paperAr) {
    state.reference.w=w; state.reference.h=w/ar;
    state.reference.x=0; state.reference.y=(h-state.reference.h)/2;
  } else {
    state.reference.h=h; state.reference.w=h*ar;
    state.reference.y=0; state.reference.x=(w-state.reference.w)/2;
  }
  ['x','y','w','h'].forEach(k => state.reference[k]=round01(state.reference[k]));
  markDirty(); render();
}

function updateReferenceControls() {
  const r=state.reference;
  $('referenceControls').hidden=!r;
  if(!r) return;
  $('referenceVisible').checked=r.visible;
  $('referenceLocked').checked=r.locked;
  $('referenceOpacity').value=Math.round(r.opacity*100);
  $('referenceOpacityValue').textContent=`${Math.round(r.opacity*100)}%`;
  $('referenceX').value=fmt(r.x); $('referenceY').value=fmt(r.y);
  $('referenceW').value=fmt(r.w); $('referenceH').value=fmt(r.h);
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function getImageSize(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({w:img.naturalWidth,h:img.naturalHeight});
    img.onerror = reject;
    img.src = src;
  });
}
async function loadImageIntoPanel(panel, file) {
  try {
    if (!/^image\/(png|jpeg)$/.test(file.type)) throw new Error('JPG/PNGのみ');
    const src = await readFileAsDataURL(file);
    const size = await getImageSize(src);
    panel.image = {
      src, fileName:file.name, naturalW:size.w, naturalH:size.h,
      scale:1, offsetX:0, offsetY:0
    };
    state.imageEditMode = false;
    markDirty(); render();
  } catch (err) {
    alert('JPG / PNG画像を読み込めませんでした。');
  }
}

$('referenceImageInput').addEventListener('change', async e => {
  const file=e.target.files[0]; if(!file) return;
  try {
    const src = await readFileAsDataURL(file);
    const size = await getImageSize(src);
    state.reference={src,naturalW:size.w,naturalH:size.h,x:0,y:0,w:100,h:100,opacity:.35,visible:true,locked:true};
    fitReferenceToPaper();
  } catch (err) { alert('参照画像を読み込めませんでした。'); }
  e.target.value='';
});
$('referenceVisible').addEventListener('change',e=>{if(state.reference){state.reference.visible=e.target.checked;markDirty();render();}});
$('referenceLocked').addEventListener('change',e=>{if(state.reference){state.reference.locked=e.target.checked;markDirty();render();}});
$('referenceOpacity').addEventListener('input',e=>{if(state.reference){state.reference.opacity=+e.target.value/100;$('referenceOpacityValue').textContent=`${e.target.value}%`;markDirty();render();}});
[['referenceX','x'],['referenceY','y'],['referenceW','w'],['referenceH','h']].forEach(([id,key])=>{
  $(id).addEventListener('change',e=>{if(state.reference){state.reference[key]=round01(+e.target.value||0);markDirty();render();}});
});
$('fitReferenceBtn').onclick=fitReferenceToPaper;
$('removeReferenceBtn').onclick=()=>{state.reference=null;markDirty();render();};

$('panelImageInput').addEventListener('change', e => {
  const file = e.target.files[0], panel = panelById(state.selectedId);
  if (file && panel) loadImageIntoPanel(panel, file);
  e.target.value = '';
});
$('imageEditMode').addEventListener('change', e => { state.imageEditMode = e.target.checked; render(); });
$('imageScale').addEventListener('input', e => {
  const panel = panelById(state.selectedId); if (!panel?.image) return;
  panel.image.scale = Math.max(.5, +e.target.value / 100);
  $('imageScaleValue').textContent = `${e.target.value}%`;
  markDirty(); render();
});
$('imageOffsetX').addEventListener('change', e => {
  const panel = panelById(state.selectedId); if (!panel?.image) return;
  panel.image.offsetX = round01(+e.target.value || 0); markDirty(); render();
});
$('imageOffsetY').addEventListener('change', e => {
  const panel = panelById(state.selectedId); if (!panel?.image) return;
  panel.image.offsetY = round01(+e.target.value || 0); markDirty(); render();
});
$('resetPanelImageBtn').onclick = () => {
  const panel = panelById(state.selectedId); if (!panel?.image) return;
  panel.image.scale = 1; panel.image.offsetX = 0; panel.image.offsetY = 0;
  markDirty(); render();
};
$('removePanelImageBtn').onclick = () => {
  const panel = panelById(state.selectedId); if (!panel) return;
  panel.image = null; state.imageEditMode = false; markDirty(); render();
};

$('panelName').addEventListener('input', e => { const p=panelById(state.selectedId); if(p){p.name=e.target.value;markDirty();render();} });
$('addRectBtn').onclick=()=>addPanel('rect');
$('addTrapBtn').onclick=()=>addPanel('trap');
$('addSlantBtn').onclick=()=>addPanel('slant');
$('deleteBtn').onclick=()=>{if(state.selectedId){state.panels=state.panels.filter(p=>p.id!==state.selectedId);state.selectedId=null;state.imageEditMode=false;markDirty();render();}};
$('duplicateBtn').onclick=()=>{
  const p=panelById(state.selectedId); if(!p)return;
  const id=state.nextId++;
  state.panels.push({id,name:`P${id}`,points:p.points.map(q=>({x:round01(q.x+10),y:round01(q.y+10)})),image:cloneData(p.image)});
  state.selectedId=id; state.imageEditMode=false; markDirty(); render();
};

['paperSize','orientation','spreadMode'].forEach(id=>$(id).addEventListener('change',e=>{state[id]=e.target.value;markDirty();render();}));
$('safeMargin').addEventListener('change',e=>{state.safeMargin=Math.max(0,+e.target.value||0);markDirty();render();});
$('bleed').addEventListener('change',e=>{state.bleed=Math.max(0,+e.target.value||0);markDirty();render();});
$('showSafe').addEventListener('change',e=>{state.showSafe=e.target.checked;markDirty();render();});
$('showBleed').addEventListener('change',e=>{state.showBleed=e.target.checked;markDirty();render();});
$('showGrid').addEventListener('change',e=>{state.showGrid=e.target.checked;markDirty();render();});
$('showSnapGuides').addEventListener('change',e=>{state.showSnapGuides=e.target.checked;markDirty();render();});
$('snapToggle').addEventListener('change',e=>{state.snap=e.target.checked;markDirty();});
$('gapX').addEventListener('change',e=>{state.gapX=Math.max(0,+e.target.value||0);markDirty();});
$('gapY').addEventListener('change',e=>{state.gapY=Math.max(0,+e.target.value||0);markDirty();});
$('snapThreshold').addEventListener('change',e=>{state.snapThreshold=Math.max(.1,+e.target.value||3);markDirty();});
$('projectTitle').addEventListener('input', markDirty);

$('pageSelect').addEventListener('change', e => {
  saveCurrentPageState();
  const page = state.pages.find(p => p.id === +e.target.value);
  applyPage(page);
});
$('pageName').addEventListener('input', e => {
  const page = currentPage(); if (!page) return;
  page.name = e.target.value;
  updatePageControls(); markDirty();
});
$('addPageBtn').onclick=()=>addPage(false);
$('duplicatePageBtn').onclick=()=>addPage(true);
$('deletePageBtn').onclick=deleteCurrentPage;

function syncControls() {
  $('paperSize').value=state.paperSize; $('orientation').value=state.orientation; $('spreadMode').value=state.spreadMode;
  $('safeMargin').value=state.safeMargin; $('bleed').value=state.bleed;
  $('showSafe').checked=state.showSafe; $('showBleed').checked=state.showBleed; $('showGrid').checked=state.showGrid; $('showSnapGuides').checked=state.showSnapGuides;
  $('snapToggle').checked=state.snap; $('gapX').value=state.gapX; $('gapY').value=state.gapY; $('snapThreshold').value=state.snapThreshold;
}

function projectData() {
  saveCurrentPageState();
  return {
    version:'1.0', title:$('projectTitle').value,
    pageSeq:state.pageSeq, currentPageId:state.currentPageId,
    pages:cloneData(state.pages)
  };
}

function loadProject(data) {
  if (!data) throw new Error('形式が違います');
  if (Array.isArray(data.pages) && data.pages.length) {
    state.pages = cloneData(data.pages);
    state.pageSeq = data.pageSeq || Math.max(...state.pages.map(p => p.id || 0)) + 1;
    state.currentPageId = data.currentPageId || state.pages[0].id;
  } else if (data.paper && Array.isArray(data.panels)) {
    state.pages = [{
      id:1, name:'P1', paper:cloneData(data.paper), view:cloneData(data.view || {}),
      snap:cloneData(data.snap || {}), panels:cloneData(data.panels), nextId:data.nextId,
      reference:cloneData(data.reference || null)
    }];
    state.currentPageId = 1; state.pageSeq = 2;
  } else {
    throw new Error('形式が違います');
  }
  $('projectTitle').value=data.title||'読込プロジェクト';
  const page = state.pages.find(p => p.id === state.currentPageId) || state.pages[0];
  applyPage(page);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, {keyPath:'id'});
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function savePersistent() {
  const db = await openDb();
  const data = projectData();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put({id:DB_KEY, data, updatedAt:Date.now()});
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}
async function readPersistent() {
  const db = await openDb();
  const result = await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(DB_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

$('saveLocalBtn').onclick=async()=>{
  try {
    await savePersistent();
    markSaved('保存済み');
    alert('全ページを画像込みでこのブラウザに保存しました。');
  } catch(err) {
    alert('保存できませんでした。ブラウザの保存容量をご確認ください。');
  }
};
$('loadLocalBtn').onclick=async()=>{
  try {
    const rec=await readPersistent();
    if(rec?.data){loadProject(rec.data);markSaved('保存を読込');return;}
    const legacy=localStorage.getItem('mangaPanelDesignerProject');
    if(legacy){loadProject(JSON.parse(legacy));markDirty();alert('v0.3の保存データを読み込みました。v1.0形式で保存し直せます。');return;}
    alert('保存データがありません。');
  } catch(err){alert('読込に失敗しました。');}
};

function downloadText(filename,text,type){
  const blob=new Blob([text],{type}); downloadBlob(filename,blob);
}
function downloadBlob(filename,blob){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}
$('exportJsonBtn').onclick=()=>downloadText(`${safeFileName($('projectTitle').value)}.json`,JSON.stringify(projectData(),null,2),'application/json');
$('importJsonInput').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  try{loadProject(JSON.parse(await f.text()));markDirty();}catch(err){alert('JSONを読み込めませんでした。');}
  e.target.value='';
});

function buildExportSvg() {
  const {w,h}=paperDimensions();
  const title=$('projectTitle').value;
  const pageName=$('pageName').value || 'page';
  const clips=[];
  const layers=[];
  state.panels.forEach(p=>{
    const points=p.points.map(q=>`${q.x},${q.y}`).join(' ');
    const clipId=`export-clip-${p.id}`;
    if(p.image?.src){
      const g=imageGeometry(p);
      clips.push(`<clipPath id="${clipId}"><polygon points="${points}"/></clipPath>`);
      if(g) layers.push(`<image href="${escapeXml(p.image.src)}" x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" preserveAspectRatio="none" clip-path="url(#${clipId})"/>`);
    }
    layers.push(`<polygon data-name="${escapeXml(p.name)}" points="${points}" fill="none" stroke="#000" stroke-width="0.6"/>`);
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">\n<title>${escapeXml(title)} - ${escapeXml(pageName)}</title>\n<defs>${clips.join('')}</defs>\n<rect x="0" y="0" width="${w}" height="${h}" fill="#fff"/>\n${layers.join('\n')}\n</svg>`;
}

$('exportSvgBtn').onclick=()=>{
  const pageName=$('pageName').value||'page';
  downloadText(`${safeFileName($('projectTitle').value)}_${safeFileName(pageName)}.svg`,buildExportSvg(),'image/svg+xml');
};

async function exportRaster(mime, ext) {
  const {w,h}=paperDimensions();
  const dpi=300;
  const pxW=Math.max(1,Math.round(w/25.4*dpi)), pxH=Math.max(1,Math.round(h/25.4*dpi));
  const svg=buildExportSvg();
  const blob=new Blob([svg],{type:'image/svg+xml'});
  const url=URL.createObjectURL(blob);
  try {
    const img=await new Promise((resolve,reject)=>{
      const im=new Image(); im.onload=()=>resolve(im); im.onerror=reject; im.src=url;
    });
    const out=document.createElement('canvas'); out.width=pxW; out.height=pxH;
    const ctx=out.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,pxW,pxH); ctx.drawImage(img,0,0,pxW,pxH);
    const raster=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(new Error('書出失敗')),mime,.94));
    const pageName=$('pageName').value||'page';
    downloadBlob(`${safeFileName($('projectTitle').value)}_${safeFileName(pageName)}.${ext}`,raster);
  } catch(err) {
    alert('画像を書き出せませんでした。');
  } finally { URL.revokeObjectURL(url); }
}
$('exportPngBtn').onclick=()=>exportRaster('image/png','png');
$('exportJpgBtn').onclick=()=>exportRaster('image/jpeg','jpg');

ensureInitialPage();
syncControls();
updatePageControls();
render();

(async()=>{
  try {
    const rec=await readPersistent();
    if(rec?.data){loadProject(rec.data);markSaved('前回保存を復元');}
  } catch(err) {
    // IndexedDBが使えない環境でも編集機能は継続する。
  }
})();
