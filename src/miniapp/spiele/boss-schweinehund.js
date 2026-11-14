// Grobe Bewegungsfelder verbinden die gemalten Schlüsselposen; Zwischenbilder entstehen erst auf dem Gerät.
var bossSchweinFlussCache = new Map();
function bossSchweinFluss(von, nach) {
  if (!von || !nach || von === nach || typeof bossSchweinFlussDaten === 'undefined') return null;
  var key = [von,nach].sort().join('|'), daten = bossSchweinFlussDaten[key]; if (!daten) return null;
  var felder = bossSchweinFlussCache.get(key);
  if (!felder) { felder = daten.map(function (s) { var bin = atob(s), a = new Int8Array(bin.length); for (var i=0;i<a.length;i++) a[i]=bin.charCodeAt(i); return a; }); bossSchweinFlussCache.set(key,felder); }
  return key.startsWith(von+'|') ? felder : [felder[1],felder[0]];
}
function bossSchweinFlussPunkt(feld,x,y,gewicht) {
  if (!feld || !gewicht) return [0,0];
  x=Math.max(0,Math.min(8,x/32));y=Math.max(0,Math.min(8,y/32));var i=Math.min(7,Math.floor(x)),j=Math.min(7,Math.floor(y)),a=x-i,b=y-j,k=(j*9+i)*2,r=[];
  for(var c=0;c<2;c++)r[c]=((feld[k+c]*(1-a)+feld[k+2+c]*a)*(1-b)+(feld[k+18+c]*(1-a)+feld[k+20+c]*a)*b)*gewicht/2;
  return r;
}
/* Kontinuierliche Verformung der vorhandenen Zeichnungen, ohne zusätzliche Bilddateien. */
function bossSchweinNetzPunkt(x, y, p) {
  var kopf = Math.max(0, Math.min(1, (178 - y) / 32)), fuss = Math.max(0, Math.min(1, (250 - y) / 40));
  var dx = x - 128, dy = y - 250, atmung = p.atmen || 0, drehung = (p.neigung || 0) * fuss;
  var xx = 128 + dx * (1 + atmung * .014 + (p.stauchen || 0) * .04), yy = 250 + dy * (1 - atmung * .009 - (p.stauchen || 0) * .04);
  xx += (p.stoss || 0) * fuss + Math.sin(drehung) * -dy;
  yy += (p.huepfen || 0) * fuss + (1 - Math.cos(drehung)) * -dy;
  // Weiche Gewichte verhindern sichtbare Gelenkkanten zwischen Kopf, Ohren und Körper.
  var ohr = Math.max(0, Math.min(1, (Math.abs(dx) - 28) / 25)) * Math.exp(-Math.pow((y - 121) / 30, 4));
  yy += ohr * (p.ohren || 0) * (dx < 0 ? 1 : -.8); xx += ohr * (p.ohren || 0) * .22;
  yy += kopf * (p.kopf || 0); xx += kopf * (p.blick || 0);
  var arm = Math.exp(-Math.pow((y - 199) / 28, 4)) * Math.max(0, Math.min(1, (Math.abs(dx) - 15) / 20));
  xx += arm * (p.arme || 0) * (dx < 0 ? -1 : 1); yy += arm * (p.arme || 0) * .7;
  var auge = Math.max(Math.exp(-Math.pow((x - 115) / 11, 4)), Math.exp(-Math.pow((x - 141) / 11, 4))) * Math.exp(-Math.pow((y - 117) / 10, 4));
  yy += auge * (117 - y) * (p.blinzeln || 0) * .9;
  if (p.schritt) { var bein = Math.max(0, Math.min(1, (y - 216) / 25)), links = dx < 0 ? 1 : -1; yy -= Math.max(0, Math.sin(p.schritt) * links) * 4 * bein; xx += Math.sin(p.schritt) * links * 2 * bein; }
  xx += (p.zittern || 0) * Math.sin(y * .1) * fuss;
  return [xx, yy];
}
function bossSchweinBewegung(name, zeit, anteil, wucht) {
  var t = zeit / 1000, p = { atmen: Math.sin(t * 2.5), ohren: Math.sin(t * 2.5 - .7) * .6, kopf: Math.sin(t * 2.5 - .3) * .5 };
  var u = Math.max(0, Math.min(1, anteil)), bogen = Math.sin(u * Math.PI), schwingung = Math.sin(u * Math.PI * 4) * (1 - u);
  if (/^treffer/.test(name)) { p.stoss = Math.sin(u * Math.PI) * 6 * wucht; p.neigung = schwingung * .035 * wucht; p.ohren = schwingung * 5 * wucht; p.arme = schwingung * 1.8; p.kopf = -bogen * 2; }
  else if (name === 'auftritt') { p.schritt = zeit * .014; p.huepfen = -Math.abs(Math.sin(zeit * .007)) * 2; p.ohren = Math.sin(zeit * .012 - 1) * 2.5; p.neigung = Math.sin(zeit * .007) * .018; p.arme = Math.sin(zeit * .007) * 1.2; }
  else if (name === 'niederlage') { p.atmen = 0; p.kopf = -Math.sin(u * Math.PI) * 2; p.ohren = Math.sin(u * 10) * 1.8 * (1 - u); p.stauchen = bogen * .5; }
  else if (name === 'zustandNervoes') { p.zittern = Math.sin(t * 28) * 1.1; p.ohren = Math.sin(t * 14) * .8; }
  else if (name === 'zustandKnurren') { p.atmen *= 1.5; p.arme = Math.sin(t * 9) * .3; p.neigung = Math.sin(t * 2) * .008; }
  else if (name === 'schnueffeln') { p.kopf = -Math.abs(Math.sin(u * 12)) * 2.3; p.ohren = Math.sin(u * 16) * 2.2; }
  else if (name === 'einnicken') { p.kopf = bogen * 3; p.neigung = bogen * .025; }
  else if (/^ruhe/.test(name)) p.blick = bogen * (name === 'ruheLinks' ? -1.2 : 1.2);
  if (!/^treffer|niederlage|einnicken/.test(name)) { var blink = t % 4.3; p.blinzeln = blink < .18 ? Math.sin(blink / .18 * Math.PI) : 0; }
  return p;
}
function bossSchweinRig(element, bilder, darfLaufen) {
  var canvas = document.createElement('canvas'), gl, ctx, programm, buffer, texturen = new Map(), raf = 0, tot = false, aktuell = null, vorher = null, wechsel = 0, start = performance.now(), letzteZeit = 0, wucht = 1, fluss = null, uebergang = 70, sequenz = '', dauer = 1, sequenzStart = start;
  canvas.className = 'boss-schwein-netz'; canvas.setAttribute('aria-hidden', 'true');
  var dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = 300 * dpr; canvas.height = 280 * dpr;
  var xs = [0, 60, 80, 96, 108, 116, 128, 140, 148, 160, 178, 200, 256], ys = [0, 64, 80, 96, 106, 117, 128, 144, 164, 190, 218, 238, 250, 256], dreiecke = [];
  for (var j = 0; j < ys.length - 1; j++) for (var i = 0; i < xs.length - 1; i++) { var a = [xs[i], ys[j]], b = [xs[i + 1], ys[j]], c = [xs[i], ys[j + 1]], d = [xs[i + 1], ys[j + 1]]; dreiecke.push([a, b, c], [b, d, c]); }
  try {
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, depth: false, stencil: false, preserveDrawingBuffer: false });
    if (gl) {
      function shader(art, code) { var s = gl.createShader(art); gl.shaderSource(s, code); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error('Shader'); return s; }
      var vs = shader(gl.VERTEX_SHADER, 'attribute vec4 punkt;varying vec2 uv;void main(){gl_Position=vec4(punkt.xy,0.,1.);uv=punkt.zw;}');
      var fs = shader(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 uv;uniform sampler2D bild;uniform float alpha;void main(){gl_FragColor=texture2D(bild,uv)*alpha;}');
      programm = gl.createProgram(); gl.attachShader(programm, vs); gl.attachShader(programm, fs); gl.linkProgram(programm); gl.deleteShader(vs); gl.deleteShader(fs); if (!gl.getProgramParameter(programm, gl.LINK_STATUS)) throw Error('Programm');
      gl.useProgram(programm); buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); var ort = gl.getAttribLocation(programm, 'punkt'); gl.enableVertexAttribArray(ort); gl.vertexAttribPointer(ort, 4, gl.FLOAT, false, 0, 0);
      // Gewichtete vormultiplizierte Posen ergeben zusammen volle Deckkraft.
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.viewport(0, 0, canvas.width, canvas.height);
    }
  } catch (_) { gl = null; }
  function ersatz() { var neu = document.createElement('canvas'); neu.className = canvas.className; neu.width = canvas.width; neu.height = canvas.height; neu.setAttribute('aria-hidden', 'true'); if (canvas.parentNode) canvas.replaceWith(neu); canvas = neu; ctx = canvas.getContext('2d'); }
  if (!gl) ersatz();
  if (!gl && !ctx) return null;
  function verloren(e) { e.preventDefault(); if (tot) return; gl = null; texturen.clear(); ersatz(); render(performance.now(), false); }
  canvas.addEventListener('webglcontextlost', verloren);
  function punkt(q, f, p, feld, gewicht) { var x=q[0]+128-(f.ankerX||128),d=bossSchweinFlussPunkt(feld,x,q[1],gewicht);return bossSchweinNetzPunkt(x+d[0],q[1]+d[1],p); }
  function zeichne(f, alpha, p, feld, gewicht) {
    if (!f || alpha <= 0) return; var bild = bilder.get(f.atlas); if (!bild) return;
    if (gl) {
      var tex = texturen.get(f.atlas);
      if (!tex) { tex = gl.createTexture(); texturen.set(f.atlas, tex); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bild); } else gl.bindTexture(gl.TEXTURE_2D, tex);
      var werte = new Float32Array(dreiecke.length * 12), k = 0;
      dreiecke.forEach(function (d) { d.forEach(function (q) { var v = punkt(q, f, p, feld, gewicht); werte[k++] = ((v[0] * 240 / 256 + 30) / 300) * 2 - 1; werte[k++] = 1 - ((v[1] * 240 / 256 + 20) / 280) * 2; werte[k++] = (f.x + q[0] * f.zelle / 256) / f.groesse; werte[k++] = (f.y + q[1] * f.zelle / 256) / f.groesse; }); });
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, werte, gl.DYNAMIC_DRAW); gl.uniform1f(gl.getUniformLocation(programm, 'alpha'), alpha); gl.drawArrays(gl.TRIANGLES, 0, werte.length / 4);
    } else {
      ctx.globalAlpha = alpha;
      // Dieselbe Verformung mit einem gröberen Netz als Ersatz bei fehlendem WebGL.
      for (var y = 0; y < 256; y += 32) for (var x = 0; x < 256; x += 32) [[ [x,y],[x+32,y],[x,y+32] ],[ [x+32,y+32],[x,y+32],[x+32,y] ]].forEach(function (tri) {
        var a = tri[0], b = tri[1], c = tri[2], aa = punkt(a,f,p,feld,gewicht), bb = punkt(b,f,p,feld,gewicht), cc = punkt(c,f,p,feld,gewicht), det = (b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
        var m0=((bb[0]-aa[0])*(c[1]-a[1])-(cc[0]-aa[0])*(b[1]-a[1]))/det, m2=((cc[0]-aa[0])*(b[0]-a[0])-(bb[0]-aa[0])*(c[0]-a[0]))/det;
        var m1=((bb[1]-aa[1])*(c[1]-a[1])-(cc[1]-aa[1])*(b[1]-a[1]))/det, m3=((cc[1]-aa[1])*(b[0]-a[0])-(bb[1]-aa[1])*(c[0]-a[0]))/det;
        ctx.save(); ctx.translate(30,20);ctx.scale(240/256,240/256);ctx.beginPath();[aa,bb,cc].forEach(function(v,i){if(i)ctx.lineTo(v[0],v[1]);else ctx.moveTo(v[0],v[1]);});ctx.closePath();ctx.clip();ctx.transform(m0,m1,m2,m3,aa[0]-m0*a[0]-m2*a[1],aa[1]-m1*a[0]-m3*a[1]);ctx.drawImage(bild,f.x,f.y,f.zelle,f.zelle,0,0,256,256);ctx.restore();
      });
    }
  }
  function render(zeit, animiert) {
    if (tot || !aktuell) return;
    var p = animiert ? bossSchweinBewegung(sequenz, zeit - start, (zeit - sequenzStart) / dauer, wucht) : {};
    if (element.closest('.boss-hitstop')) p = {};
    if (gl) { gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); } else { ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalCompositeOperation='lighter';ctx.clearRect(0,0,300,280); }
    var anteil = animiert && vorher ? Math.max(0,Math.min(1,(zeit-wechsel)/uebergang)) : 1;anteil=anteil*anteil*(3-2*anteil);
    if (anteil < 1) zeichne(vorher,1-anteil,p,fluss&&fluss[0],anteil); else vorher=null;
    zeichne(aktuell,anteil,p,fluss&&fluss[1],1-anteil); var modus=gl?'webgl':'canvas2d';if(canvas.getAttribute('data-renderer')!==modus)canvas.setAttribute('data-renderer',modus);
  }
  function tick(zeit) { raf=0;if(tot||!darfLaufen()||!canvas.isConnected){return;}if(zeit-letzteZeit>=15){render(zeit,true);letzteZeit=zeit;}raf=requestAnimationFrame(tick); }
  function starten() { if(!raf&&!tot&&darfLaufen())raf=requestAnimationFrame(tick); }
  return {
    pose: function(s,f,name,index,sofort){ var neu=Object.assign({atlas:s.atlas,zelle:s.zelle,groesse:s.groesse,key:(s.art||(s.atlas.match(/schweinehund1-([a-z]+)-/)||[])[1])+':'+(f.x/s.zelle+f.y/s.zelle*2)},f),gleich=aktuell&&aktuell.atlas===neu.atlas&&aktuell.x===neu.x&&aktuell.y===neu.y;
      fluss=sofort||gleich?null:bossSchweinFluss(aktuell&&aktuell.key,neu.key);uebergang=fluss?Math.min(160,Math.max(70,neu.dauer*.8)):70;vorher=sofort||gleich?null:aktuell;aktuell=neu;wechsel=performance.now();if(!element.contains(canvas))element.replaceChildren(canvas);render(wechsel,!sofort&&darfLaufen());starten(); },
    bewegung: function(name,ms,staerke){sequenz=name;sequenzStart=performance.now();dauer=ms||1000;wucht=staerke||1;starten();},
    start: starten,
    stop: function(){cancelAnimationFrame(raf);raf=0;vorher=null;},
    statisch: function(){cancelAnimationFrame(raf);raf=0;vorher=null;render(performance.now(),false);},
    destroy: function(){tot=true;cancelAnimationFrame(raf);canvas.removeEventListener('webglcontextlost',verloren);if(gl){texturen.forEach(function(t){gl.deleteTexture(t);});gl.deleteBuffer(buffer);gl.deleteProgram(programm);var ext=gl.getExtension('WEBGL_lose_context');if(ext)ext.loseContext();}texturen.clear();canvas.remove();}
  };
}
