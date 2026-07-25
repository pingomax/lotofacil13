# -*- coding: utf-8 -*-
"""Análise estatística Lotofácil - 300 concursos + geração de 9 jogos."""
import pandas as pd, numpy as np, json, random
from collections import Counter, defaultdict
from itertools import combinations

SRC = "Lotofácil.xlsx"
BOLAS = [f"Bola{i}" for i in range(1, 16)]

# ---------- 1. LEITURA E VALIDAÇÃO ----------
df = pd.read_excel(SRC, sheet_name="LOTOFÁCIL")
val = {}
val['abas'] = ["LOTOFÁCIL"]
val['colunas'] = list(df.columns)
val['total'] = len(df)

# dezenas como matriz int
D = df[BOLAS].astype(int)
problemas = []
# duplicatas de concurso
dup = df['Concurso'].duplicated().sum()
# fora do intervalo
fora = ((D < 1) | (D > 25)).sum().sum()
# repetidas dentro do concurso
rep_intra = sum(1 for _, r in D.iterrows() if len(set(r)) != 15)
# contagem != 15 (colunas nulas)
nulos = df[BOLAS].isna().sum().sum()
val['dup_concurso'] = int(dup)
val['fora_intervalo'] = int(fora)
val['rep_intra'] = int(rep_intra)
val['celulas_vazias'] = int(nulos)

# ordenar por concurso
df = df.sort_values('Concurso').reset_index(drop=True)
val['concurso_antigo'] = int(df['Concurso'].iloc[0])
val['concurso_recente'] = int(df['Concurso'].iloc[-1])
val['data_recente'] = str(df['Data Sorteio'].iloc[-1])

# amostra 300 mais recentes
N = 300
usados = min(N, len(df))
amostra = df.tail(usados).reset_index(drop=True)
val['usados'] = usados
val['amostra_ini'] = int(amostra['Concurso'].iloc[0])
val['amostra_fim'] = int(amostra['Concurso'].iloc[-1])
val['data_ini'] = str(amostra['Data Sorteio'].iloc[0])
val['data_fim'] = str(amostra['Data Sorteio'].iloc[-1])

# matriz de sorteios (lista de sets e lista ordenada)
draws = [sorted(int(x) for x in amostra[BOLAS].iloc[i]) for i in range(usados)]
draw_sets = [set(d) for d in draws]
print("VALIDACAO_OK", json.dumps(val, ensure_ascii=False))

# probabilidade de um k-conjunto especifico de dezenas sair todo junto (sorteio de 15 em 25)
def prob_k(k):
    p = 1.0
    for i in range(k):
        p *= (15 - i) / (25 - i)
    return p
PROB2, PROB3, PROB4 = prob_k(2), prob_k(3), prob_k(4)
def lift(count, prob):
    esperado = prob * usados
    return round(count / esperado, 2) if esperado > 0 else 0.0

# ---------- 2. FREQUENCIA + CLASSIFICACAO ----------
NUMS = list(range(1, 26))
def freq_window(k):
    c = Counter()
    for s in draw_sets[-k:]:
        c.update(s)
    return c
f300 = freq_window(300); f100 = freq_window(100); f50 = freq_window(50)
f20 = freq_window(20); f10 = freq_window(10)
esperada = usados * 15 / 25  # media teorica por dezena

# atraso atual, maior atraso, maior sequencia consecutiva de aparicoes
atraso, maior_atraso, seq_max = {}, {}, {}
for n in NUMS:
    presence = [1 if n in s else 0 for s in draw_sets]  # antigo->recente
    # atraso atual = concursos desde ultima aparicao (0 = saiu no ultimo)
    a = 0
    for p in reversed(presence):
        if p: break
        a += 1
    atraso[n] = a
    # maior atraso: maior gap de zeros
    mg = 0; cur = 0
    for p in presence:
        if p == 0: cur += 1; mg = max(mg, cur)
        else: cur = 0
    maior_atraso[n] = mg
    # maior sequencia consecutiva de aparicoes
    ms = 0; cur = 0
    for p in presence:
        if p == 1: cur += 1; ms = max(ms, cur)
        else: cur = 0
    seq_max[n] = ms

