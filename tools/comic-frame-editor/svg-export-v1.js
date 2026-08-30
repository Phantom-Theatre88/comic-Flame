// Illustrator向けSVG書き出し拡張（Manga Panel Designer v1.0）
// app.js の編集状態をそのまま、画像・枠・参照画像を独立グループとして出力する。

function buildIllustratorSvg() {
  const { w, h } = paperDimensions();
  const title = $('projectTitle').value;
  const pageName = $('pageName').value || 'page';
  const clips = [];
  const panelLayers = [];

  const referenceLayer = (() => {
    const r = state.reference;
    if (!r || !r.visible || !r.src) return '';
    const src = escapeXml(r.src);
    return `  <g id="reference-layer" data-name="参照画像" i:layer="yes" opacity="${r.opacity}">\n` +
      `    <image id="reference-image" data-name="参照画像" href="${src}" xlink:href="${src}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" preserveAspectRatio="none"/>\n` +
      `  </g>`;
  })();

  state.panels.forEach((p, index) => {
    const points = p.points.map(q => `${q.x},${q.y}`).join(' ');
    const clipId = `panel-clip-${state.currentPageId}-${p.id}`;
    const panelName = escapeXml(p.name || `P${index + 1}`);
    clips.push(`    <clipPath id="${clipId}"><polygon points="${points}"/></clipPath>`);

    let imageGroup = '';
    if (p.image?.src) {
      const g = imageGeometry(p);
      if (g) {
        const src = escapeXml(p.image.src);
        const imageName = escapeXml(p.image.fileName || `${p.name || `P${index + 1}`}-image`);
        imageGroup =
          `    <g id="panel-${p.id}-image" data-name="${imageName}" clip-path="url(#${clipId})">\n` +
          `      <image id="panel-${p.id}-placed-image" data-name="${imageName}" href="${src}" xlink:href="${src}" x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" preserveAspectRatio="none"/>\n` +
          `    </g>\n`;
      }
    }

    panelLayers.push(
      `  <g id="panel-${p.id}" data-name="${panelName}" i:layer="yes">\n` +
      imageGroup +
      `    <g id="panel-${p.id}-frame" data-name="${panelName} 枠">\n` +
      `      <polygon data-name="${panelName}" points="${points}" fill="none" stroke="#000000" stroke-width="0.6"/>\n` +
      `    </g>\n` +
      `  </g>`
    );
  });

  const metadata = escapeXml(JSON.stringify({
    app: 'Manga Panel Designer',
    version: '1.0',
    page: pageName,
    paper: { widthMM: w, heightMM: h },
    note: 'Each panel is grouped separately. Placed images remain embedded and clipped by panel shapes.'
  }));

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:i="http://ns.adobe.com/AdobeIllustrator/10.0/" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">\n` +
    `  <title>${escapeXml(title)} - ${escapeXml(pageName)}</title>\n` +
    `  <metadata>${metadata}</metadata>\n` +
    `  <defs>\n${clips.join('\n')}\n  </defs>\n` +
    `  <g id="background-layer" data-name="背景" i:layer="yes">\n` +
    `    <rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff"/>\n` +
    `  </g>\n` +
    (referenceLayer ? `${referenceLayer}\n` : '') +
    `${panelLayers.join('\n')}\n` +
    `</svg>`;
}

$('exportSvgBtn').onclick = () => {
  saveCurrentPageState();
  const pageName = $('pageName').value || 'page';
  const svg = buildIllustratorSvg();
  downloadText(
    `${safeFileName($('projectTitle').value)}_${safeFileName(pageName)}.svg`,
    svg,
    'image/svg+xml'
  );
};
