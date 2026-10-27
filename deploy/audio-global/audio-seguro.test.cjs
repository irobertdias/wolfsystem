'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const run=require('node:util').promisify(require('node:child_process').execFile);
const {prepararAudio,analisar}=require('./audio-seguro.cjs');
async function caso(t,lavfi,ext='webm'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wolf-audio-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const input=path.join(dir,'entrada.'+ext),out=path.join(dir,'voz.ogg');
 await run('ffmpeg',['-nostdin','-y','-v','error','-f','lavfi','-i',lavfi,'-t','3','-c:a',ext==='m4a'?'aac':ext==='wav'?'pcm_s16le':'libopus',input]);return {input,out};
}
for(const ext of ['webm','ogg','wav','m4a'])test('voz '+ext+' preserva som e duração em OGG/Opus',async t=>{const c=await caso(t,'sine=frequency=440:sample_rate=48000',ext),r=await prepararAudio(c.input,c.out);a.equal(r.codec,'opus');a.equal(r.channels,1);a.ok(r.duracao>2.9&&r.duracao<3.2);a.ok(r.melhor.rms>-35);});
test('silêncio não pode ser enviado',async t=>{const c=await caso(t,'anullsrc=r=48000:cl=mono');await a.rejects(prepararAudio(c.input,c.out),{code:'AUDIO_SEM_SOM'});a.equal(fs.existsSync(c.out),false);});
test('clique inicial não disfarça gravação muda',async t=>{const c=await caso(t,'aevalsrc=if(lt(t\\,0.04)\\,0.6*sin(440*2*PI*t)\\,0):s=48000');await a.rejects(prepararAudio(c.input,c.out),{code:'AUDIO_SEM_SOM'});});
test('estéreo em oposição de fase não cancela voz',async t=>{const c=await caso(t,'aevalsrc=0.2*sin(440*2*PI*t)|-0.2*sin(440*2*PI*t):s=48000'),r=await prepararAudio(c.input,c.out);a.ok(r.melhor.rms>-30);});
test('microfone apenas no segundo canal preserva voz',async t=>{const c=await caso(t,'aevalsrc=0|0.2*sin(440*2*PI*t):s=48000'),r=await prepararAudio(c.input,c.out);a.ok(r.melhor.rms>-30);});
test('arquivo corrompido falha antes do envio',async t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wolf-audio-invalid-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const f=path.join(dir,'in.webm');fs.writeFileSync(f,'invalid');await a.rejects(prepararAudio(f,path.join(dir,'out.ogg')));});