# atraso medio: media dos gaps (concursos sem sair) entre aparicoes consecutivas
atraso_medio = {}
for n in NUMS:
    presence = [1 if n in s else 0 for s in draw_sets]
    gaps = []; cur = 0; started = False
    for p in presence:
        if p == 1:
            if started: gaps.append(cur)
            cur = 0; started = True
        else:
            cur += 1
    atraso_medio[n] = round(sum(gaps) / len(gaps), 2) if gaps else 0.0

# escore de calor combinando janelas + atraso + tendencia
def rate(cnt, k): return cnt / k
score = {}
for n in NUMS:
    r300, r100, r50, r20, r10 = rate(f300[n],300), rate(f100[n],100), rate(f50[n],50), rate(f20[n],20), rate(f10[n],10)
    base = 0.15*r300 + 0.20*r100 + 0.25*r50 + 0.25*r20 + 0.15*r10
    tend = (r10 - r100)  # tendencia recente vs base
    pen = min(atraso[n], 10) / 10 * 0.05  # atraso penaliza levemente
    score[n] = base + 0.3*tend - pen
ordenado = sorted(NUMS, key=lambda n: score[n], reverse=True)
classe = {}
for i, n in enumerate(ordenado):
    if i < 5: classe[n] = "Muito quente"
    elif i < 10: classe[n] = "Quente"
    elif i < 15: classe[n] = "Neutra"
    elif i < 20: classe[n] = "Fria"
    else: classe[n] = "Muito fria"

# tendencias
tend_alta = sorted(NUMS, key=lambda n: rate(f10[n],10)-rate(f100[n],100), reverse=True)[:6]
tend_queda = sorted(NUMS, key=lambda n: rate(f10[n],10)-rate(f100[n],100))[:6]
atrasadas = sorted(NUMS, key=lambda n: atraso[n], reverse=True)[:6]
voltaram = [n for n in NUMS if atraso[n] == 0 and maior_atraso[n] >= 3][:8]
rank_freq = sorted(NUMS, key=lambda n: f300[n], reverse=True)

# ---------- 3. PARES E IMPARES ----------
PARES = {n for n in NUMS if n % 2 == 0}
def n_pares(s): return len(s & PARES)
pi_counter = Counter()
for s in draw_sets:
    p = n_pares(s); pi_counter[(p, 15-p)] += 1
pi_10 = Counter((n_pares(s), 15-n_pares(s)) for s in draw_sets[-10:])
pi_20 = Counter((n_pares(s), 15-n_pares(s)) for s in draw_sets[-20:])

# ---------- 4. MOLDURA E CENTRO ----------
CENTRO = {7,8,9,12,13,14,17,18,19}
MOLDURA = set(NUMS) - CENTRO
def n_mold(s): return len(s & MOLDURA)
mc_counter = Counter()
for s in draw_sets:
    m = n_mold(s); mc_counter[(m, 15-m)] += 1
def mc_win(k): return Counter((n_mold(s), 15-n_mold(s)) for s in draw_sets[-k:])

# ---------- 5. LINHAS ----------
LINHAS = {1:{1,2,3,4,5},2:{6,7,8,9,10},3:{11,12,13,14,15},4:{16,17,18,19,20},5:{21,22,23,24,25}}
def linha_dist(s): return tuple(len(s & LINHAS[l]) for l in range(1,6))
linha_totais = {l: sum(len(s & LINHAS[l]) for s in draw_sets) for l in range(1,6)}
linha_dist_counter = Counter(linha_dist(s) for s in draw_sets)
# distribuicao 0..5 por linha
linha_ocup = {l: Counter(len(s & LINHAS[l]) for s in draw_sets) for l in range(1,6)}
def linha_media_win(l,k): return sum(len(s & LINHAS[l]) for s in draw_sets[-k:])/k

# ---------- 6. COLUNAS ----------
COLS = {c:{c, c+5, c+10, c+15, c+20} for c in range(1,6)}
def col_dist(s): return tuple(len(s & COLS[c]) for c in range(1,6))
col_totais = {c: sum(len(s & COLS[c]) for s in draw_sets) for c in range(1,6)}
col_dist_counter = Counter(col_dist(s) for s in draw_sets)
col_ocup = {c: Counter(len(s & COLS[c]) for s in draw_sets) for c in range(1,6)}
def col_media_win(c,k): return sum(len(s & COLS[c]) for s in draw_sets[-k:])/k

