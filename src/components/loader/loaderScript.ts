import { statSync } from 'fs';
import { join } from 'path';
import { LOADER_CONFIG } from './loader.config';

// Read at build time, so byte progress stays right even if the host compresses the
// model (Content-Length is then the compressed size) or the model file is replaced.
function modelSizeOnDisk() {
  try {
    return statSync(join(process.cwd(), 'public', LOADER_CONFIG.modelHref)).size;
  } catch {
    return 0;
  }
}

/**
 * Runs inline, before React and before the rest of the page is parsed, so the
 * loader works and can always dismiss itself even if the app bundle fails.
 * Written in plain ES5 because it is not compiled for browsers.
 */
export const LOADER_SCRIPT = `(function(c){
var d=document,h=d.documentElement,el=d.getElementById('site-loader');
if(!el)return;
var bar=el.querySelector('.sl-track'),fill=el.querySelector('.sl-fill'),pct=el.querySelector('.sl-pct');
var reduced=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
var started=Date.now(),names=Object.keys(c.weights),tasks={},subs=[],total=0;
var target=0,shown=0,raf=0,last=0,revealed=false,finishing=false,held=false,deadline=0,stall=0;
names.forEach(function(n){tasks[n]=0;total+=c.weights[n]});
h.setAttribute('data-site-loading','');

function pending(){return names.filter(function(n){return tasks[n]<1}).join(', ')}
function paint(){
  fill.style.transform='scaleX('+(shown/100)+')';
  pct.textContent=Math.floor(shown)+'%';
  bar.setAttribute('aria-valuenow',String(Math.floor(shown)));
}
function tick(now){
  raf=0;
  // Eases by elapsed time, so a long frame (the GPU warming up) can't leave it behind.
  var dt=last?now-last:16,gap=target-shown;
  last=now;
  shown=reduced||gap<.4?target:shown+gap*(1-Math.exp(-dt/(finishing?70:130)));
  paint();
  if(finishing&&shown>=100){hold();return}
  if(shown<target&&!revealed)raf=requestAnimationFrame(tick);else last=0;
}
function kick(){if(!raf&&!revealed)raf=requestAnimationFrame(tick)}
function update(){
  var sum=0;
  names.forEach(function(n){sum+=c.weights[n]*tasks[n]});
  target=Math.max(target,Math.min(100,sum/total*100));
  kick();
}
function hold(){
  if(held||revealed)return;
  held=true;clearTimeout(stall);
  shown=100;paint();
  setTimeout(function(){reveal()},Math.max(c.holdMs,c.minVisibleMs-(Date.now()-started)));
}
function block(e){
  var k=e.key;
  if(e.altKey)return;
  var combo=e.ctrlKey||e.metaKey;
  var nav=k==='Tab'||k===' '||k==='Enter'||k==='PageUp'||k==='PageDown'||k==='Home'||k==='End'||String(k).indexOf('Arrow')===0;
  if((combo&&(k==='k'||k==='K'))||(!combo&&nav)){e.preventDefault();e.stopPropagation()}
}
function reveal(reason){
  if(revealed)return;
  revealed=true;api.revealed=true;
  clearTimeout(deadline);
  if(reason)console.warn('[site-loader] '+reason+' Still waiting for: '+(pending()||'nothing'));
  h.removeAttribute('data-site-loading');
  d.removeEventListener('keydown',block,true);
  el.setAttribute('data-leaving','');
  subs.splice(0).forEach(function(cb){try{cb()}catch(err){console.error('[site-loader]',err)}});
  setTimeout(function(){el.hidden=true;if(raf)cancelAnimationFrame(raf)},reduced?c.fadeReducedMs:c.fadeMs);
}
function maybeFinish(){
  if(finishing||revealed||pending())return;
  finishing=true;target=100;
  // If frames have stalled, 100% is still shown and the reveal still happens.
  stall=setTimeout(hold,900);
  kick();
}
function expire(){
  var msg='Showing the portfolio after '+c.maxWaitMs/1000+' s.';
  if(!d.hidden){reveal(msg);return}
  d.addEventListener('visibilitychange',function v(){
    if(d.hidden)return;
    d.removeEventListener('visibilitychange',v);
    setTimeout(function(){reveal(msg)},c.graceMs);
  });
}
var control=null;
var api=window.__siteLoader={
  revealed:false,
  model:null,
  cancelModel:function(){if(control)control.abort();api.model=null},
  progress:function(n,f){
    if(revealed||!(n in tasks))return;
    if(f===null){el.setAttribute('data-indeterminate','');return}
    el.removeAttribute('data-indeterminate');
    tasks[n]=Math.max(tasks[n],Math.min(1,f));
    update();
  },
  done:function(){
    for(var i=0;i<arguments.length;i++)if(arguments[i] in tasks)tasks[arguments[i]]=1;
    if(tasks.model===1)el.removeAttribute('data-indeterminate');
    update();maybeFinish();
  },
  onReveal:function(cb){
    if(revealed){cb();return function(){}}
    subs.push(cb);
    return function(){var i=subs.indexOf(cb);if(i>=0)subs.splice(i,1)};
  }
};
d.addEventListener('keydown',block,true);
deadline=setTimeout(expire,c.maxWaitMs);

function showType(){el.setAttribute('data-type','')}
function fontsReady(){showType();api.done('fonts')}
setTimeout(showType,c.typeDelayMs);
setTimeout(fontsReady,c.fontTimeoutMs);
var font=d.createElement('link');
font.rel='stylesheet';font.href=c.fontHref;
font.onerror=fontsReady;
font.onload=function(){
  if(!d.fonts||!d.fonts.load){fontsReady();return}
  Promise.all(c.fontFaces.map(function(f){return d.fonts.load(f,'Rith Seyhak')})).then(fontsReady,fontsReady);
};
d.head.appendChild(font);

// The one model download. It runs at low priority so the app's code arrives first,
// and React hands the finished bytes to the existing GLTF loader.
if(window.WebGLRenderingContext&&window.fetch&&window.AbortController&&(!location.hash||location.hash==='#home')){
  control=new AbortController();
  api.model=fetch(c.modelHref,{priority:'low',signal:control.signal}).then(function(res){
    if(!res.ok)throw new Error('HTTP '+res.status);
    var size=res.headers.get('content-encoding')?c.modelBytes:(parseInt(res.headers.get('content-length'),10)||c.modelBytes);
    if(!res.body||!res.body.getReader){api.progress('model',null);return res.arrayBuffer()}
    var reader=res.body.getReader(),chunks=[],got=0;
    function pump(){
      return reader.read().then(function(part){
        if(part.done)return;
        chunks.push(part.value);got+=part.value.length;
        // The last few percent are held back for decoding the model.
        api.progress('model',size?Math.min(got/size,1)*.94:null);
        return pump();
      });
    }
    return pump().then(function(){
      var bytes=new Uint8Array(got),at=0;
      chunks.forEach(function(p){bytes.set(p,at);at+=p.length});
      return bytes.buffer;
    });
  });
  api.model.catch(function(err){if(err.name!=='AbortError')console.warn('[site-loader] Model download failed: '+err.message)});
}
})(${JSON.stringify({ ...LOADER_CONFIG, modelBytes: modelSizeOnDisk() })});`;
