# Compõe e grava a música de fundo do Ludo (original, livre de direitos).
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
SR=44100; BPM=96; B=60/BPM                       # 1 tempo = 0,625 s
rng=np.random.default_rng(7)
def hz(n): return 440*2**((n-69)/12)
BARS=32; L=int(BARS*4*B*SR)
mixL=np.zeros(2*L); mixR=np.zeros(2*L)           # 2 voltas, para o eco do fim cair no começo
def put(sig,t,pan=0.0,g=1.0):
    i=int(t*SR); n=min(len(sig),len(mixL)-i)
    if n<=0: return
    mixL[i:i+n]+=sig[:n]*g*np.sqrt((1-pan)/2); mixR[i:i+n]+=sig[:n]*g*np.sqrt((1+pan)/2)
def env(n,a,d):  t=np.arange(n)/SR; return np.minimum(t/a,1)*np.exp(-t/d)
def kalimba(f,dur):
    n=int((dur+1.2)*SR); t=np.arange(n)/SR
    s=np.sin(2*np.pi*f*t)*np.exp(-t/0.9)+.35*np.sin(2*np.pi*f*5.4*t)*np.exp(-t/.12)+.12*np.sin(2*np.pi*f*11.2*t)*np.exp(-t/.05)
    return s*np.minimum(t/.004,1)
def marimba(f,dur):
    n=int((dur+.6)*SR); t=np.arange(n)/SR
    s=np.sin(2*np.pi*f*t)*np.exp(-t/.35)+.25*np.sin(2*np.pi*f*4*t)*np.exp(-t/.06)
    return s*np.minimum(t/.003,1)
def bell(f,dur):
    n=int((dur+1.5)*SR); t=np.arange(n)/SR
    return (np.sin(2*np.pi*f*t)+.4*np.sin(2*np.pi*f*2.76*t)*np.exp(-t/.3))*np.exp(-t/1.1)*np.minimum(t/.003,1)
def pad(fs,dur):
    n=int((dur+.8)*SR); t=np.arange(n)/SR; s=np.zeros(n)
    for f in fs:
        for det in (-.12,.12): s+=np.sin(2*np.pi*f*(1+det/100)*t)+.25*np.sin(2*np.pi*2*f*t)
    e=np.minimum(t/.6,1)*np.where(t<dur,1,np.exp(-(t-dur)/.35)); trem=1+.08*np.sin(2*np.pi*4.5*t)
    return s*e*trem/len(fs)
def bass(f,dur):
    n=int((dur+.2)*SR); t=np.arange(n)/SR
    s=np.tanh(1.6*(np.sin(2*np.pi*f*t)+.3*np.sin(2*np.pi*2*f*t)))
    return s*np.minimum(t/.01,1)*np.where(t<dur*.9,np.exp(-t/1.5),np.exp(-t/1.5)*np.exp(-(t-dur*.9)/.05))
def kick():
    t=np.arange(int(.35*SR))/SR; f=50+90*np.exp(-t/.03); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t/.12)
sos_hp=butter(4,6000,'hp',fs=SR,output='sos'); sos_bp=butter(2,[1200,4000],'bp',fs=SR,output='sos')
def shaker(): n=int(.09*SR); return sosfilt(sos_hp,rng.standard_normal(n))*np.exp(-np.arange(n)/SR/.025)
def snap():   n=int(.18*SR); return sosfilt(sos_bp,rng.standard_normal(n))*np.exp(-np.arange(n)/SR/.04)