# ---------- 7. SEQUENCIAS CONSECUTIVAS ----------
def seq_blocks(d):
    blocks = []; cur = [d[0]]
    for x in d[1:]:
        if x == cur[-1]+1: cur.append(x)
        else:
            if len(cur) >= 2: blocks.append(len(cur))
            cur = [x]
    if len(cur) >= 2: blocks.append(len(cur))
    return blocks
seq_size_counter = Counter()   # tamanho de cada bloco
seq_por_concurso = []          # nº de blocos por concurso
seq_dezenas_em_seq = []
for d in draws:
    b = seq_blocks(d)
    seq_por_concurso.append(len(b))
    for sz in b: seq_size_counter[sz] += 1
    seq_dezenas_em_seq.append(sum(b))
maior_seq = max(seq_size_counter) if seq_size_counter else 0

# ---------- 8. REPETICAO ENTRE CONCURSOS ----------
# usa tail(301) para ter o anterior ao 1º da amostra
draws_ext = [set(int(x) for x in df[BOLAS].iloc[i]) for i in range(len(df)-usados-1, len(df))]
rep_counts = []
for i in range(1, len(draws_ext)):
    rep_counts.append(len(draws_ext[i] & draws_ext[i-1]))
rep_counter = Counter(rep_counts)
rep_arr = np.array(rep_counts)
# permanencia por dezena
perm = {n:{'apareceu':0,'repetiu':0} for n in NUMS}
for i in range(1, len(draws_ext)):
    for n in draws_ext[i-1]:
        perm[n]['apareceu'] += 1
        if n in draws_ext[i]: perm[n]['repetiu'] += 1

# ---------- 9. SOMA ----------
somas = np.array([sum(d) for d in draws])
faixas = [("Abaixo de 170", lambda x: x<170),("170-179",lambda x:170<=x<=179),
          ("180-189",lambda x:180<=x<=189),("190-199",lambda x:190<=x<=199),
          ("200-209",lambda x:200<=x<=209),("210-219",lambda x:210<=x<=219),
          ("220 ou mais",lambda x:x>=220)]
faixa_counter = {nome:int(sum(1 for x in somas if f(x))) for nome,f in faixas}

# ---------- 10. BAIXAS E ALTAS ----------
BAIXAS = set(range(1,14))
def n_baixas(s): return len(s & BAIXAS)
ba_counter = Counter()
for s in draw_sets:
    b = n_baixas(s); ba_counter[(b,15-b)] += 1

# ---------- 11. PRIMOS ----------
PRIMOS = {2,3,5,7,11,13,17,19,23}
primo_counter = Counter(len(s & PRIMOS) for s in draw_sets)
primo_arr = np.array([len(s & PRIMOS) for s in draw_sets])

# ---------- 12. MULTIPLOS ----------
M3 = {n for n in NUMS if n%3==0}; M4={n for n in NUMS if n%4==0}; M5={n for n in NUMS if n%5==0}
mult3 = np.array([len(s & M3) for s in draw_sets])
mult4 = np.array([len(s & M4) for s in draw_sets])
mult5 = np.array([len(s & M5) for s in draw_sets])

# ---------- 13. FINAIS ----------
finais_counter = Counter()
for s in draw_sets:
    for n in s: finais_counter[n%10] += 1

# ---------- 16. PARES DE DEZENAS ----------
par_counter = Counter()
for s in draw_sets:
    for a,b in combinations(sorted(s),2): par_counter[(a,b)] += 1
def par_win(k):
    c = Counter()
    for s in draw_sets[-k:]:
        for a,b in combinations(sorted(s),2): c[(a,b)] += 1
    return c
trinca_counter = Counter()
for s in draw_sets:
    for c3 in combinations(sorted(s),3): trinca_counter[c3] += 1
quarteto_counter = Counter()
for s in draw_sets:
    for c4 in combinations(sorted(s),4): quarteto_counter[c4] += 1

# afinidade media por dezena: media do Lift dos pares que contem a dezena (amostra minima)
afinidade_media = {}
for n in NUMS:
    lifts = [lift(v, PROB2) for k, v in par_counter.items() if n in k]
    afinidade_media[n] = round(sum(lifts) / len(lifts), 2) if lifts else 0.0

print("ANALISE_OK")

