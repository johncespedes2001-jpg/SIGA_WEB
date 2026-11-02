'use strict';
const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {chromium,firefox,webkit}=require('playwright');
const browserName=String(process.env.SIGA_BROWSER_ENGINE||'chromium').trim().toLowerCase();
const browserType={chromium,chrome:chromium,edge:chromium,firefox,webkit}[browserName];
if(!browserType)throw new Error(`Motor de navegador no admitido: ${browserName}`);
async function launchBrowser(){
 const options={headless:true};
 if(browserName==='chromium')options.args=['--no-sandbox','--disable-gpu'];
 if(browserName==='chrome')options.channel='chrome';
 if(browserName==='edge')options.channel='msedge';
 try{return await browserType.launch(options)}catch(error){
  const chrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if(browserName!=='chromium'||!fs.existsSync(chrome))throw error;
  return chromium.launch({...options,executablePath:chrome});
 }
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'siga-page-audit-'));
Object.assign(process.env,{ SIGA_DATA_DIR:dir,SIGA_STORAGE:'json',SIGA_DEMO_MODE:'true',SIGA_DISABLE_REQUEST_LOGS:'true',SIGA_DEMO_ADMIN_PASSWORD:'SigaAdmin2026!',SIGA_DEMO_TEACHER_PASSWORD:'SigaDocente2026!',SIGA_DEMO_COORDINATOR_PASSWORD:'SigaCoordinador2026!',SIGA_DEMO_TUTOR_PASSWORD:'SigaTutor2026!',SIGA_DEMO_PARENT_PASSWORD:'SigaPadre2026!',SIGA_DEMO_GUARD_PASSWORD:'SigaVigilante2026!',SIGA_DEMO_STUDENT_PASSWORD:'SigaEstudiante2026!',SIGA_DEMO_SECOND_STUDENT_PASSWORD:'SigaValeria2026!' });
const {app}=require('../server');
const fakeFetch=require('./in-memory-http')(app);
const accounts={administrador:['admin@siga.edu.pe','SigaAdmin2026!','administrador'],coordinador:['coordinador@siga.edu.pe','SigaCoordinador2026!','coordinador'],docente:['docente@siga.edu.pe','SigaDocente2026!','docente'],estudiante:['estudiante@siga.edu.pe','SigaEstudiante2026!','estudiante'],padre:['padre@siga.edu.pe','SigaPadre2026!','padre'],tutor:['tutor@siga.edu.pe','SigaTutor2026!','docente'],vigilante:['vigilante@siga.edu.pe','SigaVigilante2026!','vigilante']};
const requestedRoles = new Set(String(process.env.SIGA_AUDIT_ROLES || '').split(',').map((role) => role.trim()).filter(Boolean));
const requestedPages = new Set(String(process.env.SIGA_AUDIT_PAGES || '').split(',').map((page) => page.trim()).filter(Boolean));
const out=path.resolve(process.env.SIGA_PAGE_AUDIT_OUTPUT_DIR||'outputs/evidencias-qa-por-pagina'); fs.mkdirSync(out,{recursive:true}); fs.mkdirSync(path.join(out,'capturas'),{recursive:true});
const runId=new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
(async()=>{
 const browser=await launchBrowser();
 const results=[];
 for(const [role,[email,password,loginRole]] of Object.entries(accounts).filter(([role]) => !requestedRoles.size || requestedRoles.has(role))){
   const response=await fakeFetch('http://siga-test.invalid/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,role:loginRole})});
   if(response.status!==200){results.push({role,error:`Ingreso de prueba: ${response.status}`});continue;}
   const body=await response.json(); let cookie=response.headers.get('set-cookie').split(';')[0], csrf=body.user.csrf;
   if(role==='tutor'){
    const switchResponse=await fakeFetch('http://siga-test.invalid/api/account/switch-role',{method:'POST',headers:{cookie,'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({role:'tutor'})});
    if(switchResponse.status!==200){results.push({role,error:`Cambio a tutoría: ${switchResponse.status}`});continue;}
    cookie=switchResponse.headers.get('set-cookie').split(';')[0];
   }
   const context=await browser.newContext({viewport:{width:1366,height:800},reducedMotion:'reduce'});
   await context.addCookies([{name:cookie.split('=')[0],value:cookie.slice(cookie.indexOf('=')+1),domain:'siga-test.invalid',path:'/'}]);
   await context.route('**/*',async route=>{
    try { const req=route.request(), u=new URL(req.url()); if(u.hostname!=='siga-test.invalid')return route.abort();
     const headers=await req.allHeaders(); delete headers.host; delete headers['content-length']; headers['accept-encoding']='identity';
     const options={method:req.method(),headers}; if(!['GET','HEAD'].includes(req.method())) options.body=req.postDataBuffer();
     const res=await fakeFetch(req.url(),options); const resultHeaders=Object.fromEntries(res.headers); delete resultHeaders['transfer-encoding']; delete resultHeaders['connection'];
     await route.fulfill({status:res.status,headers:resultHeaders,body:Buffer.from(await res.arrayBuffer())});
    }catch(e){await route.abort();}
   });
   const page=await context.newPage(); let errors=[]; let failures=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',resp=>{if(resp.url().includes('/api/')&&resp.status()>=400) failures.push(`${resp.status()} ${new URL(resp.url()).pathname}`)});
   const root=path.resolve('public/pages',role);
   for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html')&&(!requestedPages.size||requestedPages.has(f))).sort()){
    errors=[]; failures=[]; const record={role,page:file,desktop:{},mobile:{},errors,apiErrors:failures};
    try {
      await page.setViewportSize({width:1366,height:800});
      const nav=await page.goto(`http://siga-test.invalid/pages/${role}/${file}`,{waitUntil:'networkidle',timeout:15000});
      record.http=nav.status(); record.url=new URL(page.url()).pathname;
       record.desktop=await page.evaluate(()=>{const overflow=[...document.querySelectorAll('body *')].map((node)=>{const box=node.getBoundingClientRect();return {tag:node.tagName,className:String(node.className||'').slice(0,160),id:node.id||'',left:Math.round(box.left),right:Math.round(box.right),width:Math.round(box.width),text:String(node.textContent||'').trim().replace(/\s+/g,' ').slice(0,100)};}).filter((item)=>item.right>innerWidth+1).slice(0,12);return {title:document.title,heading:document.querySelector('h1')?.innerText||'',width:document.documentElement.scrollWidth,viewport:innerWidth,body:(document.body.innerText||'').includes('No fue posible cargar'),overflow};});
      const screenshotName=`${role}-${file.replace('.html','')}-${runId}.png`;
      await page.screenshot({path:path.join(out,'capturas',screenshotName),fullPage:true});
      record.screenshot=`capturas/${screenshotName}`;
      await page.setViewportSize({width:375,height:800});
       record.mobile=await page.evaluate(()=>{const box=(selector)=>{const node=document.querySelector(selector);if(!node)return null;const rect=node.getBoundingClientRect();return {selector,left:Math.round(rect.left),right:Math.round(rect.right),width:Math.round(rect.width),computedWidth:getComputedStyle(node).width,grid:getComputedStyle(node).gridTemplateColumns};};const overflow=[...document.querySelectorAll('body *')].map((node)=>{const box=node.getBoundingClientRect();return {tag:node.tagName,className:String(node.className||'').slice(0,160),id:node.id||'',left:Math.round(box.left),right:Math.round(box.right),width:Math.round(box.width),text:String(node.textContent||'').trim().replace(/\s+/g,' ').slice(0,100)};}).filter((item)=>item.right>innerWidth+1).slice(0,12);return {width:document.documentElement.scrollWidth,viewport:innerWidth,overflow,containers:['.app-shell','.main-content','#page-content','.report-filter-panel','#report-filters'].map(box).filter(Boolean)};});
      record.result=(record.http===200&&record.url===`/pages/${role}/${file}`&&!record.desktop.body&&!errors.length&&!failures.length&&record.mobile.width<=376)?'aprobada':'revisar';
    }catch(e){record.result='error';record.reason=e.message.slice(0,300);}
    results.push(record); console.log(`${role}/${file}: ${record.result}`);
   }
   try { await context.close(); } catch (closeError) { console.warn(`Aviso al cerrar el contexto ${role}: ${closeError.message}`); }
 }
  const serializedResults=JSON.stringify(results,null,2);
  const datedResultsPath=path.join(out,`resultados-paginas-${runId}.json`);
  fs.writeFileSync(datedResultsPath,serializedResults);
  try {
    fs.writeFileSync(path.join(out,'resultados-paginas.json'),serializedResults);
  } catch (writeError) {
    console.warn(`El archivo de resultados anterior está bloqueado; la evidencia nueva quedó en ${datedResultsPath}: ${writeError.message}`);
  }
  const summary={total:results.length,approved:results.filter(x=>x.result==='aprobada').length,review:results.filter(x=>x.result!=='aprobada').length};
  console.log(JSON.stringify(summary));
  try { await browser.close(); } catch (closeError) { console.warn(`Aviso al cerrar ${browserName} después de completar la auditoría: ${closeError.message}`); }
  if(summary.review) process.exitCode=2;
})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(()=>{try{fs.rmSync(dir,{recursive:true,force:true})}catch{}});
