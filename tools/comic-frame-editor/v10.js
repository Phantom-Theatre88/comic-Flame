// comic-Flame v1.0 overlay
// Finalizes panel-number management for editing and clean export.

let panelNumbersScreen = true;
let panelNumbersExport = false;

function ensureNumberManagementUi(){
  if ($('numberManagementSection')) return;
  const reading = $('readingOrderSection');
  const sidebar = document.querySelector('.sidebar.right');
  if (!reading || !sidebar) return;

  const section = document.createElement('section');
  section.id = 'numberManagementSection';
  section.innerHTML = `
    <h2>コマ番号</h2>
    <label class="checkline"><input id="showPanelNumbers" type="checkbox" checked> 画面に番号を表示</label>
    <label class="checkline"><input id="exportPanelNumbers" type="checkbox"> SVGに番号を出力</label>
    <p class="hint compact">番号は制作補助用です。完成原稿では「SVGに番号を出力」をOFFにしてください。</p>
  `;
  reading.insertAdjacentElement('afterend', section);

  $('showPanelNumbers').addEventListener('change', e => {
    panelNumbersScreen = !!e.target.checked;
    applyPanelNumberVisibility();
  });
  $('exportPanelNumbers').addEventListener('change', e => {
    panelNumbersExport = !!e.target.checked;
  });
}

function applyPanelNumberVisibility(){
  canvas.querySelectorAll('.panel-label').forEach(label => {
    label.style.display = panelNumbersScreen ? '' : 'none';
  });
}

function syncNumberManagementUi(){
  ensureNumberManagementUi();
  if ($('showPanelNumbers')) $('showPanelNumbers').checked = panelNumbersScreen;
  if ($('exportPanelNumbers')) $('exportPanelNumbers').checked = panelNumbersExport;
  applyPanelNumberVisibility();
}

const renderBeforeV10 = render;
render = function renderV10(){
  renderBeforeV10();
  syncNumberManagementUi();
};

const projectDataBeforeV10 = projectData;
projectData = function projectDataV10(){
  const data = projectDataBeforeV10();
  data.version = '1.0';
  data.output = {
    ...(data.output || {}),
    panelNumbersScreen,
    panelNumbersExport
  };
  return data;
};

const loadProjectBeforeV10 = loadProject;
loadProject = function loadProjectV10(data){
  if (data?.output) {
    if (typeof data.output.panelNumbersScreen === 'boolean') panelNumbersScreen = data.output.panelNumbersScreen;
    if (typeof data.output.panelNumbersExport === 'boolean') panelNumbersExport = data.output.panelNumbersExport;
  }
  loadProjectBeforeV10(data);
  syncNumberManagementUi();
};

$('exportSvgBtn').onclick = () => {
  const {w,h} = paperDimensions();
  const title = $('projectTitle').value;
  const order = typeof readingOrderPanels === 'function' ? readingOrderPanels() : state.panels;
  const numberById = new Map(order.map((p,i)=>[p.id,i+1]));
  const defs = [];

  const groups = state.panels.map(panel => {
    let img = '';
    if (panel.image?.src) {
      const clipId = `export-clip-${panel.id}`;
      const r = imageRectForPanelV07(panel);
      defs.push(`<clipPath id="${clipId}"><polygon points="${panel.points.map(p=>`${p.x},${p.y}`).join(' ')}"/></clipPath>`);
      img = `<image href="${panel.image.src}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" preserveAspectRatio="none" clip-path="url(#${clipId})"/>`;
    }

    let numberText = '';
    if (panelNumbersExport) {
      const a = typeof readingNumberAnchor === 'function' ? readingNumberAnchor(panel.points) : centroid(panel.points);
      numberText = `<text x="${a.x}" y="${a.y}" font-size="5" font-weight="700" text-anchor="end" dominant-baseline="hanging">${numberById.get(panel.id)||''}</text>`;
    }

    return `<g id="panel-${panel.id}" data-name="${escapeXml(panel.name)}">${img}<polygon points="${panel.points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="#000" stroke-width="0.6"/>${numberText}</g>`;
  }).join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}"><title>${escapeXml(title)}</title>${defs.length?`<defs>${defs.join('')}</defs>`:''}${groups}</svg>`;
  download(`${safeFileName(title)}.svg`, svg, 'image/svg+xml');
};

document.title = 'Manga Panel Designer v1.0';
const versionLabelV10 = document.querySelector('h1 span');
if (versionLabelV10) versionLabelV10.textContent = 'v1.0';
const footerV10 = document.querySelector('footer');
if (footerV10) footerV10.textContent = 'v1.0 — AIコンテ / MASTER読込 / コマ画像 / 右綴じ読み順 / 番号管理 / SVG・JSON保存';

ensureNumberManagementUi();
syncNumberManagementUi();
render();
