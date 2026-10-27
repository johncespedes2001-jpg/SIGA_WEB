'use strict';
const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {chromium}=require('playwright');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'siga-page-audit-'));
Object.assign(process.env,{ SIGA_DATA_DIR:dir,SIGA_STORAGE:'json',SIGA_DEMO_MODE:'true',SIGA_DISABLE_REQUEST_LOGS:'true',SIGA_DEMO_ADMIN_PASSWORD:'SigaAdmin2026!',SIGA_DEMO_TEACHER_PASSWORD:'SigaDocente2026!',SIGA_DEMO_COORDINATOR_PASSWORD:'SigaCoordinador2026!',SIGA_DEMO_TUTOR_PASSWORD:'SigaTutor2026!',SIGA_DEMO_PARENT_PASSWORD:'SigaPadre2026!',SIGA_DEMO_GUARD_PASSWORD:'SigaVigilante2026!',SIGA_DEMO_STUDENT_PASSWORD:'SigaEstudiante2026!',SIGA_DEMO_SECOND_STUDENT_PASSWORD:'SigaValeria2026!' });
const {app}=require('../server');
const fakeFetch=require('./in-memory-http')(app);
const accounts={administrador:['admin@siga.edu.pe','SigaAdmin2026!','administrador'],coordinador:['coordinador@siga.edu.pe','SigaCoordinador2026!','coordinador'],docente:['docente@siga.edu.pe','SigaDocente2026!','docente'],estudiante:['estudiante@siga.edu.pe','SigaEstudiante2026!','estudiante'],padre:['padre@siga.edu.pe','SigaPadre2026!','padre'],tutor:['tutor@siga.edu.pe','SigaTutor2026!','docente'],vigilante:['vigilante@siga.edu.pe','SigaVigilante2026!','vigilante']};
const out=path.resolve('outputs/evidencias-qa-por-pagina'); fs.mkdirSync(out,{recursive:true}); fs.mkdirSync(path.join(out,'capturas'),{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-sandbox','--disable-gpu']});
 const results=[];
 for(const [role,[email,password,loginRole]] of Object.entries(accounts)){
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
   for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html')).sort()){
    errors=[]; failures=[]; const record={role,page:file,desktop:{},mobile:{},errors,apiErrors:failures};
    try {
      await page.setViewportSize({width:1366,height:800});
      const nav=await page.goto(`http://siga-test.invalid/pages/${role}/${file}`,{waitUntil:'networkidle',timeout:15000});
      record.http=nav.status(); record.url=new URL(page.url()).pathname;
      record.desktop=await page.evaluate(()=>({title:document.title,heading:document.querySelector('h1')?.innerText||'',width:document.documentElement.scrollWidth,viewport:innerWidth,body:(document.body.innerText||'').includes('No fue posible cargar')}));
      await page.screenshot({path:path.join(out,'capturas',`${role}-${file.replace('.html','')}.png`),fullPage:true});
      await page.setViewportSize({width:375,height:800});
      record.mobile=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
      record.result=(record.http===200&&record.url===`/pages/${role}/${file}`&&!record.desktop.body&&!errors.length&&!failures.length&&record.mobile.width<=376)?'aprobada':'revisar';
    }catch(e){record.result='error';record.reason=e.message.slice(0,300);}
    results.push(record); console.log(`${role}/${file}: ${record.result}`);
   }
   await context.close();
 }
 await browser.close(); fs.writeFileSync(path.join(out,'resultados-paginas.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify({total:results.length,approved:results.filter(x=>x.result==='aprobada').length,review:results.filter(x=>x.result!=='aprobada').length}));
})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(()=>{try{fs.rmSync(dir,{recursive:true,force:true})}catch{}});
