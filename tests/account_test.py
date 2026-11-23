"""HTTP auth, ownership, snapshot immutability and upload integration."""
import ast
import gzip
import http.client
import json
import re
import struct
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from account_store import Store, ApiError
from account_http import AccountHandler
from practice_api import submit
import uploaded_cases


class AccountTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.store=Store(self.tmp.name)
        root=Path(__file__).resolve().parents[1]
        tree=ast.parse((root/'remote_server.py').read_text())
        base=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='BaseHandler')
        ns=dict(SimpleHTTPRequestHandler=SimpleHTTPRequestHandler,ROOT=root,DATA=Path(self.tmp.name),re=re,json=json,ApiError=ApiError)
        exec(compile(ast.Module(body=[base],type_ignores=[]),'remote_server.py','exec'),ns)
        store=self.store
        class Handler(AccountHandler,ns['BaseHandler']):
            secure_cookie=False
            clinical_load=staticmethod(lambda cid:{'meta':{'caseId':cid,'caseName':'病例 '+cid}})
            grade_preview=staticmethod(submit)
            def log_message(self,*args): pass
        Handler.store=store
        self.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()

    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join();self.tmp.cleanup()

    def request(self,path,data=None,session=None,headers=None):
        h={'X-Lung-Request':'1',**(headers or {})}
        if session:h.update(Cookie=session[0],**{'X-CSRF-Token':session[1]['csrf']})
        body=json.dumps(data).encode() if isinstance(data,dict) else data
        c=http.client.HTTPConnection(*self.server.server_address,timeout=10)
        c.request('POST' if data is not None else 'GET',path,body,h)
        r=c.getresponse();b=r.read();cookie=r.getheader('Set-Cookie');status=r.status;c.close()
        try:b=json.loads(b)
        except ValueError:pass
        return status,b,cookie

    def user(self,name):
        status,user,cookie=self.request('/api/auth/register',dict(username=name,password='password123',role='admin'))
        self.assertEqual(status,200);self.assertEqual(user['role'],'user')
        return cookie.split(';')[0],user

    def test_auth_csrf_and_private_resources(self):
        self.assertEqual(self.request('/api/cases/30/meta')[0],401)
        a=self.user('alice');b=self.user('bob')
        self.assertEqual(self.request('/api/auth/login',dict(username='alice',password='wrong'))[0],401)
        self.assertEqual(self.request('/api/admin/play-records',session=a)[0],403)
        self.assertEqual(self.request('/api/progress',dict(key='learning:v1',value={},revision=0),headers={'Cookie':a[0]})[0],403)
        self.store.own_resource('owned',a[1],'submission')
        self.assertEqual(self.request('/api/practice/submissions/owned/download',session=b)[0],404)
        self.assertEqual(self.request('/api/auth/logout',{},a)[0],200)
        self.assertEqual(self.request('/api/auth/me',session=a)[0],401)
        with self.store.db() as db:db.execute('UPDATE sessions SET expires=0')
        self.assertEqual(self.request('/api/auth/me',session=b)[0],401)

    def test_progress_records_conflict_and_history(self):
        a=self.user('alice');b=self.user('bob')
        record=self.request('/api/play-records',dict(caseId='30',mode='application'),a)[1]
        value={'draft':{'answers':{'long':'11'},'evaluation':{'score':88}}}
        payload=dict(value=value,revision=0,seconds=0,ended=True)
        self.assertEqual(self.request('/api/play-records/'+record['id'],payload,a)[0],200)
        self.assertEqual(self.request('/api/play-records/'+record['id'],payload,b)[0],409)
        next_record=self.request('/api/play-records',dict(caseId='30',mode='application'),a)[1]
        self.assertEqual(next_record['value'],value)
        self.assertEqual(self.request('/api/play-records/'+next_record['id'],dict(value={'draft':{'evaluation':{'score':'<script>'}}},revision=1,seconds=0),a)[0],400)
        self.assertEqual(self.request('/api/play-records/'+next_record['id'],dict(value={'draft':{}},revision=0,seconds=0),a)[0],409)
        self.store.create_user('teacher','password123','admin')
        status,admin,cookie=self.request('/api/auth/login',dict(username='teacher',password='password123'));session=(cookie.split(';')[0],admin)
        self.assertEqual(self.request('/api/admin/play-records',session=session)[1]['total'],2)
        old=self.request('/api/admin/play-records/'+record['id'],session=session)[1]
        self.assertEqual(old['snapshot'],value)
        with self.store.db() as db:
            self.assertNotIn('password123',str([dict(r) for r in db.execute('SELECT * FROM users')]))

    def test_learning_progress_isolation_and_conflict(self):
        a=self.user('alice');b=self.user('bob')
        value={'answers':{'N13':'A'},'viewed':['normal']}
        self.assertEqual(self.request('/api/progress',dict(key='learning:v1',value=value,revision=0),a)[0],200)
        self.assertEqual(self.request('/api/progress?key=learning:v1',session=a)[1]['value'],value)
        self.assertIsNone(self.request('/api/progress?key=learning:v1',session=b)[1]['value'])
        self.assertEqual(self.request('/api/progress',dict(key='learning:v1',value={},revision=0),a)[0],409)

    def test_upload_and_cross_user_access(self):
        a=self.user('alice');b=self.user('bob')
        raw=bytearray(368);struct.pack_into('<i',raw,0,348);struct.pack_into('<8h',raw,40,3,2,2,2,1,1,1,1)
        struct.pack_into('<h',raw,70,4);struct.pack_into('<8f',raw,76,1,1,1,1,1,1,1,1);struct.pack_into('<f',raw,108,352);raw[344:348]=b'n+1\0'
        for data,name in [(bytes(raw),'scan.nii'),(gzip.compress(raw),'scan.nii.gz')]:
            status,out,_=self.request('/api/uploads',data,a,{'X-Filename':name});self.assertEqual(status,200,out)
            cid=out['id'];self.assertEqual(self.request('/api/cases/'+cid+'/meta',session=a)[1]['dims'],[2,2,2])
            self.assertEqual(self.request('/api/cases/'+cid+'/meta',session=b)[0],404)
            result=uploaded_cases.read(Path(self.tmp.name)/cid,cid,name)
            preview=submit(dict(caseId=cid,mode='application',anonymousSession='test',sliceIndex=0,polygons=[[[0,0],[1,0],[1,1]]]),lambda _:result)
            self.assertTrue(preview['passed']);self.assertIsNone(preview['score'])
        self.store.create_user('teacher','password123','admin')
        _,admin,cookie=self.request('/api/auth/login',dict(username='teacher',password='password123'));teacher=(cookie.split(';')[0],admin)
        record=self.request('/api/play-records',dict(caseId=cid,mode='application'),a)[1]
        payload=dict(sliceIndex=0,anonymousSession='test',polygons=[[[0,0],[1,0],[1,1]]])
        before=set(Path(self.tmp.name).iterdir())
        status,preview,_=self.request('/api/admin/play-records/'+record['id']+'/preview-grade',payload,teacher)
        self.assertEqual(status,200,preview);self.assertNotIn('submissionId',preview)
        self.assertEqual(set(Path(self.tmp.name).iterdir()),before)
        self.assertEqual(self.request('/api/admin/play-records/'+record['id']+'/preview-grade',payload,a)[0],403)
        self.assertEqual(self.request('/api/uploads',b'bad',a,{'X-Filename':'scan.nii'})[0],400)
        self.assertEqual(len(list(Path(self.tmp.name).glob('upload_*'))),2)

if __name__=='__main__':unittest.main()
