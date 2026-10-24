"""Índice de descoberta por cidade/UF. A disponibilidade vem da linha completa VTAL."""
import csv, gzip, json, re, sys, unicodedata
from pathlib import Path

def normalizar(v):
    try: v = v.encode('latin1').decode('utf-8')
    except (UnicodeError, AttributeError): pass
    return ''.join(c for c in unicodedata.normalize('NFD', v.strip().upper()) if unicodedata.category(c) != 'Mn').replace('_', ' ')

origem, destino = map(Path, sys.argv[1:3])
destino.mkdir(parents=True, exist_ok=True)
for arquivo in sorted(origem.glob('*_VTAL.csv')):
    cidades = {}
    with arquivo.open(encoding='mac_roman' if 'RJ_RIO DE JANEIRO_20250207' in arquivo.name else 'latin1', newline='') as f:
        primeira = f.readline(); f.seek(0)
        reader = csv.DictReader(f, delimiter=';' if primeira.count(';') > primeira.count(',') else ',')
        reader.fieldnames = [re.sub(r'^(DS|CD|NU)_', '', normalizar(c).lstrip('\ufeff').replace('Ï»¿', '')) for c in reader.fieldnames]
        for row in reader:
            if row.get('UF') is None and row.get('CELULA') and ',' in row['CELULA']:
                row = dict(zip(reader.fieldnames, next(csv.reader([row['CELULA']]))))
            uf, cidade, rua = [normalizar(row.get(k) or '') for k in ['UF', 'MUNICIPIO', 'LOGRADOURO']]
            cep = (row.get('CEP') or '').strip().zfill(8)
            if not re.fullmatch('[A-Z]{2}', uf) or not cidade or not rua or not re.fullmatch(r'\d{8}', cep): continue
            cidades.setdefault((uf, cidade), set()).add((rua, cep))
    for (uf, cidade), linhas in cidades.items():
        nome = re.sub('[^A-Z0-9]+', '_', cidade).strip('_')
        alvo = destino / f'{uf}-{nome}.json.gz'
        if alvo.exists():
            with gzip.open(alvo, 'rt', encoding='utf-8') as f: linhas.update(map(tuple, json.load(f)))
        with gzip.open(alvo, 'wt', encoding='utf-8') as f: json.dump(sorted(linhas), f, ensure_ascii=False, separators=(',', ':'))
    print(arquivo.name, sum(map(len, cidades.values())), flush=True)
