"""Independent SAM inference process. No clinical dataset access is required here."""
import asyncio
import contextlib
import argparse
import base64
import io
import sys
import threading
import time
import uuid
from pathlib import Path

import numpy as np
from PIL import Image
from fastapi import FastAPI, HTTPException
import uvicorn


def create_app(runner):
    sessions = {}
    lock = threading.RLock()

    async def collect_idle():
        while True:
            await asyncio.sleep(60)
            with lock:
                for sid in list(sessions):
                    if time.monotonic() - sessions[sid]['time'] > 1800:
                        del sessions[sid]

    @contextlib.asynccontextmanager
    async def lifespan(app):
        task = asyncio.create_task(collect_idle())
        try:
            yield
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    app = FastAPI(lifespan=lifespan)

    def get(sid):
        if sid not in sessions or time.monotonic() - sessions[sid]['time'] > 1800:
            sessions.pop(sid, None)
            raise HTTPException(410, '分割会话已过期，请重试')
        sessions[sid]['time'] = time.monotonic()
        return sessions[sid]

    @app.get('/health')
    def health():
        return {'ready': True, 'backend': runner.backend, 'checkpoint': Path(runner.checkpoint).name}

    @app.post('/sessions')
    def session(data: dict):
        try:
            raw = base64.b64decode(data['imagePng'], validate=True)
            image = Image.open(io.BytesIO(raw)).convert('RGB')
            if max(image.size) > 2048:
                raise ValueError('图像过大')
            with lock:
                for sid in list(sessions):
                    if time.monotonic() - sessions[sid]['time'] > 1800:
                        del sessions[sid]
                if len(sessions) >= 4:
                    del sessions[min(sessions, key=lambda sid: sessions[sid]['time'])]
                predictor = runner.new_predictor()
                runner.set_image(predictor, np.asarray(image))
                sid = uuid.uuid4().hex
                sessions[sid] = {'predictor': predictor, 'groups': {}, 'time': time.monotonic(), 'size': image.size}
                return {'sessionId': sid, 'backend': runner.backend, 'checkpoint': Path(runner.checkpoint).name}
        except (ValueError, KeyError) as exc:
            raise HTTPException(400, str(exc))

    @app.post('/sessions/{sid}/predict')
    def predict(sid: str, data: dict):
        with lock:
            s = get(sid)
            points = data.get('points', [])
            if not points or len(points) > 1000:
                raise HTTPException(400, '无效点集')
            for x, y, label in points:
                if label not in (0, 1) or not np.isfinite([x, y]).all() or not (0 <= x < s['size'][0] and 0 <= y < s['size'][1]):
                    raise HTTPException(400, '点坐标或标签无效')
            if {p[2] for p in points} != {0, 1}:
                raise HTTPException(400, '请提供前景点和背景点')
            gid = str(data.get('objectId', '0'))
            old = s['groups'].get(gid)
            previous = old['low'] if old and points[:-1] == old['points'] else None
            mask, score, low = runner.predict(s['predictor'], points, mask_input=previous)
            s['groups'][gid] = {'points': points, 'low': low}
            out = io.BytesIO()
            Image.fromarray(mask.astype('uint8') * 255).save(out, format='PNG')
            return {'revision': data.get('revision'), 'maskPng': base64.b64encode(out.getvalue()).decode(), 'modelScore': score}

    @app.delete('/sessions/{sid}')
    def release(sid: str):
        with lock:
            sessions.pop(sid, None)
        return {'ok': True}

    return app


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--sam-source', default='/data_new/moyancheng/code/agent/SAM/segment-anything')
    parser.add_argument('--checkpoint')
    parser.add_argument('--device', default='cuda:0')
    parser.add_argument('--port', type=int, default=8766)
    args = parser.parse_args()
    sys.path.insert(0, args.sam_source)
    from web_ui.sam_backend import build_runner
    runner = build_runner(args.checkpoint or str(Path(args.sam_source) / 'web_ui/checkpoints/lung_sam2_hiera_l.pt'), backend='sam2', device=args.device)
    uvicorn.run(create_app(runner), host='127.0.0.1', port=args.port)
