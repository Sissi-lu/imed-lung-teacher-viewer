"""Check the pass boundary, native masks and immutable practice archives."""
import base64
import gzip
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np
from PIL import Image
from practice_api import submit, download, png


class PracticeTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.gt = np.zeros((2, 4, 4), dtype='uint8')
        self.gt[0, 0, :3] = 1
        self.result = {'meta': {'dims': [4, 4, 2], 'maskVoxels': 3},
                       'ct': gzip.compress(np.zeros((2, 4, 4), dtype='<i2').tobytes()),
                       'mask': gzip.compress(self.gt.tobytes())}
        self.pred = np.zeros((4, 4), dtype='uint8')
        self.pred[0, 0] = 255
        self.data = {'caseId': '30', 'anonymousSession': 'test-session', 'mode': 'innovation',
                     'sliceIndex': 0, 'groups': [{'points': [[0, 0, 1], [3, 3, 0]]}],
                     'maskPng': base64.b64encode(png(self.pred)).decode()}

    def tearDown(self):
        self.temp.cleanup()

    def submit(self):
        return submit(self.data, lambda cid: self.result, self.temp.name)

    def test_boundary_and_archive(self):
        a, b = self.submit(), self.submit()
        self.assertEqual(a['dice'], .5)
        self.assertTrue(a['passed'])
        self.assertEqual(a['score'], 12.5)
        self.assertNotEqual(a['submissionId'], b['submissionId'])
        with zipfile.ZipFile(io.BytesIO(download(self.temp.name, a['submissionId']))) as z:
            self.assertEqual(set(z.namelist()), {'submission.json', 'image.png', 'mask.png'})
            self.assertEqual(json.loads(z.read('submission.json'))['sliceIndex'], 0)

    def test_empty_reference_frame_never_passes(self):
        self.data['sliceIndex'] = 1
        self.assertFalse(self.submit()['passed'])

    def test_case_without_gt(self):
        self.result['meta']['maskVoxels'] = 0
        r = self.submit()
        self.assertTrue(r['passed'])
        self.assertIsNone(r['score'])

    def test_coaching_metrics(self):
        r = self.submit()
        self.assertEqual(r['precision'], 1)
        self.assertAlmostEqual(r['recall'], 1 / 3)
        preview = submit(self.data, lambda cid: self.result)
        self.assertEqual(preview['precision'], r['precision'])
        with zipfile.ZipFile(io.BytesIO(download(self.temp.name, r['submissionId']))) as z:
            self.assertEqual(json.loads(z.read('submission.json'))['recall'], r['recall'])
        self.result['mask'] = gzip.compress((self.pred > 0)[None].repeat(2, axis=0).astype('uint8').tobytes())
        self.assertEqual(self.submit()['dice'], 1)
        self.assertEqual(self.submit()['recall'], 1)
        self.pred[0, 1:3] = 255
        self.data['maskPng'] = base64.b64encode(png(self.pred)).decode()
        self.assertAlmostEqual(self.submit()['precision'], 1 / 3)
        self.assertEqual(self.submit()['recall'], 1)
        self.result['meta']['maskVoxels'] = 0
        self.assertIsNone(self.submit()['precision'])
        self.assertIsNone(self.submit()['recall'])
        self.result['meta']['maskVoxels'] = 3
        self.result['mask'] = gzip.compress(np.zeros((2, 4, 4), dtype='uint8').tobytes())
        self.assertIsNone(self.submit()['recall'])
        self.assertIn('重新选择', self.submit()['message'])
        self.data.update(mode='learning', localization={'attempts': 1, 'outcome': 'hit'})
        self.assertIsNone(self.submit()['precision'])
        self.assertEqual(self.submit()['score'], 25)

    def test_metrics_target_and_failed_attempt(self):
        gt = np.zeros((2, 4, 4), dtype='uint8')
        gt[0].flat[:5] = 1
        self.result['mask'] = gzip.compress(gt.tobytes())
        self.pred[:] = 0
        self.pred.flat[:4] = 255
        self.pred.flat[5] = 255
        self.data['maskPng'] = base64.b64encode(png(self.pred)).decode()
        r = self.submit()
        self.assertEqual((r['precision'], r['recall'], r['dice'], r['score']), (.8, .8, .8, 20))
        self.pred.flat[:4] = 0
        self.pred.flat[0] = 255
        self.data['maskPng'] = base64.b64encode(png(self.pred)).decode()
        r = self.submit()
        self.assertFalse(r['passed'])
        self.assertEqual(r['precision'], .5)
        self.assertEqual(r['recall'], .2)

    def test_invalid_frame_and_empty_mask(self):
        self.data['sliceIndex'] = -1
        with self.assertRaises(ValueError): self.submit()
        self.data['sliceIndex'] = 0
        self.data['maskPng'] = base64.b64encode(png(np.zeros((4, 4), dtype='uint8'))).decode()
        with self.assertRaises(ValueError): self.submit()
        with self.assertRaises(ValueError): download(self.temp.name, '../escape')

    def test_polygon_and_rgba_mask(self):
        self.data.update(mode='application', polygons=[[[0, 0], [2, 0], [2, 1], [0, 1]]])
        self.assertGreater(self.submit()['dice'], 0)
        im = Image.fromarray(self.pred).convert('RGBA')
        buf = io.BytesIO(); im.save(buf, format='PNG')
        self.data.update(mode='innovation', maskPng=base64.b64encode(buf.getvalue()).decode())
        self.assertEqual(self.submit()['dice'], .5)


if __name__ == '__main__': unittest.main()
