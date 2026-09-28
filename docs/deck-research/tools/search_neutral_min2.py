# Exact constraint search over 48 cards; maximum 2,000,000 nodes per K.
import sys,json,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from simulate_prototype60 import graph,components
j=json.loads((ROOT/'prototype48.json').read_text());g=graph(j,'main');words=sorted(g);idx={w:i for i,w in enumerate(words)};nb=[sum(1<<idx[v] for v in g[w]) for w in words];ALL=(1<<len(words))-1

def bits(x):
 while x:
  b=x&-x;yield b.bit_length()-1;x-=b

def solve(k,limit=1000):
 nodes=0;sol=[];stop=False
 def dfs(n,r):
  nonlocal nodes,stop
  nodes+=1
  if nodes>2000000:stop=True;return
  while True:
   u=ALL&~(n|r)
   if n.bit_count()>8 or (n|u).bit_count()<8:return
   old=(n,r)
   if n.bit_count()==8:r|=u
   elif (n|u).bit_count()==8:n|=u
   u=ALL&~(n|r)
   for i in bits(ALL):
    bit=1<<i;p=(nb[i]&~n).bit_count()
    if r&bit:
     if p<2:return
     if p==2:r|=nb[i]&u
    elif n&bit:
     if p<k:return
     if p==k:r|=nb[i]&u
    elif p<k:r|=bit
   if n&r:return
   if old==(n,r):break
  u=ALL&~(n|r)
  if not u:
   s={words[i] for i in bits(n)};remaining=set(words)-s
   if len(components({w:g[w]&remaining for w in remaining}))==1:sol.append(s)
   if len(sol)>=limit:stop=True
   return
  i=max(bits(u),key=lambda i:((nb[i]&u).bit_count(),len(g[words[i]]),-i))
  dfs(n|(1<<i),r)
  if not stop:dfs(n,r|(1<<i))
 dfs(0,0)
 return sol,nodes,stop
for k in range(7,1,-1):
 sol,nodes,limited=solve(k)
 print('K',k,'solutions',len(sol),'nodes',nodes,'limited',limited,flush=True)
 if sol:
  s=max(sol,key=lambda ss:(sum(len(g[w]-ss) for w in ss),sum(len(g[w]-(ss)) for w in set(g)-ss),tuple(sorted(ss))))
  print('SELECT',[(w,len(g[w]-s)) for w in sorted(s)],flush=True)
  (ROOT/'neutral-min2-search.json').write_text(json.dumps({'min_neutral':k,'neutral':sorted(s),'nodes':nodes,'limited':limited,'solutions':len(sol)},ensure_ascii=False))
  break
