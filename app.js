const NS = 'http://www.w3.org/2000/svg';
const PAPER = {
  B5: [182, 257], A4: [210, 297], B4: [257, 364], A3: [297, 420], B6: [128, 182]
};

const state = {
  paperSize: 'B5', orientation: 'portrait', spreadMode: 'single', safeMargin: 12, bleed: 3,
  showSafe: true, showBleed: true, showGrid: false, showSnapGuides: true,
  snap: true, gapX: 4, gapY: 4, snapThreshold: 3,
  panels: [], selectedId: null, nextId: 1, drag: null,
  snapGuides: [],
  reference: null
};

const $ = id => document.getElementById(id);
const canvas = $('canvas');

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

function round01(v) { return Math.round(v * 10) / 10; }
function fmt(v) { return `${round01(v)}`; }
function panelById(id) { return state.panels.find(p => p.id === id); }
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
function safeFileName(s) { return (s || 'manga-panels').replace(/[\\/:*?"<>|]/g, '_'); }
function escapeXml(s = '') { return s.replace(/[<>&'\"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c])); }

function addPanel(type = 'rect') {
  const { w, h } = paperDimensions();
  const cx = w / 2, cy = h / 2;
  let points;
  if (type === 'trap') points = [{x:cx-45,y:cy-30},{x:cx+35,y:cy-30},{x:cx+45,y:cy+30},{x:cx-35,y:cy+30}];
  else if (type === 'slant') points = [{x:cx-45,y:cy-30},{x:cx+45,y:cy-20},{x:cx+45,y:cy+30},{x:cx-45,y:cy+20}];
  else points = [{x:cx-45,y:cy-30},{x:cx+45,y:cy-30},{x:cx+45,y:cy+30},{x:cx-45,y:cy+30}];
  const id = state.nextId++;
  state.panels.push({ id, name: `P${id}`, points });
  state.selectedId = id;
  render();
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
    const poly = svgEl('polygon', {
      points: panel.points.map(p => `${p.x},${p.y}`).join(' '),
      class: `panel-shape${selected ? ' selected' : ''}`,
      'data-panel-id': panel.id
    });
    poly.addEventListener('pointerdown', e => startPanelDrag(e, panel.id));
    canvas.appendChild(poly);

    const c = centroid(panel.points);
    const label = svgEl('text', {x:c.x,y:c.y,class:'panel-label'});
    label.textContent = panel.name;
    canvas.appendChild(label);

    if (selected) {
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
}

function clientToSvg(e) {
  const pt = canvas.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(canvas.getScreenCTM().inverse());
}

function startPanelDrag(e, id) {
  if (e.target.classList.contains('vertex-handle') || e.target.classList.contains('edge-handle')) return;
  e.preventDefault(); e.stopPropagation();
  state.selectedId = id;
  const p = clientToSvg(e), panel = panelById(id);
  state.drag = {type:'panel',id,start:p,original:panel.points.map(q=>({...q}))};
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
    const xCandidates = [b.minX,b.maxX];
    const yCandidates = [b.minY,b.maxY];
    const xGuides = guidesForAxis('x', id);
    const yGuides = guidesForAxis('y', id);
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
  const sx = bestX ? bestX.delta : 0;
  const sy = bestY ? bestY.delta : 0;
  return moved.map(p => ({x:round01(p.x+sx),y:round01(p.y+sy)}));
}

function snapPoint(x, y, id, bypass) {
  const sx = nearestSnap(x, 'x', id, bypass);
  const sy = nearestSnap(y, 'y', id, bypass);
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
  const p = clientToSvg(e);
  const bypass = e.altKey;

  if (state.drag.type === 'reference') {
    const dx = p.x - state.drag.start.x, dy = p.y - state.drag.start.y;
    state.reference.x = round01(state.drag.original.x + dx);
    state.reference.y = round01(state.drag.original.y + dy);
    state.snapGuides=[];
    render();
    return;
  }

  const panel = panelById(state.drag.id);
  if (!panel) return;
  if (state.drag.type === 'panel') {
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
  render();
});
canvas.addEventListener('pointerup', () => { state.drag=null; state.snapGuides=[]; render(); });
canvas.addEventListener('pointercancel', () => { state.drag=null; state.snapGuides=[]; render(); });
canvas.addEventListener('pointerdown', e => {
  if (e.target === canvas || e.target.classList.contains('paper')) {
    state.selectedId = null; state.snapGuides=[]; render();
  }
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
  const list = $('vertexList'); list.innerHTML='';
  panel.points.forEach((p,i) => {
    const row=document.createElement('div'); row.className='vertex-row';
    const n=document.createElement('span'); n.textContent=`V${i+1}`;
    const ix=document.createElement('input'); ix.type='number'; ix.step='0.1'; ix.value=fmt(p.x);
    const iy=document.createElement('input'); iy.type='number'; iy.step='0.1'; iy.value=fmt(p.y);
    ix.addEventListener('change',()=>{p.x=round01(parseFloat(ix.value)||0);render();});
    iy.addEventListener('change',()=>{p.y=round01(parseFloat(iy.value)||0);render();});
    row.append(n,ix,iy); list.appendChild(row);
  });
}

function fitReferenceToPaper() {
  if (!state.reference) return;
  const {w,h}=paperDimensions();
  const ar=state.reference.naturalW/state.reference.naturalH;
  const paperAr=w/h;
  if (ar > paperAr) {
    state.reference.w=w; state.reference.h=w/ar;
    state.reference.x=0; state.reference.y=(h-state.reference.h)/2;
  } else {
    state.reference.h=h; state.reference.w=h*ar;
    state.reference.y=0; state.reference.x=(w-state.reference.w)/2;
  }
  ['x','y','w','h'].forEach(k => state.reference[k]=round01(state.reference[k]));
  render();
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

$('referenceImageInput').addEventListener('change', e => {
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    const img=new Image();
    img.onload=()=>{
      state.reference={src:reader.result,naturalW:img.naturalWidth,naturalH:img.naturalHeight,x:0,y:0,w:100,h:100,opacity:.35,visible:true,locked:true};
      fitReferenceToPaper();
    };
    img.src=reader.result;
  };
  reader.readAsDataURL(file);
  e.target.value='';
});
$('referenceVisible').addEventListener('change',e=>{if(state.reference){state.reference.visible=e.target.checked;render();}});
$('referenceLocked').addEventListener('change',e=>{if(state.reference){state.reference.locked=e.target.checked;render();}});
$('referenceOpacity').addEventListener('input',e=>{if(state.reference){state.reference.opacity=+e.target.value/100;$('referenceOpacityValue').textContent=`${e.target.value}%`;render();}});
[['referenceX','x'],['referenceY','y'],['referenceW','w'],['referenceH','h']].forEach(([id,key])=>{
  $(id).addEventListener('change',e=>{if(state.reference){state.reference[key]=round01(+e.target.value||0);render();}});
});
$('fitReferenceBtn').onclick=fitReferenceToPaper;
$('removeReferenceBtn').onclick=()=>{state.reference=null;render();};

$('panelName').addEventListener('input', e => { const p=panelById(state.selectedId); if(p){p.name=e.target.value;render();} });
$('addRectBtn').onclick=()=>addPanel('rect');
$('addTrapBtn').onclick=()=>addPanel('trap');
$('addSlantBtn').onclick=()=>addPanel('slant');
$('deleteBtn').onclick=()=>{if(state.selectedId){state.panels=state.panels.filter(p=>p.id!==state.selectedId);state.selectedId=null;render();}};
$('duplicateBtn').onclick=()=>{const p=panelById(state.selectedId);if(!p)return;const id=state.nextId++;state.panels.push({id,name:`P${id}`,points:p.points.map(q=>({x:round01(q.x+10),y:round01(q.y+10)}))});state.selectedId=id;render();};

['paperSize','orientation','spreadMode'].forEach(id=>$(id).addEventListener('change',e=>{state[id]=e.target.value;render();}));
$('safeMargin').addEventListener('change',e=>{state.safeMargin=Math.max(0,+e.target.value||0);render();});
$('bleed').addEventListener('change',e=>{state.bleed=Math.max(0,+e.target.value||0);render();});
$('showSafe').addEventListener('change',e=>{state.showSafe=e.target.checked;render();});
$('showBleed').addEventListener('change',e=>{state.showBleed=e.target.checked;render();});
$('showGrid').addEventListener('change',e=>{state.showGrid=e.target.checked;render();});
$('showSnapGuides').addEventListener('change',e=>{state.showSnapGuides=e.target.checked;render();});
$('snapToggle').addEventListener('change',e=>{state.snap=e.target.checked;});
$('gapX').addEventListener('change',e=>{state.gapX=Math.max(0,+e.target.value||0);});
$('gapY').addEventListener('change',e=>{state.gapY=Math.max(0,+e.target.value||0);});
$('snapThreshold').addEventListener('change',e=>{state.snapThreshold=Math.max(.1,+e.target.value||3);});

function projectData() {
  return {
    version:'0.3', title:$('projectTitle').value,
    paper:{size:state.paperSize,orientation:state.orientation,spreadMode:state.spreadMode,safeMargin:state.safeMargin,bleed:state.bleed},
    view:{showSafe:state.showSafe,showBleed:state.showBleed,showGrid:state.showGrid,showSnapGuides:state.showSnapGuides},
    snap:{enabled:state.snap,gapX:state.gapX,gapY:state.gapY,threshold:state.snapThreshold},
    panels:state.panels, nextId:state.nextId,
    reference:state.reference
  };
}

function syncControls() {
  $('paperSize').value=state.paperSize; $('orientation').value=state.orientation; $('spreadMode').value=state.spreadMode;
  $('safeMargin').value=state.safeMargin; $('bleed').value=state.bleed;
  $('showSafe').checked=state.showSafe; $('showBleed').checked=state.showBleed; $('showGrid').checked=state.showGrid; $('showSnapGuides').checked=state.showSnapGuides;
  $('snapToggle').checked=state.snap; $('gapX').value=state.gapX; $('gapY').value=state.gapY; $('snapThreshold').value=state.snapThreshold;
}

function loadProject(data) {
  if (!data || !data.paper || !Array.isArray(data.panels)) throw new Error('形式が違います');
  state.paperSize=data.paper.size||'B5'; state.orientation=data.paper.orientation||'portrait'; state.spreadMode=data.paper.spreadMode||'single';
  state.safeMargin=data.paper.safeMargin ?? 12; state.bleed=data.paper.bleed ?? 3;
  state.panels=data.panels; state.nextId=data.nextId||Math.max(0,...data.panels.map(p=>p.id||0))+1; state.selectedId=null;
  if(data.view){state.showSafe=data.view.showSafe ?? true;state.showBleed=data.view.showBleed ?? true;state.showGrid=data.view.showGrid ?? false;state.showSnapGuides=data.view.showSnapGuides ?? true;}
  if(data.snap){state.snap=data.snap.enabled ?? true;state.gapX=data.snap.gapX ?? 4;state.gapY=data.snap.gapY ?? 4;state.snapThreshold=data.snap.threshold ?? 3;}
  else { state.snap=true;state.gapX=4;state.gapY=4;state.snapThreshold=3; }
  state.reference=data.reference||null;
  $('projectTitle').value=data.title||'読込プロジェクト';
  syncControls(); render();
}

$('saveLocalBtn').onclick=()=>{
  try { localStorage.setItem('mangaPanelDesignerProject',JSON.stringify(projectData())); alert('このブラウザに保存しました。'); }
  catch(err) { alert('保存できませんでした。参照画像が大きい場合はJSON書出を使ってください。'); }
};
$('loadLocalBtn').onclick=()=>{const raw=localStorage.getItem('mangaPanelDesignerProject');if(!raw)return alert('保存データがありません。');try{loadProject(JSON.parse(raw));}catch(err){alert('読込に失敗しました。');}};
function download(filename,text,type){const blob=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
$('exportJsonBtn').onclick=()=>download(`${safeFileName($('projectTitle').value)}.json`,JSON.stringify(projectData(),null,2),'application/json');
$('importJsonInput').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{loadProject(JSON.parse(await f.text()));}catch(err){alert('JSONを読み込めませんでした。');}e.target.value='';});

$('exportSvgBtn').onclick=()=>{
  const {w,h}=paperDimensions();
  const title=$('projectTitle').value;
  let ref='';
  if(state.reference && state.reference.visible && state.reference.src){
    const r=state.reference;
    ref=`  <g id="reference-layer" opacity="${r.opacity}">\n    <image href="${r.src}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" preserveAspectRatio="none"/>\n  </g>\n`;
  }
  const shapes=state.panels.map(p=>`  <polygon id="panel-${p.id}" data-name="${escapeXml(p.name)}" points="${p.points.map(q=>`${q.x},${q.y}`).join(' ')}" fill="none" stroke="#000" stroke-width="0.6"/>`).join('\n');
  const svg=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">\n  <title>${escapeXml(title)}</title>\n${ref}${shapes}\n</svg>`;
  download(`${safeFileName(title)}.svg`,svg,'image/svg+xml');
};

syncControls();
render();
