# -*- coding: utf-8 -*-
"""Regenera dashboard/dados.js a partir de resultados.json.
Fluxo completo de atualização:
    python3 analise.py                 # lê Lotofácil.xlsx -> resultados.json
    python3 gera_dados_dashboard.py    # resultados.json -> dashboard/dados.js
"""
import json, os

if not os.path.exists("resultados.json"):
    raise SystemExit("resultados.json não encontrado. Rode antes: python3 analise.py")

o = json.load(open("resultados.json"))
# séries auxiliares para gráficos de tendência (ordem antiga -> recente)
o["somas_serie"] = [sum(row[2:]) for row in o["base"]]
o["concursos_serie"] = [row[0] for row in o["base"]]

os.makedirs("dashboard", exist_ok=True)
with open("dashboard/dados.js", "w") as f:
    f.write("// Dados gerados a partir de Lotofácil.xlsx via analise.py — NÃO editar manualmente.\n")
    f.write("window.DADOS = ")
    json.dump(o, f, ensure_ascii=False)
    f.write(";\n")

print("dashboard/dados.js atualizado (%d bytes)." % os.path.getsize("dashboard/dados.js"))
