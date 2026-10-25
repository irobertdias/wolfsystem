'use strict';
// Mensagens distintas, não combinações de configuração. Tudo sintético.
function casos(){
 const out=[],add=c=>out.push({id:String(out.length+1).padStart(4,'0'),...c});
 const separadores=['','-','_',' ','  ','.','/','–','—','\n',' - ',' _ ',' . ','\t',' '];
 const prefixos=['','cep ','meu cep eh ','o CEP: '];
 for(const cep of ['81935476','74480150','23087300','56321470','60850725'])for(const sep of separadores)for(const p of prefixos)add({tipo:'texto',grupo:'cep',texto:p+cep.slice(0,5)+sep+cep.slice(5),campo:'cep',esperado:cep});
 const grupos=[
 ['cpf','cpf','52998224725',['meu cpf é 529.982.247-25','cpf52998224725','cp f 529 982 247 25','cpff: 52998224725','meu documento 52998224725','cpf: 529_982_247_25','CPF 529-982-247-25','52998224725','meu cpfi eh 52998224725','cp.f 52998224725']],
 ['telefone','telefone1','5511999998888',['meu tel 11 99999-8888','contato (11)99999-8888','telefone 5511999998888','meu telefone eh 11 99999 8888','11999998888','tel: 11_99999_8888','cel 11.99999.8888','meu celular 11999998888','contato +55 (11) 99999-8888','telefone pra contato 11999998888']],
 ['whatsapp','usar_whatsapp',true,['é esse mesmo','esse aki','pode usar esse','o msm q to falando','este whatsapp','é esse numero daqui','esse mesmo aki','esse que eu tô conversando','usa o mesmo zap','o contato eh esse']],
 ['confirmacao','confirmacao',true,['simm','ta certinho','tudo ok','tdu certo','pode prosseguir','isso msm','confirmadu','beleza','blz pode seguir','correto pode continuar']],
 ['modalidade','tipo_pessoa','PF',['cpf','pessoa fisica','física','pf','pesssoa fisica','no cpf','meu cpf','pessoa fizica','pra mim cpf','fisica mesmo']],
 ['quadra','quadra','2',['q2 lt01','qd 2 lote 01','QU 02 LT 1','qa2 l01','quadra 2 lote 1','q 2 lt 01','QD.2 LT.01','qd: 02 lt: 01','qudra 2 lote 1','q02 l1']],
 ['fachada','numero','36',['numero 36','número:36','n 36','nº 36','n.36','casa número 36','numero trinta e seis','numro 36','36','fachada 36']],
 ['nascimento','data_nascimento','03/01/1990',['03/01/1990','3/1/1990','03.01.1990','03-01-1990','03 01 1990','1990-01-03','03011990','3 de janeiro de 1990','nasci 03/01/90','três de janeiro de mil novecentos e noventa']],
 ['email','email','cliente.exemplo@example.com',['cliente.exemplo@example.com','meu email cliente.exemplo@example.com','email:cliente.exemplo@example.com','meu e-mail eh cliente.exemplo@example.com','e mail cliente.exemplo@example.com','emal cliente.exemplo@example.com','cliente.exemplo arroba example ponto com','cliente ponto exemplo arroba example ponto com','meu correio cliente.exemplo@example.com','é cliente.exemplo@example.com']],
 ['vencimento','vencimento','20',['dia 20','vinte','vencimento vinte','pra dia 20','fatura dia vinte','20','pode colocar dia 20','dia_20','vencimeto 20','prefiro o dia vinte']],
 ['pagamento','forma_pagamento','Boleto',['boleto','bolleto','boletu','no boleto','quero boleto','pagar no boleto','por boletto','buleto','bo leto','pagameto no boleto']],
 ['plano','plano_id','basico',['quero o básico','o mais barato','pode ser o de 50','quero a primeira opção','o primeiro','quero o de cinquenta reais','o basico mesmo','opcao 1','o de R$50,00','pode fechar o basico']],
 ['precos','plano_id','',['quais os preços?','qual valor','qnt custa','qto fica','passa os valores','pasa o valo','quero saber preços','quanto tá','me fala as ofertas','manda os preço']],
 ['recusa_documentos','recusa_documentos',true,['não envio meus documentos','nao vou mandar','prefiro nao enviar','nao mando doc pra ninguem','não enviar','naum envio','nao mandu documento','me recuso a enviar','nao quero passar meus documentos','nao aceito enviar documentos']],
 ['parar','encerrar',true,['pare de mandar mensagens','não me envie mais mensagens','não quero receber mensagens','remova meu contato','encerre o atendimento','para de me mandar msg','nao quero mais msg','não me chama mais','chega de mensagem','pode parar de falar comigo']]
 ];
 for(const [grupo,campo,esperado,textos]of grupos)for(const t of textos)for(const formato of [t,'OLÁ, '+t.toUpperCase(),t+'!', '  '+t+'  '])add({tipo:'texto',grupo,texto:formato,campo,esperado});
 for(let i=0;i<40;i++)add({tipo:'imagem',grupo:'endereco_imagem',texto:`Unidade consumidora\nRUA EXEMPLO, ${i+10}\nCENTRO - CURITIBA/PR\nCEP 81935-476`,campo:'cep',esperado:'81935476',numero:String(i+10),variante:i});
 for(let i=0;i<30;i++)add({tipo:'pdf',grupo:'endereco_pdf',texto:`ENDERECO DO CLIENTE\nRUA EXEMPLO, ${i+50}\nCENTRO - CURITIBA/PR\nCEP 81935-476`,campo:'cep',esperado:'81935476',numero:String(i+50),variante:i});
 const falas=[['Meu CEP é oito um nove três cinco quatro sete seis','cep','81935476'],['O número da minha casa é trinta e seis','numero','36'],['Eu prefiro boleto','forma_pagamento','Boleto'],['Pode colocar o vencimento no dia vinte','vencimento','20'],['Quero a primeira opção, o plano básico','plano_id','basico'],['Sim, está tudo correto, pode seguir','confirmacao',true],['O telefone é este mesmo WhatsApp','usar_whatsapp',true],['A contratação vai ser no meu CPF','tipo_pessoa','PF'],['Minha quadra é dois e o lote é um','quadra','2'],['Não quero receber mais mensagens','encerrar',true]];
 for(let i=0;i<30;i++){const [texto,campo,esperado]=falas[i%10];add({tipo:'audio',grupo:'audio_real',texto,campo,esperado,velocidade:[0.85,1,1.2][Math.floor(i/10)]});}
 if(out.length!==1000||new Set(out.map(c=>[c.tipo,c.texto,c.velocidade,c.variante].join('|'))).size!==1000)throw Error('A matriz precisa de 1000 entradas distintas');
 return out;
}
module.exports={casos};
