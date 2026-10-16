"""Importação local, em streaming. CSVs são dados, nunca instruções executáveis."""
import csv
import hashlib
import json
import re
import sys
import unicodedata
import zipfile
from collections import defaultdict
from pathlib import Path
import xml.etree.ElementTree as ET

def normalizar(value):
    try:
        value = value.encode('latin1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        pass
    return ''.join(c for c in unicodedata.normalize('NFD', value.strip().upper()) if unicodedata.category(c) != 'Mn')

def importar(origem, destino):
    cidades = defaultdict(lambda: defaultdict(lambda: [0, 0, 0]))
    fontes = []
    for arquivo in sorted(origem.glob('*_VTAL.csv')):
        digest = hashlib.sha256()
        with arquivo.open('rb') as bruto:
            for bloco in iter(lambda: bruto.read(1024 * 1024), b''):
                digest.update(bloco)
        validos = invalidos = vazios = 0
        # Rio foi exportado em MacRoman; demais arquivos misturam Latin1 e UTF-8 por campo.
        encoding = 'mac_roman' if arquivo.name == 'RJ_RIO DE JANEIRO_20250207_VTAL.csv' else 'latin1'
        with arquivo.open(encoding=encoding, newline='') as stream:
            primeira = stream.readline()
            stream.seek(0)
            reader = csv.DictReader(stream, delimiter=';' if primeira.count(';') > primeira.count(',') else ',')
            reader.fieldnames = [re.sub(r'^(DS|CD|NU)_', '', normalizar(c).lstrip('\ufeff').replace('Ï»¿', '')) for c in reader.fieldnames]
            obrigatorias = {'CEP', 'UF', 'MUNICIPIO', 'TIPO_VIABILIDADE'}
            if not obrigatorias.issubset(reader.fieldnames or []):
                raise ValueError(f'Colunas ausentes: {arquivo.name}')
            for row in reader:
                # Marabá contém cada registro inteiro entre aspas (CSV encapsulado).
                if row.get('UF') is None and row.get('CELULA') and ',' in row['CELULA']:
                    row = dict(zip(reader.fieldnames, next(csv.reader([row['CELULA']]))))
                if not any((v or '').strip() for k, v in row.items() if k is not None):
                    vazios += 1
                    continue
                cep = (row.get('CEP') or '').strip()
                if re.fullmatch(r'\d{7}', cep):
                    cep = cep.zfill(8)
                uf, cidade = normalizar(row.get('UF') or ''), normalizar(row.get('MUNICIPIO') or '')
                if not re.fullmatch(r'\d{8}', cep) or not re.fullmatch(r'[A-Z]{2}', uf) or not cidade:
                    invalidos += 1
                    continue
                contagem = cidades[(uf, cidade)][cep]
                contagem[0] += 1
                tipo = normalizar(row.get('TIPO_VIABILIDADE') or '')
                comercial = normalizar(row.get('DISP_COMERCIAL') or '')
                if comercial not in ('SIM', 'NAO') or tipo not in ('VIAVEL', 'INVIAVEL'):
                    contagem[2] += 1
                # COD_VIABILIDADE isolado não determina oferta comercial.
                if tipo == 'VIAVEL' and comercial == 'SIM':
                    contagem[1] += 1
                validos += 1
        fontes.append({'arquivo': arquivo.name, 'sha256': digest.hexdigest(), 'linhas_validas': validos, 'linhas_descartadas': invalidos, 'linhas_vazias': vazios, 'encoding': encoding})
        print(f'{arquivo.name}: {validos}', flush=True)
    planilha = origem / 'CEPs_Unicos.xlsx'
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(planilha) as z:
        strings = [''.join(t.itertext()) for t in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', ns)] if 'xl/sharedStrings.xml' in z.namelist() else []
        ceps = set()
        with z.open('xl/worksheets/sheet1.xml') as sheet:
            for _, cell in ET.iterparse(sheet, events=('end',)):
                if cell.tag != '{' + ns['m'] + '}c':
                    continue
                value = cell.find('m:v', ns)
                texto = strings[int(value.text)] if value is not None and cell.get('t') == 's' else value.text if value is not None else ''.join(cell.itertext())
                if re.fullmatch(r'\d{7,8}', texto or ''):
                    ceps.add(texto.zfill(8))
                cell.clear()
    payload = {'versao': 1, 'fonte': 'Arquivos VTAL fornecidos pelo cliente; snapshots históricos de 2024/2025', 'ceps_planilha': '\n'.join(sorted(ceps)), 'cidades': [{'uf': uf, 'cidade': cidade, 'ceps': '\n'.join(f'{cep},{n[0]},{n[1]},{n[2]}' for cep, n in sorted(itens.items()))} for (uf, cidade), itens in sorted(cidades.items())], 'fontes': fontes}
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'arquivos': len(fontes), 'cidades': len(cidades), 'ceps_planilha': len(ceps), 'linhas': sum(f['linhas_validas'] for f in fontes), 'bytes': destino.stat().st_size}))

if __name__ == '__main__':
    importar(Path(sys.argv[1]), Path(sys.argv[2]))
