"""Practice grading and immutable submission archives; clinical source data stays read-only."""
import base64
import gzip
import io
import json
import re
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def png(array):
    stream = io.BytesIO()
    Image.fromarray(array.astype('uint8')).save(stream, format='PNG')
    return stream.getvalue()


def frame(result, z):
    nx, ny, nz = result['meta']['dims']
    if type(z) is not int or not 0 <= z < nz:
        raise ValueError('无效切片索引')
    with gzip.GzipFile(fileobj=io.BytesIO(result['ct'])) as stream:
        stream.seek(z * nx * ny * 2)
        raw = stream.read(nx * ny * 2)
    image = np.frombuffer(raw, dtype='<i2').reshape(ny, nx)
    return png(np.clip((image.astype(float) + 1350) / 1500 * 255, 0, 255))


def submit(data, load, output):
    cid = str(data.get('caseId', ''))
    if not cid.isdigit():
        raise ValueError('无效病例编号')
    result = load(cid)
    nx, ny, nz = result['meta']['dims']
    z = data.get('sliceIndex')
    frame_png = frame(result, z)
    mode = data.get('mode')
    if mode not in ('learning', 'application', 'innovation'):
        raise ValueError('无效练习模式')
    session = data.get('anonymousSession', '')
    if not re.fullmatch(r'[a-zA-Z0-9-]{1,80}', session):
        raise ValueError('无效匿名会话')
    gt = np.frombuffer(gzip.decompress(result['mask']), dtype='uint8').reshape(nz, ny, nx)[z] > 0
    applicable = result['meta'].get('maskVoxels', 0) > 0
    if mode == 'application':
        image = Image.new('L', (nx, ny))
        draw = ImageDraw.Draw(image)
        polygons = data.get('polygons', [])
        if not polygons or len(polygons) > 100:
            raise ValueError('请绘制闭合轮廓')
        for points in polygons:
            if not 3 <= len(points) <= 2000:
                raise ValueError('轮廓至少需要三个点')
            coords = []
            for p in points:
                x, y = p
                if not np.isfinite([x, y]).all() or not (0 <= x < nx and 0 <= y < ny):
                    raise ValueError('轮廓坐标越界')
                coords.append((round(x), round(y)))
            draw.polygon(coords, fill=1)
        predicted = np.asarray(image.convert('L')) > 0
    elif mode == 'innovation':
        groups = data.get('groups', [])
        if not groups or len(groups) > 100:
            raise ValueError('请添加病灶和前背景点')
        for group in groups:
            if {p[2] for p in group['points']} != {0, 1}:
                raise ValueError('每个病灶需要前景点和背景点')
        image = Image.open(io.BytesIO(base64.b64decode(data.get('maskPng', ''), validate=True)))
        if image.size != (nx, ny) or image.mode not in ('L','RGB','RGBA'):
            raise ValueError('分割尺寸或格式错误')
        predicted = np.asarray(image.convert('L')) > 0
    else:
        predicted = np.zeros((ny, nx), dtype=bool)
    if mode != 'learning' and not predicted.any():
        raise ValueError('不能提交空标注')
    dice = None
    if applicable and mode != 'learning':
        dice = float(2 * np.count_nonzero(predicted & gt) / (predicted.sum() + gt.sum()))
    passed = not applicable or (dice is not None and dice >= .5)
    score = None if not applicable else round((dice or 0) * 25, 2)
    if mode == 'learning':
        record = data.get('localization', {})
        passed = not applicable or record.get('outcome') in ('hit', 'hint')
        score = None if not applicable else max(0, 25 - 2.5 * (max(1, int(record.get('attempts', 1))) - 1)) if record.get('outcome') == 'hit' else 0
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
    submission_id = stamp + '_' + uuid.uuid4().hex
    folder = Path(output) / submission_id
    folder.mkdir(parents=True, exist_ok=False)
    metadata = {**data, 'submissionId': submission_id, 'createdAt': stamp, 'dice': dice,
                'passed': passed, 'threshold': .5, 'score': score, 'applicable': applicable}
    metadata.pop('maskPng', None)
    (folder / 'submission.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
    (folder / 'image.png').write_bytes(frame_png)
    (folder / 'mask.png').write_bytes(png(predicted * 255))
    response = {k: metadata[k] for k in ('submissionId', 'dice', 'passed', 'threshold', 'score', 'applicable')}
    if applicable and mode != 'learning' and not gt.any():
        response['message'] = '该帧没有参考病灶，请重新选择切片后标注。'
    return response


def download(output, submission_id):
    if not re.fullmatch(r'\d{8}T\d{6}\.\d{6}Z_[0-9a-f]{32}', submission_id):
        raise ValueError('无效提交编号')
    folder = Path(output) / submission_id
    if not folder.is_dir():
        raise FileNotFoundError('提交不存在')
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in ('submission.json', 'image.png', 'mask.png'):
            archive.write(folder / name, name)
    return stream.getvalue()