# ---------- ULTIMO CONCURSO ----------
ult = draws[-1]; ult_set = set(ult)
ult_info = {
    'concurso': int(amostra['Concurso'].iloc[-1]), 'data': str(amostra['Data Sorteio'].iloc[-1]),
    'dezenas': ult, 'pares': n_pares(ult_set), 'impares': 15-n_pares(ult_set),
    'moldura': n_mold(ult_set), 'centro': 15-n_mold(ult_set),
    'baixas': n_baixas(ult_set), 'altas': 15-n_baixas(ult_set),
    'soma': sum(ult), 'primos': len(ult_set & PRIMOS),
    'linhas': linha_dist(ult_set), 'colunas': col_dist(ult_set),
    'seqs': seq_blocks(ult), 'repetidas_anterior': len(ult_set & draw_sets[-2]),
}

# ---------- 18-21. GERACAO DOS 9 JOGOS ----------
random.seed(42)
soma_freq = sorted(faixa_counter.items(), key=lambda x:-x[1])[0][0]
alvo_soma = (185, 205)  # faixa central tipica
rep_moda = rep_counter.most_common(1)[0][0]

def calc_score(game):
    s = set(game)
    sc = 0
    # frequencia recente
    sc += sum(rate(f50[n],50) for n in s)/15 * 25
    sc += sum(rate(f10[n],10) for n in s)/15 * 15
    # equilibrio pares
    p = n_pares(s); sc += (1 - abs(p-7.5)/7.5) * 10
    # moldura/centro (alvo ~10/5)
    m = n_mold(s); sc += (1 - abs(m-10)/5) * 8
    # soma
    tot = sum(game); sc += (1 - min(abs(tot-195)/40,1)) * 12
    # baixas/altas alvo ~8/7 ou 7/8
    b = n_baixas(s); sc += (1 - abs(b-7.5)/7.5) * 6
    # primos alvo ~6
    sc += (1 - min(abs(len(s&PRIMOS)-6)/6,1)) * 6
    # linhas/colunas sem vazio
    ld = linha_dist(s); cd = col_dist(s)
    if 0 not in ld: sc += 5
    if 0 not in cd: sc += 5
    if all(1<=x<=4 for x in ld): sc += 4
    if all(1<=x<=4 for x in cd): sc += 4
    return sc

def gera_jogo(alvo_pares, quentes, neutras, frias, tentativas=4000):
    best = None; best_sc = -1
    for _ in range(tentativas):
        # amostra por temperatura para diversificar
        nq = random.randint(7,9); nn = random.randint(3,5)
        pool_q = random.sample(quentes, min(nq, len(quentes)))
        pool_n = random.sample(neutras, min(nn, len(neutras)))
        rest = [n for n in NUMS if n not in pool_q and n not in pool_n]
        g = set(pool_q + pool_n)
        random.shuffle(rest)
        for n in rest:
            if len(g) >= 15: break
            g.add(n)
        g = set(list(g)[:15])
        while len(g) < 15:
            g.add(random.choice([n for n in NUMS if n not in g]))
        if n_pares(g) != alvo_pares: continue
        if 0 in linha_dist(g) or 0 in col_dist(g): continue
        sc = calc_score(g)
        if sc > best_sc: best_sc, best = sc, sorted(g)
    return best, best_sc

quentes = [n for n in NUMS if classe[n] in ("Muito quente","Quente")]
neutras = [n for n in NUMS if classe[n]=="Neutra"]
frias = [n for n in NUMS if classe[n] in ("Fria","Muito fria")]

def ok_intersec(g, jogos):
    for j in jogos:
        inter = len(set(g) & set(j))
        if inter < 8 or inter > 11: return False
    return True

jogos = []; criterios = []
plano = [(8,"8P/7I - freq. recente 10/20/50")]*3 + [(7,"7P/8I - diversificado")]*3 + [(8,"8P/7I - 10 quentes/neutras + 5 frias")]*3
for idx,(ap,crit) in enumerate(plano):
    for attempt in range(6000):
        if idx < 6:
            g,_ = gera_jogo(ap, quentes, neutras, frias, 300)
        else:
            # grupo 7-9: ~10 quentes/neutras + 5 frias
            qn = quentes+neutras
            base = random.sample(qn, 10) + random.sample(frias, min(5,len(frias)))
            g = sorted(set(base))
            while len(g) < 15: g = sorted(set(g+[random.choice(NUMS)]))
            g = sorted(set(g))[:15]
            while len(g)<15: g=sorted(set(g+[random.choice([n for n in NUMS if n not in g])]))
            if n_pares(set(g)) != ap: continue
            if 0 in linha_dist(set(g)) or 0 in col_dist(set(g)): continue
        if g and g not in jogos and ok_intersec(g, jogos):
            jogos.append(g); criterios.append(crit); break
    else:
        # fallback: aceita sem restricao rigida de intersecao
        g,_ = gera_jogo(ap, quentes, neutras, frias, 2000)
        jogos.append(g); criterios.append(crit+" (relaxado)")

