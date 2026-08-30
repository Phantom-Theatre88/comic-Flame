// comic-Flame v0.4 overlay
// Keeps v0.3 app.js intact and adds right-binding reading order support.

function readingOrderPanels() {
  const items = state.panels.map(panel => ({ panel, box: bbox(panel.points) }));
  const rows = [];

  items
    .sort((a, b) => a.box.minY - b.box.minY || b.box.maxX - a.box.maxX)
    .forEach(item => {
      let targetRow = null;
      let bestOverlapRatio = 0;

      rows.forEach(row => {
        const overlap = Math.min(row.maxY, item.box.maxY) - Math.max(row.minY, item.box.minY);
        const minHeight = Math.max(0.1, Math.min(row.maxY - row.minY, item.box.h));
        const ratio = overlap > 0 ? overlap / minHeight : 0;
        if (ratio >= 0.35 && ratio > bestOverlapRatio) {
          targetRow = row;
          bestOverlapRatio = ratio;
        }
      });

      if (!targetRow) {
        targetRow = { minY: item.box.minY, maxY: item.box.maxY, items: [] };
        rows.push(targetRow);
      }

      targetRow.items.push(item);
      targetRow.minY = Math.min(targetRow.minY, item.box.minY);
      targetRow.maxY = Math.max(targetRow.maxY, item.box.maxY);
    });

  rows.sort((a, b) => a.minY - b.minY);

  const order = [];
  rows.forEach(row => {
    row.items
      .sort((a, b) => b.box.maxX - a.box.maxX || a.box.minY - b.box.minY)
      .forEach(item => order.push(item.panel));
  });

  return order;
}

function readingNumberAnchor(points) {
  const topTwo = [...points].sort((a, b) => a.y - b.y).slice(0, 2);
  const corner = topTwo.sort((a, b) => b.x - a.x)[0] || points[0] || { x: 0, y: 0 };
  return { x: round01(corner.x - 2.5), y: round01(corner.y + 2.5) };
}

function ensureReadingOrderUi() {
  if ($('readingOrderSection')) return;
  const sidebar = document.querySelector('.sidebar.right');
  if (!sidebar) return;

  const section = document.createElement('section');
  section.id = 'readingOrderSection';
  section.innerHTML = `
    <h2>右綴じ読み順</h2>
    <div id="readingOrderStatus" class="muted">コマを配置してください</div>
    <p id="readingOrderList" class="hint compact"></p>
    <p class="hint compact">上→下、同じ段は右→左で自動判定。番号はコマ内右上に表示します。</p>
  `;
  sidebar.insertBefore(section, sidebar.firstElementChild);
}

function updateReadingOrderUi(order) {
  ensureReadingOrderUi();
  const status = $('readingOrderStatus');
  const list = $('readingOrderList');
  if (!status || !list) return;

  if (!order.length) {
    status.textContent = 'コマを配置してください';
    list.textContent = '';
    return;
  }

  status.textContent = `${order.length}コマ・右綴じ自動判定`;
  list.textContent = order.map((panel, index) => `${index + 1}: ${panel.name}`).join(' → ');
}

const renderV03 = render;
render = function renderV04() {
  renderV03();

  const order = readingOrderPanels();
  const numberById = new Map(order.map((panel, index) => [panel.id, index + 1]));
  const labels = canvas.querySelectorAll('.panel-label');

  labels.forEach((label, index) => {
    const panel = state.panels[index];
    if (!panel) return;
    const anchor = readingNumberAnchor(panel.points);
    label.textContent = numberById.get(panel.id) || '';
    label.setAttribute('x', anchor.x);
    label.setAttribute('y', anchor.y);
    label.setAttribute('style', 'text-anchor:end;dominant-baseline:hanging;font-weight:700;font-size:5px;');
  });

  updateReadingOrderUi(order);
};

const projectDataV03 = projectData;
projectData = function projectDataV04() {
  const data = projectDataV03();
  data.version = '0.4';
  data.readingOrder = 'right-to-left';
  return data;
};

$('exportSvgBtn').onclick = () => {
  const { w, h } = paperDimensions();
  const title = $('projectTitle').value;
  const order = readingOrderPanels();
  const numberById = new Map(order.map((panel, index) => [panel.id, index + 1]));

  let ref = '';
  if (state.reference && state.reference.visible && state.reference.src) {
    const r = state.reference;
    ref = `  <g id="reference-layer" opacity="${r.opacity}">\n    <image href="${r.src}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" preserveAspectRatio="none"/>\n  </g>\n`;
  }

  const shapes = state.panels.map(panel => {
    const anchor = readingNumberAnchor(panel.points);
    const number = numberById.get(panel.id) || '';
    return `  <g id="panel-${panel.id}" data-name="${escapeXml(panel.name)}">\n    <polygon points="${panel.points.map(point => `${point.x},${point.y}`).join(' ')}" fill="none" stroke="#000" stroke-width="0.6"/>\n    <text x="${anchor.x}" y="${anchor.y}" font-size="5" font-weight="700" text-anchor="end" dominant-baseline="hanging">${number}</text>\n  </g>`;
  }).join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">\n  <title>${escapeXml(title)}</title>\n${ref}${shapes}\n</svg>`;
  download(`${safeFileName(title)}.svg`, svg, 'image/svg+xml');
};

document.title = 'Manga Panel Designer v0.4';
const versionLabel = document.querySelector('h1 span');
if (versionLabel) versionLabel.textContent = 'v0.4';
const footer = document.querySelector('footer');
if (footer) footer.textContent = 'v0.4 — v0.3機能維持 / 右綴じ読み順自動判定 / コマ番号右上表示 / SVG・JSON保存';

ensureReadingOrderUi();
render();
