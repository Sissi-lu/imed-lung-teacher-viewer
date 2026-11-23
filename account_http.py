"""Authentication and account API mixin for the existing HTTP handler."""
import hashlib
import json
import re
import secrets
import shutil
from http.cookies import SimpleCookie
from urllib.parse import parse_qs, urlsplit, unquote
from account_store import ApiError
import uploaded_cases


class AccountHandler:
    def end_headers(self):
        if getattr(self, '_cookie', None):
            self.send_header('Set-Cookie',self._cookie)
            self._cookie=None
        super().end_headers()

    def authorize(self, write=False):
        cookie=SimpleCookie()
        try:
            cookie.load(self.headers.get('Cookie',''))
            self.token=cookie['lung_session'].value if 'lung_session' in cookie else ''
            self.user=self.store.session(self.token)
        except (KeyError,ValueError):
            raise ApiError('请先登录',401)
        if write and self.headers.get('X-CSRF-Token')!=self.user['csrf']:
            raise ApiError('无效请求，请刷新页面',403)

    def body(self):
        size=int(self.headers.get('Content-Length','0'))
        if not 0<size<=8*1024*1024:
            raise ApiError('请求体大小无效',413)
        data=json.loads(self.rfile.read(size))
        if not isinstance(data,dict):
            raise ApiError('请求必须为对象')
        return data

    def load_case(self,cid):
        if cid.startswith('upload_'):
            row=self.store.resource(cid,self.user,'upload')
            return uploaded_cases.read(self.store.root/cid,cid,row['name'])
        return self.clinical_load(cid)

    def do_GET(self):
        path=urlsplit(self.path).path
        try:
            if path.startswith('/api/'):
                self.authorize()
            if path=='/api/auth/me':
                return self.send_json(self.user)
            if path=='/api/progress':
                key=parse_qs(urlsplit(self.path).query).get('key',[''])[0]
                return self.send_json(self.store.get_progress(self.user,key))
            if path=='/api/admin/play-records':
                q=parse_qs(urlsplit(self.path).query)
                return self.send_json(self.store.records(self.user,q.get('q',[''])[0],int(q.get('page',['0'])[0])))
            match=re.fullmatch('/api/admin/play-records/([0-9a-f]{32})',path)
            if match:
                return self.send_json(self.store.record(self.user,match[1]))
            archive=re.fullmatch('/api/practice/submissions/([^/]+)/download',path)
            if archive:
                self.store.resource(archive[1],self.user,'submission')
            return super().do_GET()
        except ApiError as ex:
            self.send_json({'error':str(ex)},ex.status)
        except (ValueError,KeyError) as ex:
            self.send_json({'error':str(ex)},400)

    def do_POST(self):
        path=urlsplit(self.path).path
        try:
            if path in ('/api/auth/register','/api/auth/login'):
                # A custom request header forces cross-origin callers through preflight.
                if self.headers.get('X-Lung-Request')!='1':
                    raise ApiError('无效登录请求',403)
                data=self.body()
                if path.endswith('register'):
                    self.store.create_user(data.get('username',''),data.get('password',''))
                token=self.store.login(data.get('username',''),data.get('password',''))
                self._cookie='lung_session='+token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800'+('; Secure' if self.secure_cookie else '')
                return self.send_json(self.store.session(token))
            self.authorize(True)
            if path=='/api/auth/logout':
                with self.store.db() as db:
                    db.execute('DELETE FROM sessions WHERE token=?',(hashlib.sha256(self.token.encode()).hexdigest(),))
                self._cookie='lung_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
                return self.send_json({'ok':True})
            if path=='/api/uploads':
                return self.upload()
            if path=='/api/progress':
                data=self.body()
                if not str(data.get('key','')).startswith('learning:'):
                    raise ApiError('无效进度类型')
                with self.store.db() as db:
                    db.execute('BEGIN IMMEDIATE')
                    revision=self.store.put_progress(db,self.user,data['key'],data['value'],data['revision'])
                return self.send_json({'revision':revision})
            if path=='/api/play-records':
                data=self.body(); cid=str(data['caseId']); result=self.load_case(cid)
                return self.send_json(self.store.start(self.user,cid,result['meta'].get('caseName','病例 '+cid),data['mode']))
            match=re.fullmatch('/api/play-records/([0-9a-f]{32})',path)
            if match:
                return self.send_json(self.store.save_record(self.user,match[1],self.body()))
            match=re.fullmatch('/api/admin/play-records/([0-9a-f]{32})/preview-grade',path)
            if match:
                record=self.store.record(self.user,match[1]); data=self.body()
                data['caseId']=record['case_id']; data['mode']=record['mode']
                return self.send_json(self.grade_preview(data,self.load_case))
            match=re.fullmatch('/api/sam/sessions/([0-9a-f]{32})/predict',path)
            if match:
                self.store.resource(match[1],self.user,'sam')
            return super().do_POST()
        except ApiError as ex:
            self.close_connection=True
            self.send_json({'error':str(ex)},ex.status)
        except (ValueError,KeyError,TypeError,OSError) as ex:
            self.close_connection=True
            self.send_json({'error':str(ex)},400)

    def do_DELETE(self):
        try:
            self.authorize(True)
            match=re.fullmatch('/api/sam/sessions/([0-9a-f]{32})',urlsplit(self.path).path)
            if match:
                self.store.resource(match[1],self.user,'sam')
            return super().do_DELETE()
        except ApiError as ex:
            self.send_json({'error':str(ex)},ex.status)

    def upload(self):
        size=int(self.headers.get('Content-Length','0'))
        name=unquote(self.headers.get('X-Filename','')).replace('\\','/').split('/')[-1][:200]
        if not name.lower().endswith(('.nii','.nii.gz')) or not 0<size<=uploaded_cases.MAX_UPLOAD:
            raise ApiError('请选择不超过512 MiB的 .nii 或 .nii.gz 文件',413)
        if shutil.disk_usage(self.store.root).free<size*3+1024**3:
            raise ApiError('存储空间不足，请联系管理员',507)
        cid='upload_'+secrets.token_hex(16); target=self.store.root/cid
        try:
            with target.open('xb') as f:
                remaining=size
                while remaining:
                    chunk=self.rfile.read(min(1024*1024,remaining))
                    if not chunk:
                        raise ApiError('上传中断')
                    f.write(chunk); remaining-=len(chunk)
            uploaded_cases.read(target,cid,name)
            self.store.own_resource(cid,self.user,'upload',name)
        except Exception:
            target.unlink(missing_ok=True)
            raise
        return self.send_json({'id':cid,'name':name})
