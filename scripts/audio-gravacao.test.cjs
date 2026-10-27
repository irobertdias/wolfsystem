const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function carregar(window={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/audio-gravacao.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,window,Blob});return exports;}
const {verificarSinalAudio}=carregar();
const sinal=(seg=3)=>Float32Array.from({length:48000*seg},(_,i)=>Math.sin(i*0.1)*0.08);
test('não envia gravação silenciosa',()=>a.throws(()=>verificarSinalAudio([new Float32Array(144000)],48000),/sem som/));
test('clique inicial e silêncio posterior não passam por voz',()=>{const c=new Float32Array(144000);c.set(sinal(0.04));a.throws(()=>verificarSinalAudio([c],48000),/sem som/);});
test('voz baixa válida é preservada',()=>verificarSinalAudio([sinal().map(v=>v*0.1)],48000));
test('voz no segundo canal não é rejeitada',()=>verificarSinalAudio([new Float32Array(144000),sinal()],48000));
test('canais opostos não são confundidos com silêncio',()=>verificarSinalAudio([sinal(),sinal().map(v=>-v)],48000));
test('fala curta não precisa ser longa',()=>verificarSinalAudio([sinal(0.3)],48000));
test('validação fecha AudioContext mesmo quando codec não é suportado',async()=>{let closed=false;const {validarGravacaoAudio}=carregar({AudioContext:class{async decodeAudioData(){throw Error('unsupported')}async close(){closed=true;}}});await validarGravacaoAudio(new Blob(['bytes']));a.equal(closed,true);});
test('validação fecha AudioContext e bloqueia silêncio decodificado',async()=>{let closed=false;const {validarGravacaoAudio}=carregar({AudioContext:class{async decodeAudioData(){return {numberOfChannels:1,sampleRate:48000,getChannelData:()=>new Float32Array(144000)}}async close(){closed=true;}}});await a.rejects(validarGravacaoAudio(new Blob(['bytes'])),/sem som/);a.equal(closed,true);});
