/* Gipfelsturm: echte Wochenziele, bestätigte Ankünfte und eine gemeinsame Expedition. */
var gipfelStaende={},gipfelAbbrechen=null,gipfelFensterbreite=window.innerWidth,gipfelDarstellung=null;
var gipfelBewegungsWahl=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)');
document.addEventListener('visibilitychange',function(){if(document.hidden&&gipfelAbbrechen)gipfelAbbrechen();});
window.addEventListener('resize',function(){if(window.innerWidth!==gipfelFensterbreite){if(gipfelAbbrechen)gipfelAbbrechen();else if(gipfelDarstellung)gipfelDarstellung();}gipfelFensterbreite=window.innerWidth;});
if(gipfelBewegungsWahl&&gipfelBewegungsWahl.addEventListener)gipfelBewegungsWahl.addEventListener('change',function(e){if(e.matches&&gipfelAbbrechen)gipfelAbbrechen();document.querySelectorAll('.ms-gipfel[data-bergphase="ende"] .gp-replay').forEach(function(b){b.disabled=e.matches;});});
function gipfelZahl(n){return typeof n==='number'&&Number.isFinite(n)?Math.max(0,n):0;}
function gipfelOben(k){return !!(k&&typeof k.oben==='string'&&k.oben.length&&Number.isFinite(Date.parse(k.oben)));}
function gipfelAnteil(k){return gipfelOben(k)?1:Math.min(.985,gipfelZahl(k&&k.anteil));}
function gipfelKarte(s){return new Map((s.kletterer||[]).map(function(k){return[k.id,k];}));}
function gipfelAnkuenfte(s){return(s.kletterer||[]).filter(gipfelOben).slice().sort(function(x,y){return Date.parse(x.oben)-Date.parse(y.oben);}).map(function(k){return k.id;});}
function gipfelWechsel(vorher,station){
  var alt=gipfelKarte(vorher),neu=gipfelKarte(station.stand),korrektur=station.art==='korrektur'||gipfelZahl(vorher.ziel)!==gipfelZahl(station.stand.ziel);
  alt.forEach(function(k,id){var n=neu.get(id);if(!n||gipfelZahl(n.last)<gipfelZahl(k.last)||gipfelZahl(n.anteil)<gipfelZahl(k.anteil)||(gipfelOben(k)&&(!gipfelOben(n)||n.oben!==k.oben)))korrektur=true;});
  var steigt=[],trainiert=[];neu.forEach(function(k,id){var v=alt.get(id);if(gipfelZahl(k.last)>gipfelZahl(v&&v.last)){trainiert.push(id);if(gipfelAnteil(k)>gipfelAnteil(v))steigt.push(id);}});
  return{korrektur:korrektur,training:!korrektur&&station.art==='training'&&trainiert.length>0,steigt:korrektur?[]:steigt,trainiert:trainiert,ankunft:korrektur?[]:gipfelAnkuenfte(station.stand).filter(function(id){return !gipfelOben(alt.get(id));})};
}
// Punkte folgen dem gezeichneten Weg. Der Anteil steuert die Höhe, nicht den Rang.
function gipfelWeg(p){
  var punkte=[[15,92.5],[22,88],[60,83],[72,80],[65,78],[28,72],[23,69],[28,67],[65,61],[74,55],[70,54],[34,47],[28,44],[33,42],[62,37],[70,32],[65,30],[48,25],[45,24],[49,22],[56,19],[57,17],[55,15],[57,13.5],[58,12.4]];
  var y=92.5-(92.5-12.4)*Math.max(0,Math.min(1,p));
  for(var i=1;i<punkte.length;i++)if(y>=punkte[i][1]){var t=(punkte[i-1][1]-y)/(punkte[i-1][1]-punkte[i][1]);return{x:punkte[i-1][0]+(punkte[i][0]-punkte[i-1][0])*t,y:y};}
  return{x:58,y:12.4};
}
function gipfelPositionen(s,spieler,breite,hoehe){
  var karte=gipfelKarte(s),n=spieler.length,w=Math.min(n>32?14:n>12?22:n>6?28:34,(hoehe*.14-4)/1.5),label=n>32?0:14,h=w*1.5,belegt=[],plan=new Map(),rangen=gipfelAnkuenfte(s);
  var reihe=spieler.map(function(sp,i){return{sp:sp,i:i,k:karte.get(sp.id)||{anteil:0}};}).sort(function(a,b){return Number(!!b.sp.ich)-Number(!!a.sp.ich)||gipfelAnteil(b.k)-gipfelAnteil(a.k)||a.i-b.i;});
  reihe.forEach(function(e){
    var p=gipfelAnteil(e.k),weg=gipfelWeg(p),x=weg.x/100*breite,y=Math.max(h+3,Math.min(hoehe-label-4,weg.y/100*hoehe)),gefunden=null,cols=Math.ceil(breite/(w+5));
    for(var zeile=0;zeile<n+1&&!gefunden;zeile++){
      var dy=zeile===0?0:(p>.7?1:-1)*Math.ceil(zeile/2)*(h+label+4)*(zeile%2?1:-1);
      for(var spalte=0;spalte<=cols*2&&!gefunden;spalte++){
        var dx=spalte===0?0:Math.ceil(spalte/2)*(w+5)*(spalte%2?1:-1),cx=x+dx,cy=y+dy;
        if(cx<w/2+3||cx>breite-w/2-3||cy<h+3||cy>hoehe-label-4)continue;
        if(p>.92&&cx<Math.max(0,48-(cy/hoehe-.14)*70)/100*breite)continue;
        var box={l:cx-w/2-2,r:cx+w/2+2,t:cy-h-2,b:cy+label+2};
        if(!belegt.some(function(b){return box.l<b.r&&box.r>b.l&&box.t<b.b&&box.b>b.t;})){gefunden={x:cx/breite*100,y:cy/hoehe*100,p:p,w:w,rang:rangen.indexOf(e.sp.id)+1};belegt.push(box);}
      }
    }
    // Nur für eine geometrisch unmögliche übergroße Gruppe; alle IDs bleiben vorhanden.
    if(!gefunden)gefunden={x:8+e.i%12*7.5,y:Math.min(94,18+Math.floor(e.i/12)*6),p:p,w:w,rang:rangen.indexOf(e.sp.id)+1};
    plan.set(e.sp.id,gefunden);
  });return plan;
}
function gipfelSchritte(vor,nach){
  var frames=[],schritte=Math.max(1,Math.ceil(Math.abs(nach.p-vor.p)/.008)),a=gipfelWeg(vor.p),b=gipfelWeg(nach.p);
  for(var i=0;i<=schritte;i++){var t=i/schritte,w=gipfelWeg(vor.p+(nach.p-vor.p)*t);frames.push({left:(w.x+(vor.x-a.x)*(1-t)+(nach.x-b.x)*t)+'%',top:(w.y+(vor.y-a.y)*(1-t)+(nach.y-b.y)*t)+'%',offset:t});}return frames;
}
function gipfelZyklus(){return[[0,0],[-200,0],[0,-300],[-200,-300],[0,0]].map(function(p,i){return{transform:'translate('+p[0]+'px,'+p[1]+'px)',offset:i/4,easing:'steps(1,end)'};});}
function gipfelSignaturen(stationen){return stationen.map(function(s){return JSON.stringify([s.art,s.stand]);});}
function gipfelFortsetzung(alt,neu){if(!neu.length)return null;if(!alt||!alt.length||!alt.every(function(s,i){return s===neu[i];}))return 0;return alt.length===neu.length?null:alt.length-1;}
var gipfelBildCache=new Map(),gipfelBildFehler=new Set();
function gipfelBilder(a){var urls=new Set(Object.values(a.bergBilder||{}));a.spieler.forEach(function(sp){var bilder=a.figuren&&a.figuren[sp.figur];['laufen','steigen'].forEach(function(p){var m=bilder&&bilder[p]&&/href="([^"]+)"/.exec(bilder[p]);if(m)urls.add(m[1]);});});return Promise.all(Array.from(urls).map(function(url){if(!gipfelBildCache.has(url))gipfelBildCache.set(url,new Promise(function(ok){var b=new Image();b.onload=function(){gipfelBildFehler.delete(url);ok(true);};b.onerror=function(){gipfelBildFehler.add(url);gipfelBildCache.delete(url);ok(false);};b.src=url;}));return gipfelBildCache.get(url);}));}
window.MINISPIEL_SZENEN=window.MINISPIEL_SZENEN||{};
window.MINISPIEL_SZENEN.gipfel=function(a){
  if(gipfelAbbrechen)gipfelAbbrechen();
  var spieler=new Map(a.spieler.map(function(sp){return[sp.id,sp];})),aktuell=a.aktuell||{kletterer:[]},stationen=(a.verlauf||[]).filter(function(s){return !!s.stand;});
  if(!stationen.length)stationen=[{art:'start',zeitpunkt:null,stand:aktuell}];
  var signaturen=gipfelSignaturen(stationen),gesehen=gipfelStaende[a.id],lauf=0,animationen=new Set(),wartende=new Map();
  var status=el('div',{class:'ms-status',role:'status','aria-live':'polite'}),titel=el('div',{class:'gp-kopf'},[el('strong',{text:'Mount Botzeps'}),el('span',{text:'8.848 m · euer Wochenziel'})]);
  var landschaft=el('div',{class:'gp-landschaft','aria-hidden':'true'}),wetter=el('div',{class:'gp-wetter'}),feld=el('div',{class:'gp-feld','aria-hidden':'true'}),kino=el('div',{class:'gp-kino','aria-hidden':'true'});kino.hidden=true;
  var welt=el('div',{class:'gp-welt'},[landschaft,wetter,feld]),arena=el('div',{class:'gp-arena'},[welt,kino]);
  var liste=el('div',{class:'gp-liste',role:'list','aria-label':'Alle Bergsteiger und ihr tatsächlicher Fortschritt'}),fenster=el('div',{class:'gp-fenster',tabindex:'0','aria-label':'Bergsteiger, seitlich scrollbar'},[liste]);
  var zeit=el('div',{class:'ms-zeit'}),skip=el('button',{class:'knopf leise',text:'Überspringen'}),replay=el('button',{class:'knopf leise gp-replay',text:'↻ Nochmal ansehen'}),laden=el('button',{class:'knopf leise',text:'↻ Stand aktualisieren',onclick:function(){aktualisiereBombe(laden);}});
  var fazit=el('div',{class:'gp-fazit'}),root=el('section',{class:'ms-scene ms-gipfel','aria-label':'Gipfelsturm auf dem gemeinsamen Bergpfad'},[status,titel,arena,el('div',{class:'gp-legende',text:'Basislager < 25 % · Felsroute · Gipfel am Wochenziel'}),fazit,fenster,zeit,el('div',{class:'ms-steuerung'},[skip,replay,laden])]);
  function name(id){return spieler.has(id)?spieler.get(id).name:'Unbekannt';}
  function z(n){return gipfelZahl(n).toLocaleString('de-DE',{maximumFractionDigits:1});}
  function bewegung(){return !(gipfelBewegungsWahl&&gipfelBewegungsWahl.matches);}
  function gueltig(nr){return nr===lauf&&root.isConnected&&!document.hidden&&bewegung();}
  function phase(p){root.setAttribute('data-bergphase',p);}
  function geometrie(){var breite=arena.clientWidth||Math.min(448,Math.max(240,window.innerWidth-64)),hoehe=breite*1.25;root.style.setProperty('--gp-kino-h',Math.min(218,hoehe*.52)+'px');root.style.setProperty('--gp-karte-y',(Math.min(218,hoehe*.52)+8)+'px');root.style.setProperty('--gp-karte-scale',String((hoehe-Math.min(218,hoehe*.52)-12)/hoehe));return{w:breite,h:hoehe};}
  function plan(s){var g=geometrie();return gipfelPositionen(s,a.spieler,g.w,g.h);}
  function reinigen(){animationen.forEach(function(an){an.cancel();});animationen.clear();wartende.forEach(function(ok,t){clearTimeout(t);ok(false);});wartende.clear();feld.replaceChildren();wetter.replaceChildren();kino.replaceChildren();kino.hidden=true;root.removeAttribute('data-kino');root.removeAttribute('data-ergebnis');}
  function warten(ms,nr){return new Promise(function(ok){var t=setTimeout(function(){wartende.delete(t);ok(gueltig(nr));},ms);wartende.set(t,ok);});}
  function bewegen(e,frames,opt,nr){if(!gueltig(nr)||!e)return Promise.resolve(false);var an=e.animate(frames,Object.assign({fill:'forwards'},opt));animationen.add(an);return an.finished.then(function(){if(!gueltig(nr))return false;var f=frames[frames.length-1];['transform','opacity','left','top'].forEach(function(p){if(f[p]!=null)e.style[p]=f[p];});return true;},function(){return false;}).finally(function(){animationen.delete(an);an.cancel();});}
  function pose(e,p){minispielSetzePose(e.querySelector('.ms-avatar'),a,e.getAttribute('data-id'),p);}
  function bild(container,url,klasse){if(!url||gipfelBildFehler.has(url))return;var b=el('img',{class:klasse||'',src:url,alt:''});b.onerror=function(){gipfelBildFehler.add(url);b.remove();};container.appendChild(b);}
  function hintergrund(){landschaft.replaceChildren();bild(landschaft,a.bergBilder&&a.bergBilder.panorama);}
  function zeichneFeld(s){
    feld.replaceChildren();var karte=gipfelKarte(s),positionen=plan(s),elemente=new Map();root.setAttribute('data-feld',a.spieler.length>32?'gross':'normal');
    a.spieler.forEach(function(sp){var k=karte.get(sp.id)||{},p=positionen.get(sp.id),oben=gipfelOben(k),avatar=minispielAvatar(a,sp.id,oben?'jubel':gipfelAnteil(k)>0?'klettern':'bereit');
      var e=el('div',{class:'gp-laeufer'+(oben?' gp-oben':''),'data-id':sp.id,'data-ich':String(!!sp.ich),'data-oben':String(oben),'data-anteil':String(gipfelZahl(k.anteil))},[el('div',{class:'gp-koerper'},[avatar]),el('span',{class:'gp-name',text:(oben?'⚑ '+p.rang+' · ':'')+sp.name+(sp.ich?' · Du':''),title:sp.name})]);
      e.style.left=p.x+'%';e.style.top=p.y+'%';e.style.width=p.w+'px';e.style.setProperty('--gp-figur',p.w+'px');e.title=sp.name+' · '+z(k.last)+' Last'+(oben?' · '+p.rang+'. am Gipfel':'');feld.appendChild(e);elemente.set(sp.id,e);
    });return elemente;
  }
  function standText(k,rang){return gipfelOben(k)?'⚑ '+rang+'. am Gipfel':gipfelZahl(k.anteil)>=.999?'Fast oben':z(gipfelZahl(k.anteil)*100)+' % · '+(gipfelZahl(k.anteil)<.25?'Basislager':'Unterwegs');}
  function zeichneListe(s){
    var karte=gipfelKarte(s),oben=gipfelAnkuenfte(s);titel.lastChild.textContent='8.848 m · '+(gipfelZahl(s.ziel)>0?z(s.ziel)+' Last':'euer Wochenziel');root.setAttribute('data-oben',String(oben.length));liste.replaceChildren();
    a.spieler.forEach(function(sp){var k=karte.get(sp.id)||{},rang=oben.indexOf(sp.id)+1,balken=el('div',{class:'gp-balken','aria-hidden':'true'},[el('i')]);balken.firstChild.style.width=Math.min(100,gipfelZahl(k.anteil)*100)+'%';
      liste.appendChild(el('div',{class:'gp-person'+(gipfelOben(k)?' gp-angekommen':''),role:'listitem','data-id':sp.id,'data-ich':String(!!sp.ich),'data-oben':String(gipfelOben(k)),'aria-label':sp.name+': '+standText(k,rang)+', '+z(k.last)+' Last'},[minispielAvatar(a,sp.id,gipfelOben(k)?'jubel':'bereit'),el('span',{class:'gp-person-name',text:sp.name+(sp.ich?' · Du':''),title:sp.name}),el('strong',{class:'gp-last',text:gipfelZahl(s.ziel)>0?z(k.last)+' / '+z(s.ziel)+' Last':z(k.last)+' Last',title:z(k.last)+' Last'}),el('span',{class:'gp-wert',text:standText(k,rang)}),balken]));
    });
    if(!a.spieler.length)liste.appendChild(el('p',{class:'gp-leer',text:'Die Seilschaft wird zusammengestellt.'}));
    fazit.textContent=oben.length?oben.length+' von '+a.spieler.length+' am Gipfel · zuerst '+name(oben[0]):'Gipfel = Wochenziel. Jede Einheit bringt euch höher.';
  }
  function zeige(id){var e=Array.from(liste.children).find(function(e){return e.getAttribute('data-id')===id;});if(e)fenster.scrollLeft=Math.max(0,e.offsetLeft+e.offsetWidth/2-fenster.clientWidth/2);}
  function beschreibe(s,fertig){var oben=gipfelAnkuenfte(s);if(!a.spieler.length)return 'Die Expedition wartet auf ihre Bergsteiger.';if(fertig&&a.abgeschlossen)return oben.length?'Expedition beendet · '+oben.length+' am Gipfel':'Expedition beendet · diesmal blieb der Gipfel frei';return oben.length?oben.length+' von '+a.spieler.length+' am Gipfel · '+name(oben[0])+' war zuerst oben':'Die Expedition ist unterwegs · jeder klettert zum Wochenziel';}
  function endstand(merken){phase('ende');root.setAttribute('data-rueckblick','false');root.removeAttribute('data-kino');kino.hidden=true;kino.replaceChildren();zeichneListe(aktuell);zeichneFeld(aktuell);hintergrund();status.textContent=beschreibe(aktuell,true);zeit.textContent=a.abgeschlossen?'Wochenabschluss':'Aktueller Stand';if(a.abgeschlossen&&a.spieler.length)root.setAttribute('data-ergebnis',gipfelAnkuenfte(aktuell).length?'gipfel':'unterwegs');skip.hidden=true;replay.hidden=!a.spieler.length;replay.disabled=!bewegung();var ich=a.spieler.find(function(sp){return sp.ich;});if(ich)zeige(ich.id);if(merken&&root.isConnected)gipfelStaende[a.id]={signaturen:signaturen,abgeschlossen:!!a.abgeschlossen};}
  function abbrechen(){lauf++;reinigen();endstand(true);if(gipfelAbbrechen===abbrechen)gipfelAbbrechen=null;}
  function station(i){var s=stationen[i],d=s.zeitpunkt&&new Date(s.zeitpunkt);zeit.textContent=(i+1)+' / '+stationen.length+(d&&Number.isFinite(d.getTime())?' · '+d.toLocaleString('de-DE',{timeZone:a.zeitzone||'Europe/Berlin',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'')+(s.art==='korrektur'?' · Korrektur':'');}
  function wetterzug(nr,dauer,schnee){
    for(var i=0;i<(schnee?6:2);i++){var e=el('i',{class:schnee?'gp-schnee':'gp-wolke'});e.style.left=(12+i*14)+'%';e.style.top=(schnee?15+i%3*18:24+i*28)+'%';wetter.appendChild(e);bewegen(e,[{opacity:0,transform:'translate(0,0)'},{opacity:schnee?.65:.16,offset:.25},{opacity:0,transform:schnee?'translate(-22px,32px)':'translate(22px,-3px)'}],{duration:dauer},nr).then(function(teil){teil.remove();}.bind(null,e));}
  }
  function zyklus(e,p,nr,dauer,index,frames){
    pose(e,p);var atlas=e.querySelector('.bz-berg-atlas,.bz-lauf-atlas');if(atlas&&gipfelBildFehler.has(atlas.getAttribute('href'))){pose(e,'klettern');atlas=null;}
    if(atlas){var lauf=bewegen(atlas,gipfelZyklus(),{duration:p==='steigen'?650:430,iterations:dauer/(p==='steigen'?650:430),iterationStart:index%4/4},nr),spiegel=e.querySelector('.bz-lauf-spiegel');if(p==='laufen'&&spiegel&&frames){var blick=1,bilder=frames.map(function(f,i){var dx=i+1<frames.length?parseFloat(frames[i+1].left)-parseFloat(f.left):0;if(Math.abs(dx)>.01)blick=dx<0?-1:1;return{transform:blick<0?'translate(200px,0) scaleX(-1)':'translate(0,0) scaleX(1)',offset:f.offset,easing:'steps(1,end)'};});return Promise.all([lauf,bewegen(spiegel,bilder,{duration:dauer},nr)]).then(function(a){return a.every(Boolean);});}return lauf;}
    return bewegen(e.querySelector('.gp-koerper'),[{transform:'translateY(0)'},{transform:'translateY(-3px)'},{transform:'translateY(0)'}],{duration:450,iterations:dauer/450},nr);
  }
  async function auftritt(s,nr){phase('auftritt');zeichneFeld(s);var karte=el('div',{class:'gp-auftritt'},[el('span',{text:'DIE EXPEDITION BEGINNT'}),el('strong',{text:'Mount Botzeps'}),el('small',{text:'Euer Wochenziel. Euer Gipfel.'})]);feld.appendChild(karte);wetterzug(nr,1000,false);if(!await bewegen(karte,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:350},nr))return false;if(!await warten(550,nr))return false;if(!await bewegen(karte,[{opacity:1},{opacity:0}],{duration:220},nr))return false;karte.remove();return true;}
  function fokus(ids){return ids.slice().sort(function(x,y){return Number(!!(spieler.get(y)&&spieler.get(y).ich))-Number(!!(spieler.get(x)&&spieler.get(x).ich));})[0];}
  async function nahaufnahme(id,s,art,nr,mehr){
    if(!spieler.has(id))return true;root.setAttribute('data-kino','true');kino.hidden=false;kino.replaceChildren();var oben=gipfelAnkuenfte(s),rang=oben.indexOf(id)+1,ankunft=art==='ankunft'||art==='abschluss';
    var url=a.bergBilder&&(ankunft&&oben.length?a.bergBilder.gipfelblick:art==='abschluss'?a.bergBilder.felswand:a.bergBilder.felswand);bild(kino,url,'gp-kino-kulisse');
    var titelText=art==='ankunft'?name(id)+' erreicht den Gipfel':art==='abschluss'?oben.length?'Gemeinsam oben':'Die Expedition geht zu Ende':art==='schnee'?'Die letzten Höhenmeter':'Jetzt wird geklettert';
    var titel=el('strong',{class:'gp-kino-titel',text:titelText}),text=el('div',{class:'gp-kino-text',text:art==='ankunft'?'⚑ '+rang+'. am Gipfel'+(mehr>1?' · '+(mehr-1)+' weitere oben':''):art==='abschluss'?oben.length?oben.length+' haben ihr Wochenziel erreicht':'Niemand hat das Wochenziel erreicht':name(id)+' · '+z((gipfelKarte(s).get(id)||{}).last)+' Last'});
    var hero=el('div',{class:'gp-held','data-id':id},[el('div',{class:'gp-koerper'},[minispielAvatar(a,id,ankunft?(oben.includes(id)?'jubel':'bereit'):'steigen')]),el('span',{class:'gp-held-name',text:name(id)+(spieler.get(id).ich?' · Du':'')})]);kino.appendChild(titel);kino.appendChild(hero);kino.appendChild(text);
    var hoehe=Math.min(218,geometrie().h*.52),breite=Math.min(104,(hoehe-52)/1.5);hero.style.width=breite+'px';hero.style.setProperty('--gp-figur',breite+'px');
    var landschaftBild=kino.querySelector('.gp-kino-kulisse');if(landschaftBild)bewegen(landschaftBild,[{transform:'scale(1.05) translateX(0)'},{transform:'scale(1.05) translateX(-2%)'}],{duration:1300},nr);
    bewegen(kino,[{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'translateY(0)'}],{duration:200},nr);
    if(ankunft){
      phase(art);if(oben.length){var fahne=el('div',{class:'gp-grosse-fahne'});fahne.innerHTML='<svg viewBox="0 0 70 100"><path d="M13 95V7" fill="none" stroke="#293f4f" stroke-width="6" stroke-linecap="round"/><path d="M13 12Q27 4 40 12T65 12V47Q52 55 39 47T13 47Z" fill="#f3c862" stroke="#293f4f" stroke-width="3"/><path d="M39 12V47" stroke="#b58a37" stroke-width="2" fill="none"/><path d="M6 97L13 91 23 97" fill="#7f9299" stroke="#293f4f" stroke-width="2"/></svg>';fahne.appendChild(el('span',{class:'gp-flaggenrang',text:art==='ankunft'?String(rang):'★'}));kino.appendChild(fahne);bewegen(fahne,[{opacity:0,transform:'translateY(14px) rotate(-15deg)'},{opacity:1,transform:'translateY(0) rotate(0deg)'}],{duration:450},nr);bewegen(hero.querySelector('.gp-koerper'),[{transform:'translateY(0)'},{transform:'translateY(-9px)'},{transform:'translateY(0)'},{transform:'translateY(-4px)'},{transform:'translateY(0)'}],{duration:800},nr);}
      if(!await warten(1400,nr))return false;
    }else{
      phase(art);wetterzug(nr,1200,art==='schnee');var bewegungen=[zyklus(hero,'steigen',nr,1300,0),bewegen(hero,[{left:'51%',top:'14px'},{left:'58%',top:'0px'}],{duration:1300,easing:'ease-in-out'},nr)];if(!(await Promise.all(bewegungen)).every(Boolean))return false;
    }
    if(!await bewegen(kino,[{opacity:1},{opacity:0}],{duration:180},nr))return false;kino.replaceChildren();kino.hidden=true;root.removeAttribute('data-kino');return true;
  }
  async function zug(vorher,s,nr){
    var w=gipfelWechsel(vorher,s),alt=plan(vorher),neu=plan(s.stand),elemente=zeichneFeld(vorher),akt=gipfelKarte(s.stand),vor=gipfelKarte(vorher);
    if(w.korrektur||!w.training){phase(w.korrektur?'korrektur':'rueckblick');zeichneListe(s.stand);zeichneFeld(s.stand);status.textContent=w.korrektur?'Der Wochenverlauf wurde korrigiert · neuer Stand':beschreibe(s.stand,false);return warten(w.korrektur?550:240,nr);}
    if(!w.steigt.length){phase('nachlegen');zeichneListe(s.stand);zeichneFeld(s.stand);status.textContent=name(fokus(w.trainiert))+' trainiert weiter · '+(w.trainiert.some(function(id){return gipfelOben(akt.get(id));})?'Gipfel bereits erreicht':'die letzten Meter bis zum Wochenziel');return warten(450,nr);}
    phase('antritt');status.textContent=w.trainiert.length===1?name(w.trainiert[0])+' macht sich an den Aufstieg':'Die Seilschaft legt nach';if(w.trainiert.length)zeige(fokus(w.trainiert));
    if(!await warten(180,nr))return false;phase('aufstieg');var dauer=1100,bewegungen=[];wetterzug(nr,dauer,w.steigt.some(function(id){return gipfelAnteil(akt.get(id))>.75;}));
    elemente.forEach(function(e,id){var frames=gipfelSchritte(alt.get(id),neu.get(id));bewegungen.push(bewegen(e,frames,{duration:dauer,easing:'ease-in-out'},nr));if(w.steigt.includes(id))bewegungen.push(zyklus(e,gipfelAnteil(akt.get(id))<.45?'laufen':'steigen',nr,dauer,a.spieler.findIndex(function(sp){return sp.id===id;}),frames));});
    if(!(await Promise.all(bewegungen)).every(Boolean))return false;zeichneListe(s.stand);zeichneFeld(s.stand);
    if(w.ankunft.length){var id=fokus(w.ankunft);status.textContent=name(id)+' ist oben · '+(gipfelAnkuenfte(s.stand).indexOf(id)+1)+'. Ankunft';if(!await nahaufnahme(id,s.stand,'ankunft',nr,w.ankunft.length))return false;}
    else{
      var fels=w.steigt.filter(function(id){return gipfelAnteil(vor.get(id))<.5&&gipfelAnteil(akt.get(id))>=.5;}),schnee=w.steigt.filter(function(id){return gipfelAnteil(vor.get(id))<.8&&gipfelAnteil(akt.get(id))>=.8;});
      if(schnee.length||fels.length){var ids=schnee.length?schnee:fels;if(!await nahaufnahme(fokus(ids),s.stand,schnee.length?'schnee':'felswand',nr,1))return false;}
      else if(!await warten(160,nr))return false;
    }return true;
  }
  async function finale(nr){var oben=gipfelAnkuenfte(aktuell).filter(function(id){return spieler.has(id);}),id=oben.length?fokus(oben):fokus(a.spieler.map(function(sp){return sp.id;}));if(!id)return true;phase('finale');zeit.textContent='Wochenabschluss';status.textContent=beschreibe(aktuell,true);return nahaufnahme(id,aktuell,'abschluss',nr,oben.length);}
  async function spiele(ab,intro){
    lauf++;reinigen();var nr=lauf;if(!root.isConnected)return;if(!bewegung()||document.hidden||!a.spieler.length){endstand(true);return;}gipfelAbbrechen=abbrechen;root.setAttribute('data-rueckblick','true');skip.hidden=false;replay.hidden=true;zeichneListe(stationen[ab].stand);zeichneFeld(stationen[ab].stand);station(ab);
    try{phase('laden');status.textContent='Die Expedition wird vorbereitet';await Promise.race([gipfelBilder(a),warten(1600,nr)]);if(!gueltig(nr))return;hintergrund();if(intro&&!await auftritt(stationen[ab].stand,nr))return;phase('bereit');status.textContent=beschreibe(stationen[ab].stand,false);if(!await warten(220,nr))return;for(var i=ab+1;i<stationen.length;i++){station(i);if(!await zug(stationen[i-1].stand,stationen[i],nr))return;}if(a.abgeschlossen&&!await finale(nr))return;}
    finally{if(nr===lauf){reinigen();if(root.isConnected)endstand(true);if(gipfelAbbrechen===abbrechen)gipfelAbbrechen=null;}}
  }
  async function korrigiere(){lauf++;reinigen();var nr=lauf;gipfelAbbrechen=abbrechen;root.setAttribute('data-rueckblick','true');phase('korrektur');skip.hidden=false;replay.hidden=true;zeichneListe(aktuell);zeichneFeld(aktuell);status.textContent='Der Wochenverlauf wurde korrigiert · neuer Stand';await warten(bewegung()&&!document.hidden?550:0,nr);if(nr===lauf){reinigen();if(root.isConnected)endstand(true);if(gipfelAbbrechen===abbrechen)gipfelAbbrechen=null;}}
  skip.onclick=abbrechen;replay.onclick=function(){spiele(0,true);};hintergrund();endstand(false);gipfelDarstellung=function(){if(root.isConnected)endstand(false);};
  requestAnimationFrame(function(){if(!root.isConnected)return;var ab=gipfelFortsetzung(gesehen&&gesehen.signaturen,signaturen);if(ab===null){if(a.abgeschlossen&&gesehen&&!gesehen.abgeschlossen)spiele(Math.max(0,stationen.length-1),false);else endstand(true);}else if(gesehen&&ab===0)korrigiere();else spiele(ab,!gesehen);});return root;
};
