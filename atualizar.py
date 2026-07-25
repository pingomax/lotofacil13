# -*- coding: utf-8 -*-
"""Atualiza Lotofácil.xlsx buscando concursos novos na API oficial da Caixa.

Uso:
    python3 atualizar.py            # baixa os concursos que faltam e anexa ao Excel
    python3 atualizar.py --tudo     # baixa toda a análise em seguida (analise + dados)

Fonte: https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil
Endpoint sem número = concurso mais recente. Com número = concurso específico.
"""
import sys, json, time, urllib.request, urllib.error
import pandas as pd

SRC = "Lotofácil.xlsx"
ABA = "LOTOFÁCIL"
BOLAS = [f"Bola{i}" for i in range(1, 16)]
API = "https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil"
HEAD = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

# Mapa faixa de acertos -> (coluna ganhadores, coluna rateio) no Excel
FAIXA_COLS = {
    15: ("Ganhadores 15 acertos", "Rateio 15 acertos"),
    14: ("Ganhadores 14 acertos", "Rateio 14 acertos"),
    13: ("Ganhadores 13 acertos", "Rateio 13 acertos"),
    12: ("Ganhadores 12 acertos", "Rateio 12 acertos"),
    11: ("Ganhadores 11 acertos", "Rateio 11 acertos"),
}


def fetch(numero=None):
    """Busca um concurso da API. numero=None -> concurso mais recente."""
    url = API if numero is None else f"{API}/{numero}"
    req = urllib.request.Request(url, headers=HEAD)
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError) as e:
            if tentativa == 2:
                raise
            time.sleep(2)


def linha_do_concurso(d, colunas):
    """Converte a resposta da API numa linha (dict) compatível com o Excel."""
    dez = sorted(int(x) for x in d["listaDezenas"])
    if len(dez) != 15:
        raise ValueError(f"Concurso {d['numero']} veio com {len(dez)} dezenas")
    linha = {c: None for c in colunas}
    if "Concurso" in linha:
        linha["Concurso"] = int(d["numero"])
    if "Data Sorteio" in linha:
        linha["Data Sorteio"] = d["dataApuracao"]
    for i, b in enumerate(BOLAS):
        if b in linha:
            linha[b] = dez[i]
    # premiação (quando as colunas existem no Excel)
    rateio = {int(r["descricaoFaixa"].split()[0]): r for r in d.get("listaRateioPremio", [])}
    for acertos, (cg, cr) in FAIXA_COLS.items():
        if acertos in rateio:
            if cg in linha:
                linha[cg] = rateio[acertos].get("numeroDeGanhadores")
            if cr in linha:
                linha[cr] = rateio[acertos].get("valorPremio")
    # cidade/uf dos ganhadores da faixa principal
    if "Cidade / UF" in linha:
        muni = d.get("listaMunicipioUFGanhadores") or []
        linha["Cidade / UF"] = "; ".join(f"{m['municipio']}/{m['uf']}" for m in muni if m.get("municipio"))
    if "Arrecadacao Total" in linha:
        linha["Arrecadacao Total"] = d.get("valorArrecadado")
    if "Estimativa Prêmio" in linha:
        linha["Estimativa Prêmio"] = d.get("valorEstimadoProximoConcurso")
    if "Acumulado 15 acertos" in linha:
        linha["Acumulado 15 acertos"] = d.get("valorAcumuladoConcurso_0_5")
    return linha


def main():
    df = pd.read_excel(SRC, sheet_name=ABA)
    colunas = list(df.columns)
    ultimo_local = int(df["Concurso"].max())
    print(f"Último concurso no arquivo: {ultimo_local}")

    print("Consultando a Caixa…")
    recente = fetch()
    ultimo_online = int(recente["numero"])
    print(f"Último concurso publicado:  {ultimo_online} ({recente['dataApuracao']})")

    if ultimo_online <= ultimo_local:
        print("Nada a atualizar — seu arquivo já está em dia.")
        return

    faltantes = list(range(ultimo_local + 1, ultimo_online + 1))
    print(f"Baixando {len(faltantes)} concurso(s): {faltantes[0]}…{faltantes[-1]}")
    novas = []
    for n in faltantes:
        d = recente if n == ultimo_online else fetch(n)
        novas.append(linha_do_concurso(d, colunas))
        print(f"  + concurso {n} ({d['dataApuracao']}): {sorted(int(x) for x in d['listaDezenas'])}")
        time.sleep(0.4)  # gentileza com o servidor

    df_novo = pd.concat([df, pd.DataFrame(novas, columns=colunas)], ignore_index=True)
    df_novo = df_novo.drop_duplicates(subset="Concurso").sort_values("Concurso").reset_index(drop=True)

    # backup antes de sobrescrever
    import shutil, datetime
    bkp = f"Lotofácil_backup_{datetime.datetime.now():%Y%m%d_%H%M%S}.xlsx"
    shutil.copy(SRC, bkp)
    with pd.ExcelWriter(SRC, engine="openpyxl") as w:
        df_novo.to_excel(w, sheet_name=ABA, index=False)
    print(f"Excel atualizado: {len(df_novo)} concursos no total. Backup salvo em {bkp}.")

    if "--tudo" in sys.argv:
        import subprocess
        print("\nRegerando análise…")
        subprocess.run([sys.executable, "analise.py"], check=True)
        subprocess.run([sys.executable, "gera_dados_dashboard.py"], check=True)
        print("Dashboard atualizado. Recarregue a página no navegador.")


if __name__ == "__main__":
    main()
