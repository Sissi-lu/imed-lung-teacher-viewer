"""Read-only laboratory data service. Run under the deploying user's account."""
import argparse,gzip,json,struct,threading,zipfile,re
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import xml.etree.ElementTree as ET
import numpy as np

ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--data-root',default='/data5/zhangzhixuan/Med3DVLM/data')
parser.add_argument('--port',type=int,default=8765)
args=parser.parse_args(); DATA=Path(args.data_root).resolve()
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
X='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
def excel_rows():
 with zipfile.ZipFile(DATA/'0512勾画影像检查报告.xlsx') as z:
  strings=[]
  if 'xl/sharedStrings.xml' in z.namelist():
   strings=[''.join(e.itertext()) for e in ET.fromstring(z.read('xl/sharedStrings.xml'))]
  rows={}
  for row in ET.fromstring(z.read('xl/worksheets/sheet3.xml')).iter(X+'row'):
   cells={}
   for c in row.findall(X+'c'):
    col=re.sub(r'\d','',c.attrib['r']); v=c.find(X+'v'); value=v.text if v is not None else ''
    if c.attrib.get('t')=='s': value=strings[int(value)]
    elif c.attrib.get('t')=='inlineStr': value=''.join(c.itertext())
    cells[col]=value or ''
   key=cells.get('L','').strip()
   if key.isdigit(): rows[str(int(key))]={**cells,'row':row.attrib['r']}
  return rows
ROWS=excel_rows()
def case_paths(cid):
 if not re.fullmatch(r'\d+',cid): raise ValueError('无效病例编号')
 p=DATA/'Pulm'/cid
 if not p.is_dir(): raise FileNotFoundError('病例不存在')
 return p,ROWS.get(cid,{})
def word_path(row): return DATA/'10月6日新一批报告'/(row.get('M','')+'.docx')
def sections(path):
 if not path.is_file(): return []
 with zipfile.ZipFile(path) as z: body=ET.fromstring(z.read('word/document.xml')).find(W+'body')
 result=[]; heading='结构化描述'
 for el in body:
  if el.tag==W+'p':
   text=''.join(el.itertext()).strip()
   if text and len(text)<50: heading=text
  elif el.tag==W+'tbl':
   rows=[]
   for row in el.findall(W+'tr'):
    cells=['\n'.join(''.join(p.itertext()) for p in c.findall(W+'p')) for c in row.findall(W+'tc')]
    if cells: rows.append([cells[0],'\n'.join(cells[1:])])
   result.append({'title':heading,'rows':rows})
 return result
