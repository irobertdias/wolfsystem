const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
(async()=>{
 const raiz=process.argv[2]||'/root/wolf-whatsapp';
 const pp=require(require.resolve('puppeteer',{paths:[path.dirname(require.resolve('whatsapp-web.js',{paths:[raiz]}))]}));
 const bin=require('./browser.cjs').selecionar();
 const perfil=fs.mkdtempSync(path.join(os.tmpdir(),'wolf-browser-smoke-'));let browser;
 try{
  browser=await pp.launch({executablePath:bin,headless:true,userDataDir:perfil,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],timeout:30000});
  const page=await browser.newPage();await page.goto('https://web.whatsapp.com',{waitUntil:'domcontentloaded',timeout:45000});
  if(!page.url().startsWith('https://web.whatsapp.com'))throw Error('Navegador não abriu WhatsApp Web');
  console.log('BROWSER_SMOKE_OK: '+await browser.version());
 }finally{if(browser)await browser.close();if(path.dirname(perfil)===path.resolve(os.tmpdir())&&path.basename(perfil).startsWith('wolf-browser-smoke-'))fs.rmSync(perfil,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1});
