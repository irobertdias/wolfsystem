const fs=require('node:fs');
function lerInicio(p){const f=fs.openSync(p,'r');try{const b=Buffer.alloc(8192);return b.subarray(0,fs.readSync(f,b,0,b.length,0)).toString('utf8')}finally{fs.closeSync(f)}}
function selecionar({env=process.env,existe=fs.existsSync,ler=lerInicio,resolver=p=>fs.realpathSync(p)}={}) {
 const configurado=env.WOLF_CHROME_PATH||env.PUPPETEER_EXECUTABLE_PATH;
 const salvo=existe(__dirname+'/webjs-browser.path')?ler(__dirname+'/webjs-browser.path').trim():'';
 for(const p of [configurado,salvo,'/usr/bin/google-chrome-stable','/usr/bin/google-chrome','/opt/google/chrome/chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean)){
  if(!p.startsWith('/')||!existe(p))continue;
  let real;try{real=resolver(p)}catch{continue}
  if(real.startsWith('/snap/')||/snap\s+run|\/snap\/bin\/chromium/.test(lerSeguro(p,ler)))continue;
  return p;
 }
 throw Error('Nenhum Chrome nativo disponível. Instale o pacote QR completo; Chromium Snap não será usado.');
}
function lerSeguro(p,ler){try{return String(ler(p)).slice(0,8192)}catch{return ''}}
module.exports={selecionar};
