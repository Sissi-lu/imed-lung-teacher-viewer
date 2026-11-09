"""Exercise the production HTTP handler without starting its clinical-data loader."""
import ast
import http.client
import json
from pathlib import Path
import re
import tempfile
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class LearningApiTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.data = Path(self.temporary.name)
        bank = self.data / 'imaging-basics-v3'
        (bank / 'images').mkdir(parents=True)
        (bank / 'answers').mkdir()
        self.document = b'{"version":"api-fixture","questions":[]}'
        (bank / 'questions.json').write_bytes(self.document)
        (bank / 'images/N13.png').write_bytes(b'question-image')
        (bank / 'answers/N13.png').write_bytes(b'answer-image')
        (bank / 'review-record.json').write_text('private-review', encoding='utf-8')
        project = Path(__file__).resolve().parents[1]
        source = ast.parse((project / 'remote_server.py').read_text(encoding='utf-8'))
        handler = next(node for node in source.body if isinstance(node, ast.ClassDef) and node.name == 'Handler')
        namespace = {
            'SimpleHTTPRequestHandler': SimpleHTTPRequestHandler,
            'ROOT': project, 'DATA': self.data, 're': re, 'json': json,
            'load': lambda case_id: {'meta': {'caseId': case_id}, 'ct': b'ct', 'mask': b'mask'},
        }
        exec(compile(ast.Module(body=[handler], type_ignores=[]), 'remote_server.py', 'exec'), namespace)
        namespace['Handler'].log_message = lambda *args: None
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), namespace['Handler'])
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temporary.cleanup()

    def request(self, path):
        connection = http.client.HTTPConnection(*self.server.server_address, timeout=5)
        try:
            connection.request('GET', path)
            response = connection.getresponse()
            return response.status, response.getheader('Content-Type'), response.read()
        finally:
            connection.close()

    def test_reads_selected_data_root_and_images(self):
        status, mime, body = self.request('/api/learning/imaging-basics-v3/questions.json?fresh=1')
        self.assertEqual((status, mime, body), (200, 'application/json; charset=utf-8', self.document))
        for folder, content in [('images', b'question-image'), ('answers', b'answer-image')]:
            with self.subTest(folder=folder):
                self.assertEqual(self.request(f'/api/learning/imaging-basics-v3/{folder}/N13.png'),
                                 (200, 'image/png', content))

    def test_blocks_other_files_and_traversal(self):
        for suffix in ['review-record.json', '../questions.json', 'images/../questions.json',
                       'images/%2e%2e/questions.json', 'images/N13.nii.gz', 'images/N99.png', '']:
            with self.subTest(suffix=suffix):
                self.assertEqual(self.request('/api/learning/imaging-basics-v3/' + suffix)[0], 404)
        self.assertEqual(self.request('/data/imaging-basics-v3/questions.json')[0], 404)

    def test_missing_bank_has_no_project_directory_fallback(self):
        (self.data / 'imaging-basics-v3/questions.json').unlink()
        status, _, body = self.request('/api/learning/imaging-basics-v3/questions.json')
        self.assertEqual(status, 404)
        self.assertIn('error', json.loads(body))
        self.assertNotIn(str(self.data), body.decode('utf-8'))

    def test_existing_case_endpoints(self):
        for kind, content in [('meta', b'{"caseId": "30"}'), ('ct', b'ct'), ('mask', b'mask')]:
            with self.subTest(kind=kind):
                status, _, body = self.request('/api/cases/30/' + kind)
                self.assertEqual((status, body), (200, content))


if __name__ == '__main__':
    unittest.main()
