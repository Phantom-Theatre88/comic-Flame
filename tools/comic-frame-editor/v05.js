// comic-Flame v0.5 overlay
// Adds direct kibi storyboard JSON paste/import while keeping v0.4 behavior intact.

function parseJsonText(text) {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!cleaned) throw new Error('JSONが空です');
  return JSON.parse(cleaned);
}

function rectPoints(panel) {
  const x = Number(panel.x);
  const y = Number(panel.y);
  const w = Number(panel.w ?? panel.width);
  const h = Number(panel.h ?? panel.height);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) {
    throw new Error('四角コマには x / y / w / h が必要です');
  }
  return [
    { x: round01(x), y: round01(y) },
    { x: round01(x + w), y: round01(y) },
    { x: round01(x + w), y: round01(y + h) },
    { x: round01(x), y: round01(y + h) }
  ];
}

function normalizePoints(points) {
  if (!Array.isArray(points) || points.length < 4) {
    throw new Error('points は4点以上必要です');
  }
  return points.map((point, index) => {
    const x = Number(point.x);
    const y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`points[${index}] の x / y が不正です`);
    }
    return { x: round01(x), y: round01(y) };
  });
}

function normalizeKibiPanel(panel, index) {
  const id = index + 1;
  const points = Array.isArray(panel.points) ? normalizePoints(panel.points) : rectPoints(panel);
  return {
    id,
    name: String(panel.name || panel.label || `P${id}`),
    points
  };
}

function normalizeKibiProject(data) {
  if (!data || typeof data !== 'object') throw new Error('JSON形式が違います');

  // Existing comic-Flame project JSON remains fully compatible.
  if (data.paper && Array.isArray(data.panels) && data.panels.every(panel => Array.isArray(panel.points) && panel.id != null)) {
    return data;
  }

  if (!Array.isArray(data.panels) || data.panels.length === 0) {
    throw new Error('panels がありません');
  }

  const paper = data.paper || {};
  const panels = data.panels.map(normalizeKibiPanel);

  return {
    version: '0.5',
    title: String(data.title || 'kibiコンテ'),
    paper: {
      size: paper.size || 'B5',
      orientation: paper.orientation || 'portrait',
      spreadMode: paper.spreadMode || 'single',
      safeMargin: paper.safeMargin ?? 12,
      bleed: paper.bleed ?? 3
    },
    view: {
      showSafe: true,
      showBleed: true,
      showGrid: false,
      showSnapGuides: true
    },
    snap: {
      enabled: true,
      gapX: 4,
      gapY: 4,
      threshold: 3
    },
    panels,
    nextId: panels.length + 1,
    reference: null,
    source: data.source || 'kibi-storyboard'
  };
}

function ensureAiImportUi() {
  if ($('aiStoryboardSection')) return;

  const leftSidebar = document.querySelector('.sidebar.left');
  const panelSection = $('addRectBtn')?.closest('section');
  if (!leftSidebar || !panelSection) return;

  const section = document.createElement('section');
  section.id = 'aiStoryboardSection';
  section.innerHTML = `
    <h2>AIコンテ読込</h2>
    <textarea id="aiStoryboardJson" class="ai-json-textarea" spellcheck="false" placeholder="kibiが出した comic-Flame用JSON をここへ貼り付け"></textarea>
    <button id="applyAiStoryboardBtn">コンテJSONを反映</button>
    <div id="aiStoryboardStatus" class="muted">貼り付けたJSONからコマを生成します。</div>
    <p class="hint compact">反映すると現在のコマ配置を置き換えます。四角コマは x/y/w/h、斜め・台形は points で指定できます。</p>
  `;

  panelSection.insertAdjacentElement('afterend', section);

  $('applyAiStoryboardBtn').addEventListener('click', () => {
    const status = $('aiStoryboardStatus');
    try {
      const raw = parseJsonText($('aiStoryboardJson').value);
      const project = normalizeKibiProject(raw);
      loadProject(project);
      status.textContent = `${project.panels.length}コマを読み込みました。画面上で修正できます。`;
    } catch (error) {
      status.textContent = `読込エラー：${error.message}`;
    }
  });
}

const projectDataV04ForV05 = projectData;
projectData = function projectDataV05() {
  const data = projectDataV04ForV05();
  data.version = '0.5';
  return data;
};

document.title = 'Manga Panel Designer v0.5';
const versionLabelV05 = document.querySelector('h1 span');
if (versionLabelV05) versionLabelV05.textContent = 'v0.5';
const footerV05 = document.querySelector('footer');
if (footerV05) footerV05.textContent = 'v0.5 — v0.4機能維持 / kibiコンテJSON貼付読込 / 右綴じ読み順 / SVG・JSON保存';

ensureAiImportUi();
render();
