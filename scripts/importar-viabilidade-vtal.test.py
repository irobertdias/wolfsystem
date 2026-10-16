import importlib.util
import json
import tempfile
import sys
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('importador', Path(__file__).with_name('importar-viabilidade-vtal.py'))
sys.dont_write_bytecode = True
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class ImportacaoTest(unittest.TestCase):
    def test_formatos_e_disponibilidade(self):
        raiz = Path(__file__).resolve().parent
        with tempfile.TemporaryDirectory(dir=raiz) as temp:
            pasta = Path(temp)
            pasta.resolve().relative_to(raiz)  # Garante que a limpeza recursiva permanece no workspace.
            # Marabá: CSV cujos registros inteiros foram encapsulados entre aspas.
            (pasta / 'PA_MARABA_20240603_VTAL.csv').write_text('CELULA,UF,MUNICIPIO,CEP,TIPO_VIABILIDADE,DISP_COMERCIAL\n"cel,PA,MARABA,68501150,Viável,Sim"\n', encoding='latin1')
            (pasta / 'RJ_RIO DE JANEIRO_20250207_VTAL.csv').write_text('ds_uf;ds_municipio;ds_cep;cd_tipo_viabilidade;cd_disp_comercial\nRJ;RIO DE JANEIRO;01239020;Viável;Sim\n', encoding='mac_roman')
            (pasta / 'GO_PLANALTINA_16022024_VTAL.csv').write_text('\ufeffUF;MUNICIPIO;CEP;TIPO_VIABILIDADE\nGO;PLANALTINA;73751173;Viável\n;;;\n', encoding='utf-8')
            (pasta / 'GO_EXEMPLO_VTAL.csv').write_text('UF;MUNICIPIO;CEP;TIPO_VIABILIDADE;DISP_COMERCIAL\nGO;EXEMPLO;1239020;Viável;Sim\nGO;EXEMPLO;1239020;Inviável;Sim\nGO;EXEMPLO;12345678;indefinido;Sim\nGO;EXEMPLO;invalido;Viável;Sim\n', encoding='utf-8')
            with zipfile.ZipFile(pasta / 'CEPs_Unicos.xlsx', 'w') as z:
                z.writestr('xl/worksheets/sheet1.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c t="inlineStr"><is><t>CEP</t></is></c></row><row><c><v>01239020</v></c></row></sheetData></worksheet>')
            destino = pasta / 'base.json'
            mod.importar(pasta, destino)
            base = json.loads(destino.read_text(encoding='utf-8'))
            cidades = {c['cidade']: c for c in base['cidades']}
            self.assertEqual(cidades['MARABA']['ceps'], '68501150,1,1,0')
            self.assertEqual(cidades['RIO DE JANEIRO']['ceps'], '01239020,1,1,0')
            self.assertEqual(cidades['PLANALTINA']['ceps'], '73751173,1,0,1')
            self.assertIn('01239020,2,1,0', cidades['EXEMPLO']['ceps'])
            self.assertIn('12345678,1,0,1', cidades['EXEMPLO']['ceps'])
            self.assertEqual(base['ceps_planilha'], '01239020')
            self.assertEqual(sum(f['linhas_descartadas'] for f in base['fontes']), 1)
            self.assertEqual(sum(f['linhas_vazias'] for f in base['fontes']), 1)
            self.assertTrue(all(len(f['sha256']) == 64 for f in base['fontes']))

if __name__ == '__main__':
    unittest.main()
