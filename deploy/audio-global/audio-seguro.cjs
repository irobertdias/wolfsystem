'use strict';
const {execFile}=require('node:child_process');
const run=require('node:util').promisify(execFile);
const fs=require('node:fs');
const opts={timeout:60000,killSignal:'SIGKILL',maxBuffer:2*1024*1024};
function erroAudio(message,code='AUDIO_INVALIDO'){const e=new Error(message);e.code=code;return e;}
async function analisar(arquivo){
 const {stdout}=await run('ffprobe',['-v','error','-select_streams','a:0','-show_entries','stream=codec_name,channels,sample_rate:format=format_name,duration','-of','json',arquivo],opts);
 const p=JSON.parse(stdout);if(!p.streams?.length)throw erroAudio('O arquivo não contém uma faixa de áudio. Grave novamente.');
 const {stderr}=await run('ffmpeg',['-nostdin','-hide_banner','-i',arquivo,'-map','0:a:0','-af','astats=metadata=0:reset=0,silencedetect=noise=-55dB:d=0.1','-f','null','-'],opts);
 const canais=[];let canal=null;for(const line of stderr.split('\n')){
  const n=line.match(/Channel:\s*(\d+)/);if(n){canal={indice:Number(n[1])-1,rms:-Infinity,pico:-Infinity};canais.push(canal);}
  if(/\bOverall\b/.test(line))canal=null;
  const rms=line.match(/RMS level dB:\s*(-?inf|[-\d.]+)/),peak=line.match(/Peak level dB:\s*(-?inf|[-\d.]+)/);
  if(canal&&rms)canal.rms=Number(rms[1]);if(canal&&peak)canal.pico=Number(peak[1]);
 }
 const duracao=Number(p.format?.duration)||0;
 let silencio=0;for(const m of stderr.matchAll(/silence_duration:\s*([\d.]+)/g))silencio+=Number(m[1]);
 const melhor=canais.reduce((a,b)=>b.rms>a.rms?b:a,canais[0]||{indice:0,rms:-Infinity,pico:-Infinity});
 return {duracao,codec:p.streams[0].codec_name,formato:p.format?.format_name,channels:Number(p.streams[0].channels),sampleRate:Number(p.streams[0].sample_rate),melhor,silencio};
}
function validarSinal(a){
 if(a.melhor.pico < -60 || !Number.isFinite(a.melhor.rms) || (a.duracao>2 && a.duracao-a.silencio<0.25))throw erroAudio('Não foi detectado som suficiente na gravação. Confira o microfone e grave novamente. O áudio não foi enviado.','AUDIO_SEM_SOM');
}
async function prepararAudio(origem,destino){
 const antes=await analisar(origem);validarSinal(antes);
 // Escolhe o canal com sinal: a soma mono de canais em oposição de fase apaga a voz.
 const filtros=[`pan=mono|c0=c${antes.melhor.indice}`];
 // Ganho limitado: melhora voz baixa sem amplificar silêncio ou cortar o sinal.
 const ganho=Math.min(12,Math.max(0,-22-antes.melhor.rms),Math.max(0,-1-antes.melhor.pico));
 if(ganho>0.5)filtros.push(`volume=${ganho.toFixed(2)}dB`);
 try{
  await run('ffmpeg',['-nostdin','-y','-fflags','+genpts','-analyzeduration','100M','-probesize','100M','-i',origem,'-map','0:a:0','-vn','-map_metadata','-1','-af',filtros.join(','),'-ar','48000','-c:a','libopus','-b:a','32k','-application','voip','-vbr','on','-avoid_negative_ts','make_zero','-f','ogg',destino],opts);
  const depois=await analisar(destino);validarSinal(depois);
  if(depois.codec!=='opus'||!String(depois.formato).includes('ogg')||depois.duracao<=0||!fs.statSync(destino).size)throw erroAudio('Falha ao preparar áudio compatível com o WhatsApp.');
  if(antes.duracao>0&&Math.abs(depois.duracao-antes.duracao)>Math.max(0.2,antes.duracao*0.02))throw erroAudio('A conversão alterou a duração da gravação. O áudio não foi enviado.');
  return depois;
 }catch(e){try{fs.unlinkSync(destino);}catch{}throw e;}
}
module.exports={analisar,prepararAudio,validarSinal};
