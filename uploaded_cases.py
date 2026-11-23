"""Bounded NIfTI reader for account-owned uploads; no clinical references inferred."""
from functools import lru_cache
import gzip
import struct
import numpy as np

MAX_UPLOAD = 512 * 1024 * 1024
MAX_RAW = 1536 * 1024 * 1024


@lru_cache(maxsize=1)
def read(path, cid, name):
    with open(path,'rb') as f:
        compressed = f.read(2) == b'\x1f\x8b'
    with (gzip.open(path,'rb') if compressed else open(path,'rb')) as f:
        raw = f.read(MAX_RAW+1)
    if len(raw)>MAX_RAW or len(raw)<352:
        raise ValueError('影像过大或文件不完整')
    e = '<' if struct.unpack('<i',raw[:4])[0]==348 else '>'
    if struct.unpack(e+'i',raw[:4])[0]!=348 or raw[344:348]!=b'n+1\0':
        raise ValueError('仅支持单文件 NIfTI-1')
    shape = struct.unpack(e+'8h',raw[40:56])
    dims = shape[1:4]
    count = int(np.prod(dims))
    if shape[0]!=3 or min(dims)<=0 or count>180000000:
        raise ValueError('仅支持三维CT，最多1.8亿体素')
    spacing = struct.unpack(e+'8f',raw[76:108])[1:4]
    typ = struct.unpack(e+'h',raw[70:72])[0]
    dtype = {2:'u1',4:'i2',8:'i4',16:'f4',64:'f8',512:'u2'}.get(typ)
    off = struct.unpack(e+'f',raw[108:112])[0]
    if not dtype or not np.isfinite(off) or off<352 or int(off)+count*np.dtype(dtype).itemsize>len(raw):
        raise ValueError('影像类型不支持或文件不完整')
    slope,inter = struct.unpack(e+'2f',raw[112:120]); slope=slope or 1
    if not np.isfinite([slope,inter,*spacing]).all() or min(spacing)<=0:
        raise ValueError('无效体素间距或强度参数')
    ct=np.frombuffer(raw,dtype=e+dtype,count=count,offset=int(off)).astype(np.float32)*slope+inter
    if not np.isfinite(ct).all():
        raise ValueError('影像包含无效强度')
    affine=np.array(struct.unpack(e+'12f',raw[280:328])).reshape(3,4)[:,:3]
    diag=np.diag(affine)
    axial=bool(struct.unpack(e+'h',raw[254:256])[0] and np.all(np.abs(diag)>1e-5) and np.allclose(affine,np.diag(diag),atol=1e-4))
    meta=dict(caseId=cid,caseName=name,source='用户导入',examId='用户导入',dims=dims,spacing=spacing,target=0,maskVoxels=0,hasMask=False,sections=[],findings='无关联参考报告',diagnosis='无关联参考报告',patientAge='',patientSex='',displayGeometry=dict(flipX=bool(axial and diag[0]>0),flipY=bool(axial and diag[1]>0),reverseZ=bool(axial and diag[2]>0),verified=axial))
    return dict(meta=meta,ct=gzip.compress(np.clip(ct,-32768,32767).astype('<i2').tobytes(),compresslevel=1),mask=gzip.compress(bytes(count),compresslevel=1))
