'use strict';
// Some WebJS messages carry the original bytes in body with hasMedia=false.
// Decode only bounded, fully valid base64 with a recognized file signature.
function recuperarCorpo(valor){
 const t=String(valor||'').trim();if(t.length>36*1024*1024)return null;
 const m=/^data:([\w.+-]+\/[\w.+-]+);base64,([\s\S]+)$/i.exec(t),raw=(m?m[2]:t).replace(/\s/g,'');
 if(raw.length<512||raw.length%4===1||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))return null;
 const buffer=Buffer.from(raw,'base64');if(!buffer.length||buffer.length>25*1024*1024||buffer.toString('base64').replace(/=+$/,'')!==raw.replace(/=+$/,''))return null;
 let ext,tipo;
 if(buffer.subarray(0,3).equals(Buffer.from([255,216,255]))){ext='jpg';tipo='image/jpeg';}
 else if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){ext='png';tipo='image/png';}
 else if(/^GIF8[79]a/.test(buffer.subarray(0,6).toString())){ext='gif';tipo='image/gif';}
 else if(buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP'){ext='webp';tipo='image/webp';}
 else if(buffer.subarray(0,5).toString()==='%PDF-'){ext='pdf';tipo='application/pdf';}
 else return null;
 return {buffer,ext,tipo,prefixo:ext==='pdf'?'file':'img'};
}
function textoLocalizacao(msg){
 const l=msg.location||{},lat=Number(l.latitude??msg._data?.lat),lng=Number(l.longitude??msg._data?.lng);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return '[Localização recebida sem coordenadas legíveis]';
 const descricao=String(l.description||msg._data?.loc||'').slice(0,1000).replace(/[\u0000-\u001f]/g,' ').trim();
 return `[Localização enviada: latitude ${lat}, longitude ${lng}]${descricao?'\nEndereço informado no ponto: '+descricao:''}`;
}
module.exports={recuperarCorpo,textoLocalizacao};
