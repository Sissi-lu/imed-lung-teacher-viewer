from pathlib import Path
import gzip,json,struct
import numpy as np
from docx import Document
from openpyxl import load_workbook

ROOT=Path(__file__).resolve().parent
DATA=ROOT/'data'; DATA.mkdir(exist_ok=True)
source=ROOT.parent
with gzip.open(source/'30/30.nii.gz','rb') as f: raw=f.read()
e='<' if struct.unpack('<i',raw[:4])[0]==348 else '>'
dims=struct.unpack(e+'8h',raw[40:56])[1:4]
dtype={2:'u1',4:'i2',8:'i4',16:'f4',64:'f8',512:'u2'}[struct.unpack(e+'h',raw[70:72])[0]]
offset=int(struct.unpack(e+'f',raw[108:112])[0])
slope,intercept=struct.unpack(e+'2f',raw[112:120]); slope=slope or 1
ct=np.frombuffer(raw,dtype=e+dtype,count=int(np.prod(dims)),offset=offset).astype(np.float32)*slope+intercept
(DATA/'ct.bin.gz').write_bytes(gzip.compress(ct.astype('<i2').tobytes()))
nrrd=(source/'30/30.seg.nrrd').read_bytes()
header,payload=nrrd.split(b'\n\n',1)
mask=np.frombuffer(gzip.decompress(payload),dtype=np.uint8)
assert mask.size==ct.size
(DATA/'mask.bin.gz').write_bytes(gzip.compress(mask.tobytes()))
zyx=mask.reshape(dims[::-1]); pts=np.argwhere(zyx>0)
target=int(np.argmax(np.count_nonzero(zyx,axis=(1,2))))
doc=Document(source/'ZX5057258.docx')
sections=[]
names=['数目与目标','部位','大小','形态','边缘与边界','密度与内部结构','强化表现','周围组织及邻近结构关系','既往对比','分类结果','建议意见']
for name,t in zip(names,doc.tables):
 sections.append({'title':name,'rows':[[c.text for c in r.cells] for r in t.rows]})
w=load_workbook(source/'0512勾画影像检查报告.xlsx',read_only=True,data_only=True)
r=next(r for r in w['Sheet3'].iter_rows(values_only=True) if r[11]==30)
meta={'dims':dims,'spacing':list(struct.unpack(e+'8f',raw[76:108])[1:4]),'target':target,'maskVoxels':int(len(pts)),'maskSlices':[int(pts[:,0].min()),int(pts[:,0].max())],'caseId':'030','examId':r[12],'date':str(r[14]),'findings':r[15],'diagnosis':r[16],'sections':sections,'source':'Sheet3 · 第31行 · 序号30'}
(DATA/'case.json').write_text(json.dumps(meta,ensure_ascii=False),encoding='utf-8')
print('Prepared',dims,'target slice',target+1,'mask voxels',len(pts))
