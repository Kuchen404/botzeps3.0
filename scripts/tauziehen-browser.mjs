// npm run build && node scripts/tauziehen-vorschau.mjs /tmp/tauziehen.html
// PLAYWRIGHT_MODULE=/pfad/playwright/index.mjs node scripts/tauziehen-browser.mjs /tmp/tauziehen.html /tmp/tauziehen-pruefung
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync, mkdirSync} from 'node:fs';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = readFileSync(process.argv[2] || '/tmp/tauziehen.html');
const ausgabe = process.argv[3] || '/tmp/tauziehen-pruefung'; mkdirSync(ausgabe,{recursive:true});
const server = createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const basis = 'http://127.0.0.1:'+server.address().port;
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors = [];
async function instrument(p) {
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{
    window.tauRaf=new Set();window.tauZeiten=[];window.tauPhasen=[];
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(...args){return window.tauOhneCanvas?null:getContext.apply(this,args);};
    const raf=requestAnimationFrame,cancel=cancelAnimationFrame;
    window.requestAnimationFrame=f=>{let id;id=raf(t=>{window.tauRaf.delete(id);const ab=performance.now();f(t);if(f.name==='bildlauf')window.tauZeiten.push(performance.now()-ab);});if(f.name==='bildlauf')window.tauRaf.add(id);return id;};
    window.cancelAnimationFrame=id=>{window.tauRaf.delete(id);cancel(id);};
    new MutationObserver(rs=>{for(const r of rs)if(r.attributeName==='data-tauphase')window.tauPhasen.push(r.target.dataset.tauphase);}).observe(document,{attributes:true,subtree:true,attributeFilter:['data-tauphase']});
  });
}
const phase=(p,wert)=>p.waitForFunction(wert=>document.querySelector('.ms-tauziehen')?.dataset.tauphase===wert,wert,{timeout:20000});
async function modus(p,wert){await p.selectOption('#szenario',wert);await p.waitForFunction(()=>document.querySelector('.ms-tauziehen')?.dataset.rueckblick==='true'||document.querySelector('.ms-tauziehen')?.dataset.tauphase==='ende');await p.waitForTimeout(70);}
async function skip(p){await p.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));const knopf=p.getByRole('button',{name:'Überspringen',exact:true});if(await knopf.isVisible())await knopf.click();await phase(p,'ende');}
async function still(p){assert.equal(await p.evaluate(()=>window.tauRaf.size),0);assert.equal(await p.locator('.ms-tauziehen').evaluate(e=>e.getAnimations({subtree:true}).length),0);}
try {
  for(const width of [320,390,600]){
    const p=await browser.newPage({viewport:{width,height:900}});await instrument(p);await p.goto(basis);
    await phase(p,'ziehen');
    const hashes=await p.evaluate(()=>new Promise(ok=>{const a=[];function sample(){a.push(document.querySelector('.tz-koerper')?.toDataURL());if(a.length===5)ok(a);else setTimeout(sample,60);}sample();}));
    assert(new Set(hashes).size>1,'kontinuierliche Avatar-Zwischenbilder');
    assert.equal(await p.locator('[data-ergebnis]').count(),0,'kein vorzeitiger Sieg');
    const grenzen=await p.locator('.tz-person').evaluateAll(es=>es.map(e=>{const a=e.closest('.tz-arena').getBoundingClientRect(),b=e.getBoundingClientRect();return {links:b.left-a.left,rechts:a.right-b.right};}));
    assert(grenzen.every(g=>g.links>=0 && g.rechts>=0),'Figuren bleiben auf der Bühne');
    await p.locator('.ms-tauziehen').screenshot({path:ausgabe+'/ziehen-'+width+'.png'});
    await skip(p);await still(p);
    assert.equal(await p.locator('.tz-average').allTextContents().then(v=>v.join('/')),'93,33/120');
    for(const mode of ['rechts','links','gleich','nullgleich','korrektur','start','gross','leer']){
      await modus(p,mode);await skip(p);await still(p);
      const ergebnis=await p.locator('.ms-tauziehen').getAttribute('data-ergebnis');
      assert.equal(ergebnis,({rechts:'rechts',links:'links',gleich:'unentschieden',nullgleich:'unentschieden'})[mode]||null);
      if(mode==='gross')assert.equal(await p.locator('.tz-person[data-ich="true"]').count(),1);
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'kein horizontaler Überlauf');
      assert.equal(await p.locator('.tz-geriggt:not(:has(canvas))').count(),0,'Posen bleiben sichtbar');
      await p.locator('.ms-tauziehen').screenshot({path:ausgabe+'/'+mode+'-'+width+'.png'});
    }
    await modus(p,'live');await phase(p,'ausholen');
    await p.setViewportSize({width,height:800});assert.notEqual(await p.locator('.ms-tauziehen').getAttribute('data-tauphase'),'ende','Adressleistenhöhe unterbricht nicht');
    await p.setViewportSize({width:width+1,height:800});await phase(p,'ende');await still(p);
    await modus(p,'live');await phase(p,'ziehen');await p.emulateMedia({reducedMotion:'reduce'});await phase(p,'ende');await still(p);
    assert.equal(await p.locator('.tz-replay').isDisabled(),true);await p.close();
  }
  // Ein vollständiger Rückblick mit echtem Abschluss, inklusive Vorschauvideo.
  const context=await browser.newContext({viewport:{width:390,height:850},recordVideo:{dir:ausgabe,size:{width:390,height:850}}});
  const p=await context.newPage();await instrument(p);await p.goto(basis);await p.locator('.ms-tauziehen').scrollIntoViewIfNeeded();await phase(p,'ende');await still(p);
  assert((await p.evaluate(()=>window.tauPhasen)).includes('fuehrungswechsel'));
  await modus(p,'rechts');await phase(p,'stolpern');
  assert.equal(await p.locator('.tz-geriggt').count(),0,'Jubel/K.O. sind nicht vom Rig verdeckt');
  assert.equal(await p.locator('.tz-seil-kurve').isVisible(),false);assert.equal(await p.locator('.tz-seil').evaluate(e=>getComputedStyle(e).visibility),'visible');
  await p.locator('.ms-tauziehen').screenshot({path:ausgabe+'/finale.png'});await phase(p,'ende');await still(p);
  await modus(p,'gleich');await phase(p,'seilriss');await phase(p,'ende');await still(p);
  // Fehlende Medien: Initialen, Namensschilder und CSS-Ersatzbühne.
  await p.evaluate(()=>{const a=structuredClone(window.tauziehenVorschau);a.id+='-kaputt';a.abgeschlossen=false;a.tauziehenArena='/kaputt.png';a.figuren={};document.getElementById('demo').replaceChildren(MINISPIEL_SZENEN.tauziehen(a));});await skip(p);
  assert.equal(await p.locator('.ms-avatar-ersatz').count(),4);assert.equal(await p.locator('.tz-name').count(),4);
  await p.evaluate(()=>{const a=structuredClone(window.tauziehenVorschau);a.id+='-atlas-kaputt';a.abgeschlossen=false;for(const posen of Object.values(a.figuren))for(const k of Object.keys(posen))posen[k]=posen[k].replace(/href="[^"]+"/g,'href="/kaputt.png"');document.getElementById('demo').replaceChildren(MINISPIEL_SZENEN.tauziehen(a));});await skip(p);
  await p.waitForFunction(()=>document.querySelectorAll('.ms-avatar-ersatz').length===4);await still(p);
  await p.evaluate(()=>{const a=structuredClone(window.tauziehenVorschau);a.id+='-ohne-canvas';a.abgeschlossen=false;window.tauOhneCanvas=true;document.getElementById('demo').replaceChildren(MINISPIEL_SZENEN.tauziehen(a));});await skip(p);await still(p);assert.equal(await p.locator('.tz-seil').evaluate(e=>getComputedStyle(e).visibility),'visible');await p.evaluate(()=>{window.tauOhneCanvas=false;});
  await modus(p,'live');await phase(p,'ziehen');await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await phase(p,'ende');await still(p);
  await p.evaluate(()=>{delete document.hidden;});await modus(p,'live');await phase(p,'ziehen');await p.evaluate(()=>{document.querySelector('.ms-tauziehen').remove();});await p.waitForTimeout(650);assert.equal(await p.evaluate(()=>window.tauRaf.size),0);
  const kosten=await p.evaluate(()=>window.tauZeiten.filter(n=>n>0).sort((a,b)=>a-b));
  console.log('Renderdauer p95 (Desktop-Chromium):',kosten[Math.floor(kosten.length*.95)]?.toFixed(2),'ms');
  const video=p.video();await context.close();await video.saveAs(ausgabe+'/tauziehen-vorschau.webm');
  assert.deepEqual(errors,[]);console.log('OK: 320/390/600, alle Stände, flüssige Körper, finales Ergebnis, Abbruch und Ersatzdarstellung.');
} finally {await browser.close();server.close();}
