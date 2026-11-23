"""Exercise SAM sessions without loading GPU weights."""
import base64
import io
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
try:
    import numpy as np
    from PIL import Image
    from fastapi.testclient import TestClient
    from sam_api import create_app
except ImportError:
    TestClient = None


class Runner:
    backend = 'sam2'
    checkpoint = 'fixture.pt'
    def new_predictor(self): return {}
    def set_image(self, predictor, image): predictor['shape'] = image.shape[:2]
    def predict(self, predictor, points, mask_input=None):
        result = np.zeros(predictor['shape'], dtype=bool)
        for x, y, label in points: result[int(y), int(x)] = label
        return result, .9, np.zeros((1, 2, 2))


@unittest.skipIf(TestClient is None, 'Run in the dedicated SAM API environment')
class SamApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app(Runner()))
        out = io.BytesIO(); Image.new('RGB', (8, 8)).save(out, format='PNG')
        self.image = base64.b64encode(out.getvalue()).decode()

    def session(self):
        return self.client.post('/sessions', json={'imagePng': self.image}).json()['sessionId']

    def test_isolation_release_and_point_validation(self):
        a, b = self.session(), self.session()
        data = {'objectId': 'one', 'revision': 2, 'points': [[1, 2, 1], [0, 0, 0]]}
        response = self.client.post(f'/sessions/{a}/predict', json=data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['revision'], 2)
        self.assertTrue(response.json()['maskPng'])
        self.client.delete(f'/sessions/{a}')
        self.assertEqual(self.client.post(f'/sessions/{a}/predict', json=data).status_code, 410)
        self.assertEqual(self.client.post(f'/sessions/{b}/predict', json=data).status_code, 200)
        data['points'] = [[1, 2, 1]]
        self.assertEqual(self.client.post(f'/sessions/{b}/predict', json=data).status_code, 400)
        data['points'] = [[99, 0, 1], [0, 0, 0]]
        self.assertEqual(self.client.post(f'/sessions/{b}/predict', json=data).status_code, 400)

    def test_capacity_eviction(self):
        first = self.session()
        for _ in range(4): self.session()
        self.assertEqual(self.client.post(f'/sessions/{first}/predict', json={}).status_code, 410)


if __name__ == '__main__': unittest.main()