# garante cobertura das 25 dezenas
cobertas = set().union(*[set(j) for j in jogos])
faltantes = [n for n in NUMS if n not in cobertas]
for n in faltantes:
    # injeta em algum jogo trocando dezena redundante
    for ji,j in enumerate(jogos):
        js = set(j)
        cand = [x for x in j if sum(x in set(jj) for jj in jogos) > 3 and n_pares(js-{x}|{n})==n_pares(js)]
        if cand:
            js.discard(cand[0]); js.add(n); jogos[ji]=sorted(js); break
cobertas = set().union(*[set(j) for j in jogos])

# metricas por jogo
def game_metrics(g):
    s = set(g); p = n_pares(s)
    return {
        'pares':p,'impares':15-p,'moldura':n_mold(s),'centro':15-n_mold(s),
        'repetidas_ult':len(s & ult_set),'soma':sum(g),'baixas':n_baixas(s),'altas':15-n_baixas(s),
        'primos':len(s & PRIMOS),'seqs':len(seq_blocks(sorted(g))),
        'linhas':linha_dist(s),'colunas':col_dist(s),
        'quentes':sum(1 for n in s if classe[n] in ("Muito quente","Quente")),
        'neutras':sum(1 for n in s if classe[n]=="Neutra"),
        'frias':sum(1 for n in s if classe[n] in ("Fria","Muito fria")),
    }
raw_scores = [calc_score(g) for g in jogos]
mn, mx = min(raw_scores), max(raw_scores)
# diversidade
def diversidade(gi):
    outros = [len(set(jogos[gi])&set(jogos[j])) for j in range(9) if j!=gi]
    return 1 - (np.mean(outros)-8)/6  # menos interseccao = mais diverso
idx_eq = []
for i,g in enumerate(jogos):
    base = 50 + (raw_scores[i]-mn)/(mx-mn+1e-9)*40 if mx>mn else 70
    base += diversidade(i)*10
    idx_eq.append(round(min(100,max(0,base)),1))

# ---------- 22. TESTE RETROSPECTIVO ----------
# metodologia: para cada concurso-alvo t nos ultimos 30, monta 1 jogo com top-15
# dezenas por freq nos 100 concursos ANTERIORES a t; conta acertos. Sem vazamento.
bt_acertos = []
alld = [set(int(x) for x in df[BOLAS].iloc[i]) for i in range(len(df))]
for t in range(len(alld)-30, len(alld)):
    janela = alld[t-100:t]
    c = Counter()
    for s in janela: c.update(s)
    jogo_bt = set([n for n,_ in c.most_common(15)])
    bt_acertos.append(len(jogo_bt & alld[t]))
bt = np.array(bt_acertos)
bt_res = {'media':float(bt.mean()),'mediana':float(np.median(bt)),
          'min':int(bt.min()),'max':int(bt.max()),
          'p11':int((bt>=11).sum()),'p12':int((bt>=12).sum()),'p13':int((bt>=13).sum()),
          'p14':int((bt==14).sum()),'p15':int((bt==15).sum()),'n':len(bt)}

# ---------- 29. VALIDACAO FINAL ----------
vfin = {
    'todos_15': all(len(g)==15 for g in jogos),
    'intervalo_ok': all(all(1<=n<=25 for n in g) for g in jogos),
    'sem_rep_intra': all(len(set(g))==15 for g in jogos),
    'g123_8p': all(n_pares(set(jogos[i]))==8 for i in range(3)),
    'g456_7p': all(n_pares(set(jogos[i]))==7 for i in range(3,6)),
    'g789_8p': all(n_pares(set(jogos[i]))==8 for i in range(6,9)),
    'distintos': len(set(tuple(g) for g in jogos))==9,
    'cobre_25': len(cobertas)==25,
    'intersec': [[len(set(jogos[i])&set(jogos[j])) for j in range(9)] for i in range(9)],
}
print("VFIN", json.dumps({k:v for k,v in vfin.items() if k!='intersec'}))
print("BT", json.dumps(bt_res))

