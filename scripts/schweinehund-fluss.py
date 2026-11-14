"""Misst Bewegung zwischen bestehenden Posen; schreibt nur kleine Zahlenfelder, keine Bilder."""
import sys,json,base64
import cv2
import numpy as np
q=json.load(open(sys.argv[1]));grau={};masken={}
for key,f in q['bilder'].items():
 im=cv2.imread(f['datei'],cv2.IMREAD_UNCHANGED)[f['y']:f['y']+256,f['x']:f['x']+256]
 im=cv2.warpAffine(im,np.float32([[1,0,128-f['ankerX']],[0,1,0]]),(256,256))
 alpha=im[:,:,3].astype(np.float32)/255
 g=cv2.cvtColor(im[:,:,:3],cv2.COLOR_BGR2GRAY).astype(np.float32)
 grau[key]=np.uint8(np.clip(g*alpha+96*(1-alpha),0,255))
 masken[key]=cv2.GaussianBlur(cv2.dilate(np.uint8(alpha*255),np.ones((23,23),np.uint8)),(13,13),0).astype(np.float32)/255
cv2.setNumThreads(1)
def feld(a,b):
 dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
 flow=dis.calc(grau[a],grau[b],None)
 flow=cv2.GaussianBlur(flow,(11,11),0)*masken[a][:,:,None]
 samples=[]
 for y in range(0,257,32):
  for x in range(0,257,32):
   samples.extend(np.clip(np.rint(flow[min(y,255),min(x,255)]*2),-127,127).astype(np.int8).tolist())
 return base64.b64encode(np.array(samples,dtype=np.int8).tobytes()).decode()

r={}
for p in sorted(q['paare']):
 a,b=p.split('|');r[p]=[feld(a,b),feld(b,a)]
json.dump(r,open(sys.argv[2],'w'),separators=(',',':'))
