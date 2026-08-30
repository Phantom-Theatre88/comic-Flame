// comic-Flame v0.6 overlay
// Adds full MASTER JSON import with page selection while keeping v0.5 single-page JSON support.

let aiMasterEntries = [];

function ensureMasterPageUi() {
  if ($('aiMasterControls')) return;
  const section = $('aiStoryboardSection');
  if (!section) return;

  const wrap = document.createElement('div');
  wrap.id = 'aiMasterControls';
  wrap.hidden = true;
  wrap.innerHTML = `
    <label>ページ選択
      <select id="aiMasterPageSelect"></select>
    </label>
    <div class="two-col">
      <button id="aiPrevPageBtn" type="button">◀ 前ページ</button>
      <button id="aiNextPageBtn" type="button">次ページ ▶</button>
    </div>
    <button id="aiLoadSelectedPageBtn" type="button">選択ページを表示</button>
  `;

  const status = $('aiStoryboardStatus');
  section.insertBefore(wrap, status);

  $('aiMasterPageSelect').addEventListener('change', loadSelectedMasterPage);
  $('aiLoadSelectedPageBtn').addEventListener('click', loadSelectedMasterPage);
  $('aiPrevPageBtn').addEventListener('click', () => stepMasterPage(-1));
  $('aiNextPageBtn').addEventListener('click', () => stepMasterPage(1));
}

function masterEntriesFrom(data) {
  if (!data || typeof data !== 'object' || !data.pages || typeof data.pages !== 'object') return [];
  return Object.entries(data.pages).filter(([, page]) => page && Array.isArray(page.panels));
}

function populateMasterPages(entries) {
  ensureMasterPageUi();
  aiMasterEntries = entries;
  const select = $('aiMasterPageSelect');
  const controls = $('aiMasterControls');
  select.innerHTML = '';

  entries.forEach(([key, page], index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${key} — ${page.title || key}`;
    select.appendChild(option);
  });

  controls.hidden = entries.length === 0;
}

function loadMasterPageAt(index) {
  if (!aiMasterEntries.length) return;
  const bounded = Math.max(0, Math.min(aiMasterEntries.length - 1, index));
  const [key, page] = aiMasterEntries[bounded];
  $('aiMasterPageSelect').value = String(bounded);
  loadProject(normalizeKibiProject(page));
  $('aiStoryboardStatus').textContent = `${aiMasterEntries.length}ページ認識中：${key} を表示しています。`;
}

function loadSelectedMasterPage() {
  const select = $('aiMasterPageSelect');
  if (!select || !aiMasterEntries.length) return;
  loadMasterPageAt(Number(select.value) || 0);
}

function stepMasterPage(delta) {
  const select = $('aiMasterPageSelect');
  if (!select || !aiMasterEntries.length) return;
  const current = Number(select.value) || 0;
  loadMasterPageAt(current + delta);
}

function installMasterAwareImport() {
  ensureAiImportUi();
  ensureMasterPageUi();

  const oldButton = $('applyAiStoryboardBtn');
  if (!oldButton) return;

  const button = oldButton.cloneNode(true);
  oldButton.replaceWith(button);

  button.addEventListener('click', () => {
    const status = $('aiStoryboardStatus');
    try {
      const raw = parseJsonText($('aiStoryboardJson').value);
      const entries = masterEntriesFrom(raw);

      if (entries.length) {
        populateMasterPages(entries);
        loadMasterPageAt(0);
        status.textContent = `${entries.length}ページのMASTER JSONを読み込みました。P1を表示しています。`;
        return;
      }

      aiMasterEntries = [];
      $('aiMasterControls').hidden = true;
      const project = normalizeKibiProject(raw);
      loadProject(project);
      status.textContent = `${project.panels.length}コマを読み込みました。画面上で修正できます。`;
    } catch (error) {
      status.textContent = `読込エラー：${error.message}`;
    }
  });
}

async function preloadEpisode0Master() {
  const status = $('aiStoryboardStatus');
  try {
    const response = await fetch('episode0_master.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`MASTER取得失敗 (${response.status})`);
    const master = await response.json();
    const entries = masterEntriesFrom(master);
    if (!entries.length) throw new Error('MASTER内にページがありません');
    $('aiStoryboardJson').value = JSON.stringify(master, null, 2);
    populateMasterPages(entries);
    loadMasterPageAt(0);
    status.textContent = `第0話MASTERを自動読込しました。全${entries.length}ページ。P1を表示しています。`;
  } catch (error) {
    if (status) status.textContent = `自動読込エラー：${error.message}`;
  }
}

const projectDataV05ForV06 = projectData;
projectData = function projectDataV06() {
  const data = projectDataV05ForV06();
  data.version = '0.6';
  return data;
};

document.title = 'Manga Panel Designer v0.6';
const versionLabelV06 = document.querySelector('h1 span');
if (versionLabelV06) versionLabelV06.textContent = 'v0.6';
const footerV06 = document.querySelector('footer');
if (footerV06) footerV06.textContent = 'v0.6 — 第0話MASTER自動読込 / ページ切替 / v0.5機能維持 / 右綴じ読み順 / SVG・JSON保存';

installMasterAwareImport();
render();
preloadEpisode0Master();