# ---------- DUMP JSON ----------
def counter_to_list(c, key=lambda x:x):
    return sorted([[list(k) if isinstance(k,tuple) else k, v] for k,v in c.items()], key=lambda x:-x[1])
out = {
 'val':val,
 'freq':{'f300':dict(f300),'f100':dict(f100),'f50':dict(f50),'f20':dict(f20),'f10':dict(f10),
         'esperada':esperada,'atraso':atraso,'maior_atraso':maior_atraso,'seq_max':seq_max,
         'atraso_medio':atraso_medio,'afinidade_media':afinidade_media,
         'classe':classe,'score':{n:round(score[n],4) for n in NUMS},'rank_freq':rank_freq,
         'ordenado':ordenado,'tend_alta':tend_alta,'tend_queda':tend_queda,
         'atrasadas':atrasadas,'voltaram':voltaram},
 'pi':counter_to_list(pi_counter),'pi10':counter_to_list(pi_10),'pi20':counter_to_list(pi_20),
 'mc':counter_to_list(mc_counter),'mc10':counter_to_list(mc_win(10)),'mc20':counter_to_list(mc_win(20)),
 'mc50':counter_to_list(mc_win(50)),'mc100':counter_to_list(mc_win(100)),
 'linha_totais':linha_totais,'linha_dist':counter_to_list(linha_dist_counter)[:15],
 'linha_ocup':{l:dict(linha_ocup[l]) for l in range(1,6)},
 'col_totais':col_totais,'col_dist':counter_to_list(col_dist_counter)[:15],
 'col_ocup':{c:dict(col_ocup[c]) for c in range(1,6)},
 'seq_size':dict(seq_size_counter),'seq_por_conc_media':float(np.mean(seq_por_concurso)),
 'seq_dezenas_media':float(np.mean(seq_dezenas_em_seq)),'maior_seq':maior_seq,
 'rep':{'counter':dict(rep_counter),'media':float(rep_arr.mean()),'min':int(rep_arr.min()),
        'max':int(rep_arr.max()),'moda':int(rep_counter.most_common(1)[0][0]),
        'perm':{n:[perm[n]['apareceu'],perm[n]['repetiu']] for n in NUMS}},
 'soma':{'min':int(somas.min()),'max':int(somas.max()),'media':float(somas.mean()),
         'mediana':float(np.median(somas)),'faixas':faixa_counter},
 'ba':counter_to_list(ba_counter),
 'primo':{'counter':dict(primo_counter),'media':float(primo_arr.mean())},
 'mult':{'m3':float(mult3.mean()),'m4':float(mult4.mean()),'m5':float(mult5.mean())},
 'finais':dict(finais_counter),
 'pares_top':[[list(k),v,lift(v,PROB2)] for k,v in par_counter.most_common(20)],
 'pares_bot':[[list(k),v,lift(v,PROB2)] for k,v in sorted(par_counter.items(),key=lambda x:x[1])[:20]],
 'pares_lift_all':{f"{a}-{b}":lift(v,PROB2) for (a,b),v in par_counter.items()},
 'trincas_top':[[list(k),v,lift(v,PROB3)] for k,v in trinca_counter.most_common(20)],
 'quartetos_top':[[list(k),v,lift(v,PROB4)] for k,v in quarteto_counter.most_common(20)],
 'pares_50':[[list(k),v] for k,v in par_win(50).most_common(15)],
 'pares_20':[[list(k),v] for k,v in par_win(20).most_common(15)],
 'pares_10':[[list(k),v] for k,v in par_win(10).most_common(15)],
 'ult':ult_info,
 'jogos':jogos,'criterios':criterios,'idx_eq':idx_eq,
 'metrics':[game_metrics(g) for g in jogos],
 'bt':bt_res,'vfin':vfin,
 'base':[[int(amostra['Concurso'].iloc[i]),str(amostra['Data Sorteio'].iloc[i])]+draws[i] for i in range(usados)],
}
with open("resultados.json","w") as f: json.dump(out, f, default=str)
print("DUMP_OK")





