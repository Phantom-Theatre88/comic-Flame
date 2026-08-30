// comic-Flame v0.7 overlay
// Per-panel JPG/PNG/WebP placement with clipping, drag, scale, offsets and SVG export.

let panelImageDrag = null;

function selectedPanelV07(){ return panelById(state.selectedId); }

function ensurePanelImageStyles(){
  if (document.getElementById('v07Styles')) return;
  const s=document.createElement('style');
  s.id='v07Styles';
  s.textContent=`
    .panel-content-image{cursor:move;}
    .panel-content-image.dragging{cursor:grabbing;}
    #panelImageSection .two-col{margin-top:4px;}
  `;
  document.head.appendChild(s);
}

function ensurePanelImageUi(){
  if ($('panelImageSection')) return;
  const right=document.querySelector('.sidebar.right');
  const selectedSection=$('selectionPanel')?.closest('section');
  if(!right||!selectedSection) return;
  const section=document.createElement('section');
  section.id='panelImageSection';
  section.innerHTML=`
    <h2>コマ画像</h2>
    <div id="panelImageEmpty" class="muted">コマを選ぶと画像を入れられます</div>
    <div id="panelImageControls" hidden>
      <label class="file-label full">JPG / PNG を読み込む<input id="panelImageInput" type="file" accept="image/png,image/jpeg,image/webp,image/*"></label>
      <div class="two-col">
        <button id="fitPanelImageBtn" type="button">枠に合わせる</button>
        <button id="removePanelImageBtn" type="button" class="danger">画像を削除</button>
      </div>
      <label>拡大率 <span id="panelImageScaleValue">100%</span><input id="panelImageScale" type="range" min="50" max="300" value="100"></label>
      <div class="two-col">
        <label>X補正 mm<input id="panelImageOffsetX" type="number" step="0.1" value="0"></label>
        <label>Y補正 mm<input id="panelImageOffsetY" type="number" step="0.1" value="0"></label>
      </div>
      <p class="hint compact">画像をコマの中で直接ドラッグできます。台形・斜め枠もその形で切り抜きます。</p>
    </div>`;
  selectedSection.insertAdjacentElement('afterend',section);

  $('panelImageInput').addEventListener('change',e=>{
    const file=e.target.files[0], panel=selectedPanelV07();
    if(!file||!panel) return;
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        panel.image={src:reader.result,naturalW:img.naturalWidth,naturalH:img.naturalHeight,scale:1,offsetX:0,offsetY:0};
        render();
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value='';
  });
  $('fitPanelImageBtn').onclick=()=>{const p=selectedPanelV07();if(p?.image){p.image.scale=1;p.image.offsetX=0;p.image.offsetY=0;render();}};
  $('removePanelImageBtn').onclick=()=>{const p=selectedPanelV07();if(p?.image){delete p.image;render();}};
  $('panelImageScale').addEventListener('input',e=>{const p=selectedPanelV07();const v=Math.max(50,Math.min(300,+e.target.value||100));$('panelImageScaleValue').textContent=`${v}%`;if(p?.image){p.image.scale=v/100;render();}});
  $('panelImageOffsetX').addEventListener('change',e=>{const p=selectedPanelV07();if(p?.image){p.image.offsetX=round01(+e.target.value||0);render();}});
  $('panelImageOffsetY').addEventListener('change',e=>{const p=selectedPanelV07();if(p?.image){p.image.offsetY=round01(+e.target.value||0);render();}});
}

function imageRectForPanelV07(panel){
  if(!panel?.image) return null;
  const b=bbox(panel.points), img=panel.image;
  const ir=img.naturalW/img.naturalH, fr=b.w/b.h;
  let w,h;
  if(fr>ir){w=b.w;h=w/ir;} else {h=b.h;w=h*ir;}
  const scale=img.scale||1; w*=scale; h*=scale;
  return {x:round01(b.x+(b.w-w)/2+(img.offsetX||0)),y:round01(b.y+(b.h-h)/2+(img.offsetY||0)),w:round01(w),h:round01(h)};
}

