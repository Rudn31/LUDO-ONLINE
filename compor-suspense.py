# Música de suspense para o Ludo (original, livre de direitos). Ré menor, 88 bpm, loop sem emenda.
import numpy as np, wave
from scipy.signal import fftconvolve, butter, sosfilt
SR=44100; BPM=88; B=60/BPM; BARS=32; L=int(BARS*4*B*SR)
rng=np.random.default_rng(11)
hz=lambda n:440*2**((n-69)/12)
mL=np.zeros(2*L); mR=np.zeros(2*L)
def put(s,t,pan=0.,g=1.):
    i=int(t*SR); n=min(len(s),len(mL)-i)
    if n>0: mL[i:i+n]+=s[:n]*g*np.sqrt((1-pan)/2); mR[i:i+n]+=s[:n]*g*np.sqrt((1+pan)/2)
def lp(x,fc,o=2): return sosfilt(butter(o,fc,'lp',fs=SR,output='sos'),x)
def saw(f,t): return 2*((f*t)%1)-1
def ostinato(f,d):                      # pulso grave abafado
    n=int((d+.15)*SR); t=np.arange(n)/SR
    s=lp(saw(f,t)+saw(f*1.004,t),420)*np.exp(-t/.22)*np.minimum(t/.004,1); return s
def drone(fs,d):                        # cama escura
    n=int((d+1.2)*SR); t=np.arange(n)/SR; s=np.zeros(n)
    for f in fs:
        for dt in (-.2,.2): s+=saw(f*(1+dt/100),t)
    s=lp(s/len(fs),700,4); e=np.minimum(t/1.2,1)*np.where(t<d,1,np.exp(-(t-d)/.5)); return s*e
def strings_trem(fs,d):                 # cordas em trêmulo
    n=int((d+.6)*SR); t=np.arange(n)/SR; s=np.zeros(n)
    for f in fs: s+=lp(saw(f,t)+saw(f*1.003,t),1800)
    trem=.55+.45*np.sin(2*np.pi*11*t)**2; e=np.minimum(t/.8,1)*np.where(t<d,1,np.exp(-(t-d)/.3)); return s*trem*e/len(fs)
def celesta(f,d):
    n=int((d+2.5)*SR); t=np.arange(n)/SR
    return (np.sin(2*np.pi*f*t)+.5*np.sin(2*np.pi*f*3.01*t)*np.exp(-t/.25)+.2*np.sin(2*np.pi*f*5.98*t)*np.exp(-t/.08))*np.exp(-t/1.4)*np.minimum(t/.002,1)
def heart():                            # batida de coração
    t=np.arange(int(.3*SR))/SR; f=42+55*np.exp(-t/.025); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t/.09)
def tick(hi=True):                      # relógio
    n=int(.03*SR); t=np.arange(n)/SR; f=3200 if hi else 2400
    return np.sin(2*np.pi*f*t)*np.exp(-t/.004)+.3*sosfilt(butter(2,4000,'hp',fs=SR,output='sos'),rng.standard_normal(n))*np.exp(-t/.003)
def riser(d):                           # subida de tensão (ruído filtrado)
    n=int(d*SR); t=np.arange(n)/SR; x=rng.standard_normal(n); out=np.zeros(n); seg=2048
    for i in range(0,n,seg):
        fc=300+5000*(i/n)**2; out[i:i+seg]=sosfilt(butter(2,[fc,fc*1.6],'bp',fs=SR,output='sos'),x[i:i+seg])
    return out*(t/d)**2*np.exp(-np.maximum(t-d+.05,0)/.02)
CH={'Dm':[50,53,57],'Bb':[46,50,53],'Gm':[43,46,50],'A':[45,49,52],'Asus':[45,50,52],'Eb':[51,55,58]}
ROOT={'Dm':26,'Bb':22,'Gm':19,'A':21,'Asus':21,'Eb':27}
S=[('A',['Dm','Dm','Bb','A','Dm','Dm','Gm','A'],1),
   ('B',['Bb','Bb','Gm','Gm','Dm','Dm','Eb','A'],2),
   ('C',['Dm','Dm','Bb','A','Dm','Dm','Gm','Asus'],3),
   ('D',['Gm','A','Bb','A','Gm','Eb','A','A'],2)]
MEL={2:[(0,74),(1.5,75),(3,74)],3:[(0,81),(1,80),(2,77),(3,74)],}
for rep in range(2):
  for si,(nm,chs,lvl) in enumerate(S):
    for k,c in enumerate(chs):
        bar=rep*BARS+si*8+k; t0=bar*4*B; r=hz(ROOT[c]+12)
        put(drone([hz(n) for n in CH[c]],4*B),t0,0,.16)
        for j in range(8):                                   # ostinato em colcheias
            acc=1.0 if j in (0,3,6) else .65
            put(ostinato(r*(2 if j==7 and lvl>=2 else 1),.45*B),t0+j*.5*B,0,.17*acc)
        for j in range(8): put(tick(j%2==0),t0+j*.5*B,.55,.06 if lvl>1 else .045)
        if lvl>=2: put(heart(),t0,0,.34); put(heart(),t0+.38*B,0,.22); put(heart(),t0+2*B,0,.3); put(heart(),t0+2.38*B,0,.2)
        if lvl>=2: put(strings_trem([hz(n+12) for n in CH[c]],4*B),t0,-.3,.10)
        if lvl>=2:                                           # celesta sinistra (semitom, trítono)
            top=CH[c][2]+24
            notes=[(0,top),(1.5,top+1),(3,top)] if lvl==2 else [(0,top+7),(1,top+6),(2,top+3),(3,top)]
            for p,n in notes: put(celesta(hz(n),1*B),t0+p*B,.35,.11)
        if k==7: put(riser(4*B),t0,0,.08 if lvl<3 else .11)
# reverb grande e escura
irn=int(2.8*SR); it=np.arange(irn)/SR
irs=[lp(rng.standard_normal(irn),3500)*np.exp(-it/.9) for _ in range(2)]; irs=[i/np.sqrt((i**2).sum()) for i in irs]
wL=fftconvolve(mL,irs[0])[:2*L]; wR=fftconvolve(mR,irs[1])[:2*L]
x=np.stack([(mL+.38*wL)[L:],(mR+.38*wR)[L:]],1); x/=np.abs(x).max(); x=np.tanh(1.2*x)/np.tanh(1.2); x*=.85
with wave.open('/home/claude/musica/suspense.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x*32767).astype('<i2').tobytes())
print('duração %.1fs'%(len(x)/SR))