cache={}; lock=threading.Lock()
def load(cid):
 with lock:
  if cid in cache: return cache[cid]
  p,row=case_paths(cid)
  with gzip.open(p/(cid+'.nii.gz'),'rb') as f: raw=f.read()
  e='<' if struct.unpack('<i',raw[:4])[0]==348 else '>'
  if struct.unpack(e+'i',raw[:4])[0]!=348: raise ValueError('仅支持NIfTI-1')
  dims=struct.unpack(e+'8h',raw[40:56])[1:4]; spacing=struct.unpack(e+'8f',raw[76:108])[1:4]
  typ=struct.unpack(e+'h',raw[70:72])[0]; dtype={2:'u1',4:'i2',8:'i4',16:'f4',64:'f8',512:'u2'}[typ]
  off=int(struct.unpack(e+'f',raw[108:112])[0]); slope,inter=struct.unpack(e+'2f',raw[112:120]); slope=slope or 1
  ct=np.frombuffer(raw,dtype=e+dtype,count=int(np.prod(dims)),offset=off).astype(np.float32)*(slope)+inter
  # Display native axial grid; validate segmentation geometry before overlay.
  mp=p/(cid+'.seg.nrrd'); mask=np.zeros(int(np.prod(dims)),dtype=np.uint8); labels=[]; warning=''
  if mp.exists():
   data=mp.read_bytes(); split=b'\n\n' if b'\n\n' in data else b'\r\n\r\n'; h,payload=data.split(split,1); h=h.decode(); fields={}
   for line in h.splitlines():
    if ':' in line and not line.startswith('#'):
     k,v=line.split(':',1); fields[k]=v.strip()
   shape=tuple(map(int,fields['sizes'].split()))
   if shape!=dims or fields.get('type') not in ('unsigned char','uchar','uint8'): warning='标签网格或类型暂不支持，未叠加'
   else:
    candidate=np.frombuffer(gzip.decompress(payload) if fields.get('encoding')=='gzip' else payload,dtype=np.uint8)
    # Slicer uses LPS; NIfTI sform uses RAS. Reject unverified geometry.
    sform=struct.unpack(e+'h',raw[254:256])[0]
    directions=re.findall(r'\(([^)]+)\)',fields.get('space directions',''))
    origin=[float(v) for v in fields.get('space origin','(0,0,0)').strip('()').split(',')]
    affine=np.array(struct.unpack(e+'12f',raw[280:328])).reshape(3,4)
    seg=np.array([[float(v) for v in d.split(',')] for d in directions]).T
    if fields.get('space')=='left-posterior-superior': seg[:2]*=-1; origin=np.array(origin)*[-1,-1,1]
    if sform and seg.shape==(3,3) and np.allclose(seg,affine[:,:3],atol=.001) and np.allclose(origin,affine[:,3],atol=.01) and candidate.size==mask.size:
     mask=candidate; labels=[int(n) for n in np.unique(mask) if n]
    else: warning='标签与CT空间坐标未通过校验，未叠加'
  z=mask.reshape(dims[::-1]); counts=np.count_nonzero(z,axis=(1,2)); target=int(np.argmax(counts)) if counts.any() else dims[2]//2
  display_affine=np.array(struct.unpack(e+'12f',raw[280:328])).reshape(3,4)[:,:3]
  diag=np.diag(display_affine)
  axial=bool(struct.unpack(e+'h',raw[254:256])[0] and np.all(np.abs(diag)>1e-5) and np.allclose(display_affine,np.diag(diag),atol=1e-4))
  display_geometry={'flipX':bool(axial and diag[0]>0),'flipY':bool(axial and diag[1]>0),'reverseZ':bool(axial and diag[2]>0),'verified':axial}
  doc=word_path(row); docSections=sections(doc)
  meta={'caseId':cid,'examId':row.get('M','未匹配'),'dims':dims,'spacing':spacing,'target':target,'maskVoxels':int(np.count_nonzero(mask)),'labelCount':len(labels),'labels':labels,'hasMask':bool(labels),'warning':warning,'sections':docSections,'structuredSource':doc.name if docSections else '未找到对应Word报告','findings':row.get('P','未找到Excel影像所见'),'diagnosis':row.get('Q','未找到Excel诊断意见'),'source':'Sheet3 · 第'+str(row.get('row','?'))+'行 · 序号'+cid,'excelRow':row.get('row','?'),'orientationVerified':axial,'displayGeometry':display_geometry}
  result={'meta':meta,'ct':gzip.compress(np.clip(ct,-32768,32767).astype('<i2').tobytes(),compresslevel=1),'mask':gzip.compress(mask.tobytes(),compresslevel=1)}
  cache.clear();cache[cid]=result;return result
class Handler(SimpleHTTPRequestHandler):
 protocol_version='HTTP/1.1'
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def do_GET(self):
  path=self.path.split('?',1)[0]
  try:
   if path=='/api/cases':
    cases=[]
    for p in (DATA/'Pulm').iterdir():
     if p.is_dir() and p.name.isdigit() and (p/(p.name+'.nii.gz')).is_file():
      r=ROWS.get(p.name,{})
      cases.append({'id':p.name,'examId':r.get('M','未匹配'),'hasWord':word_path(r).is_file(),'hasMask':(p/(p.name+'.seg.nrrd')).is_file(),'hasReport':bool(r.get('P'))})
    return self.send_json({'server':'70服务器','cases':sorted(cases,key=lambda c:int(c['id']))})
   match=re.fullmatch(r'/api/cases/(\d+)/(meta|ct|mask)',path)
   if match:
    cid,kind=match.groups(); result=load(cid)
    if kind=='meta':return self.send_json(result['meta'])
    return self.send_bytes(result[kind],'application/octet-stream')
   if path.startswith('/api/'):return self.send_error(404)
   # Serve only UI resources. No arbitrary directory listings or dataset paths.
   allowed={'/','/index.html','/style.css','/game.css','/app.js','/game.js','/result-provider.js','/cases.js','/assets/lab-emblem.png'}
   if path not in allowed:return self.send_error(404)
   super().do_GET()
  except (FileNotFoundError,ValueError,KeyError) as ex:self.send_json({'error':str(ex)},400)
  except Exception as ex:
   print(type(ex).__name__,str(ex),flush=True);self.send_json({'error':'病例读取失败，请查看服务日志'},500)
 def send_json(self,value,status=200):return self.send_bytes(json.dumps(value,ensure_ascii=False).encode(),'application/json; charset=utf-8',status)
 def send_bytes(self,b,mime,status=200):
  self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(b)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(b)
print('Serving laboratory UI on port',args.port,'data',DATA,flush=True)
ThreadingHTTPServer(('0.0.0.0',args.port),Handler).serve_forever()