function drawPanelImagesV07(){
  const old=canvas.querySelector('defs[data-v07-images]'); if(old) old.remove();
  const defs=svgEl('defs',{'data-v07-images':'1'}); canvas.insertBefore(defs,canvas.firstChild);
  state.panels.forEach(panel=>{
    if(!panel.image?.src) return;
    const poly=canvas.querySelector(`.panel-shape[data-panel-id="${panel.id}"]`); if(!poly) return;
    const clipId=`panel-img-clip-${panel.id}`;
    const cp=svgEl('clipPath',{id:clipId}); cp.appendChild(svgEl('polygon',{points:panel.points.map(p=>`${p.x},${p.y}`).join(' ')})); defs.appendChild(cp);
    const r=imageRectForPanelV07(panel); if(!r) return;
    const image=svgEl('image',{href:panel.image.src,x:r.x,y:r.y,width:r.w,height:r.h,preserveAspectRatio:'none','clip-path':`url(#${clipId})`,class:'panel-content-image','data-panel-image-id':panel.id});
    image.addEventListener('pointerdown',e=>{
      e.preventDefault();e.stopPropagation();state.selectedId=panel.id;
      const p=clientToSvg(e); panelImageDrag={id:panel.id,start:p,offsetX:panel.image.offsetX||0,offsetY:panel.image.offsetY||0};
      image.classList.add('dragging'); canvas.setPointerCapture(e.pointerId); updatePanelImageUiV07();
    });
    canvas.insertBefore(image,poly);
    poly.setAttribute('fill','none');
  });
}

canvas.addEventListener('pointermove',e=>{
  if(!panelImageDrag) return;
  const panel=panelById(panelImageDrag.id); if(!panel?.image) return;
  const p=clientToSvg(e);
  panel.image.offsetX=round01(panelImageDrag.offsetX+(p.x-panelImageDrag.start.x));
  panel.image.offsetY=round01(panelImageDrag.offsetY+(p.y-panelImageDrag.start.y));
  render();
});
canvas.addEventListener('pointerup',()=>{panelImageDrag=null;});
canvas.addEventListener('pointercancel',()=>{panelImageDrag=null;});

function updatePanelImageUiV07(){
  ensurePanelImageUi();
  const p=selectedPanelV07(), empty=$('panelImageEmpty'), controls=$('panelImageControls'); if(!empty||!controls) return;
  empty.hidden=!!p; controls.hidden=!p; if(!p) return;
  const on=!!p.image;
  ['fitPanelImageBtn','removePanelImageBtn','panelImageScale','panelImageOffsetX','panelImageOffsetY'].forEach(id=>$(id).disabled=!on);
  const scale=on?Math.round((p.image.scale||1)*100):100;
  $('panelImageScale').value=scale; $('panelImageScaleValue').textContent=`${scale}%`;
  $('panelImageOffsetX').value=on?fmt(p.image.offsetX||0):'0'; $('panelImageOffsetY').value=on?fmt(p.image.offsetY||0):'0';
}

const renderBeforeV07=render;
render=function(){renderBeforeV07();ensurePanelImageStyles();ensurePanelImageUi();drawPanelImagesV07();updatePanelImageUiV07();};

const projectDataBeforeV07=projectData;
projectData=function(){const d=projectDataBeforeV07();d.version='0.7';return d;};

$('exportSvgBtn').onclick=()=>{
  const {w,h}=paperDimensions(), title=$('projectTitle').value;
  const order=typeof readingOrderPanels==='function'?readingOrderPanels():state.panels;
  const numberById=new Map(order.map((p,i)=>[p.id,i+1]));
  const defs=[];
  const groups=state.panels.map(panel=>{
    let img='';
    if(panel.image?.src){const clipId=`export-clip-${panel.id}`,r=imageRectForPanelV07(panel);defs.push(`<clipPath id="${clipId}"><polygon points="${panel.points.map(p=>`${p.x},${p.y}`).join(' ')}"/></clipPath>`);img=`<image href="${panel.image.src}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" preserveAspectRatio="none" clip-path="url(#${clipId})"/>`;}
    const a=typeof readingNumberAnchor==='function'?readingNumberAnchor(panel.points):centroid(panel.points);
    return `<g id="panel-${panel.id}" data-name="${escapeXml(panel.name)}">${img}<polygon points="${panel.points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="#000" stroke-width="0.6"/><text x="${a.x}" y="${a.y}" font-size="5" font-weight="700" text-anchor="end" dominant-baseline="hanging">${numberById.get(panel.id)||''}</text></g>`;
  }).join('\n');
  const svg=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}"><title>${escapeXml(title)}</title>${defs.length?`<defs>${defs.join('')}</defs>`:''}${groups}</svg>`;
  download(`${safeFileName(title)}.svg`,svg,'image/svg+xml');
};

document.title='Manga Panel Designer v0.7';
const vl=document.querySelector('h1 span');if(vl)vl.textContent='v0.7';
const ft=document.querySelector('footer');if(ft)ft.textContent='v0.7 — コマ画像読込 / 画像ドラッグ・拡大縮小 / MASTER読込 / 右綴じ / SVG・JSON保存';
ensurePanelImageStyles();ensurePanelImageUi();render();