# Fá maior: harmonia (notas do acorde) e baixo
CH={'F':[53,57,60,65],'Dm':[50,53,57,62],'Bb':[50,53,58,62],'C':[48,52,55,60],'Am':[52,57,60,64],'Gm':[50,55,58,62]}
RT={'F':41,'Dm':38,'Bb':34,'C':36,'Am':33,'Gm':31}
A_CH=['F','Dm','Bb','C','F','Dm','Bb','C']; B_CH=['Bb','C','Am','Dm','Gm','C','F','C']
A_MEL=[[(0,72,1),(1,69,.5),(1.5,72,.5),(2,77,1.5)],[(0,76,1),(1,74,1),(2,69,2)],
       [(0,70,.5),(.5,74,.5),(1,77,1),(2,74,.5),(2.5,72,1.5)],[(0,72,1),(1,74,.5),(1.5,76,.5),(2,79,2)],
       [(0,81,1),(1,79,.5),(1.5,77,.5),(2,76,1),(3,77,1)],[(0,74,1.5),(1.5,72,.5),(2,69,2)],
       [(0,70,1),(1,74,1),(2,77,1),(3,76,1)],[(0,74,1),(1,72,1),(2,72,2)]]
B_MEL=[[(0,77,1.5),(1.5,74,.5),(2,70,2)],[(0,79,1.5),(1.5,76,.5),(2,72,2)],
       [(0,76,.5),(.5,77,.5),(1,76,1),(2,72,1),(3,69,1)],[(0,74,3),(3,72,1)],
       [(0,70,1),(1,74,1),(2,79,1),(3,77,1)],[(0,76,1),(1,74,1),(2,72,2)],
       [(0,77,.5),(.5,76,.5),(1,77,1),(2,81,2)],[(0,79,1),(1,76,1),(2,72,2)]]
SECT=[('A',1),('A',2),('B',2),('A',3)]          # seção e intensidade
for rep in range(2):
  bar0=rep*BARS
  for si,(name,lvl) in enumerate(SECT):
    chs=A_CH if name=='A' else B_CH; mel=A_MEL if name=='A' else B_MEL
    for k in range(8):
        bar=bar0+si*8+k; t0=bar*4*B; c=chs[k]
        put(pad([hz(n) for n in CH[c]],4*B),t0,0,.11)
        r=hz(RT[c]); put(bass(r,1.5*B),t0,0,.30); put(bass(r,.9*B),t0+2*B,0,.24); put(bass(r*1.498,.45*B),t0+3.5*B,0,.18)
        arp=[CH[c][0]+12,CH[c][2]+12,CH[c][1]+12,CH[c][3]+12]
        for j in range(8):
            if lvl>=2 or j%2==0: put(marimba(hz(arp[j%4]),.5*B),t0+j*.5*B,(-.45 if j%2 else .45),.075)
        for (p,n,d) in mel[k]:
            put(kalimba(hz(n),d*B),t0+p*B,-.1,.23)
            if lvl==3: put(bell(hz(n+12),d*B),t0+p*B,.3,.05)
        for j in range(8):
            put(shaker(),t0+j*.5*B+(.012 if j%2 else 0),.25,(.05 if j%2 else .03)*(1 if lvl>1 else .6))
        if lvl>=2:
            put(kick(),t0,0,.42); put(kick(),t0+2*B,0,.32)
            put(snap(),t0+B,-.2,.10); put(snap(),t0+3*B,-.2,.10)
        else:
            put(kick(),t0,0,.25)
# reverb suave (sala) e volta sem emenda
irn=int(1.6*SR); ir_t=np.arange(irn)/SR
irL=rng.standard_normal(irn)*np.exp(-ir_t/.45); irR=rng.standard_normal(irn)*np.exp(-ir_t/.45)
irL/=np.sqrt((irL**2).sum()); irR/=np.sqrt((irR**2).sum())
wetL=fftconvolve(mixL,irL)[:2*L]; wetR=fftconvolve(mixR,irR)[:2*L]
outL=(mixL+.28*wetL)[L:]; outR=(mixR+.28*wetR)[L:]           # 2ª volta = loop perfeito
x=np.stack([outL,outR],1); x/=np.abs(x).max(); x=np.tanh(1.3*x)/np.tanh(1.3); x*=.85
import wave
with wave.open('/home/claude/musica/musica.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x*32767).astype('<i2').tobytes())
print('duração %.1fs'%(len(x)/SR))
