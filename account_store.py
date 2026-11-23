"""Account state and immutable-per-visit snapshots, separate from clinical data."""
from contextlib import contextmanager
import hashlib
import hmac
import json
import math
import secrets
import sqlite3
import time
from pathlib import Path

DEFAULT_ROOT = '/data_new/moyancheng/experiments/imed-lung-teacher-viewer/account_data'


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


class Store:
    def __init__(self, root):
        self.root = Path(root)
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        with self.db() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT UNIQUE, salt TEXT, password TEXT, role TEXT);
            CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT, csrf TEXT, expires REAL);
            CREATE TABLE IF NOT EXISTS progress(user_id TEXT, key TEXT, value TEXT, revision INTEGER, PRIMARY KEY(user_id,key));
            CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, user_id TEXT, case_id TEXT, name TEXT, mode TEXT, started REAL, seconds REAL DEFAULT 0, snapshot TEXT, revision INTEGER DEFAULT 0, ended INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS resources(id TEXT PRIMARY KEY, user_id TEXT, kind TEXT, name TEXT);
            ''')

    @contextmanager
    def db(self):
        db = sqlite3.connect(self.root / 'state.sqlite3', timeout=30)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def create_user(self, username, password, role='user'):
        username = str(username).strip()
        if not 2 <= len(username) <= 32 or not all(c.isalnum() or c in '_-' for c in username):
            raise ApiError('用户名须为2–32位文字、数字、下划线或短横线')
        if not isinstance(password, str) or not 8 <= len(password) <= 128:
            raise ApiError('密码长度须为8–128位')
        salt = secrets.token_hex(16)
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
        user = dict(id=secrets.token_hex(16), username=username, role=role)
        try:
            with self.db() as db:
                db.execute('INSERT INTO users VALUES(?,?,?,?,?)', (user['id'], username, salt, digest, role))
        except sqlite3.IntegrityError:
            raise ApiError('用户名已存在', 409)
        return user

    def login(self, username, password):
        with self.db() as db:
            row = db.execute('SELECT * FROM users WHERE username=?', (str(username).strip(),)).fetchone()
            salt = bytes.fromhex(row['salt']) if row else b'unknown-user-salt'
            digest = hashlib.scrypt(str(password).encode(), salt=salt, n=16384, r=8, p=1).hex()
            if not row or not hmac.compare_digest(digest, row['password']):
                raise ApiError('用户名或密码错误', 401)
            token, csrf = secrets.token_hex(32), secrets.token_hex(24)
            db.execute('DELETE FROM sessions WHERE expires<?', (time.time(),))
            db.execute('INSERT INTO sessions VALUES(?,?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), row['id'], csrf, time.time()+7*86400))
        return token

    def session(self, token):
        with self.db() as db:
            row = db.execute('SELECT users.id,username,role,csrf FROM sessions JOIN users ON users.id=user_id WHERE token=? AND expires>?',
                             (hashlib.sha256(token.encode()).hexdigest(), time.time())).fetchone()
        if not row:
            raise ApiError('请先登录', 401)
        return dict(row)

    def resource(self, rid, user, kind):
        with self.db() as db:
            row = db.execute('SELECT * FROM resources WHERE id=? AND kind=?', (rid, kind)).fetchone()
        if not row or (row['user_id'] != user['id'] and user['role'] != 'admin'):
            raise ApiError('资源不存在或无权访问', 404)
        return dict(row)

    def own_resource(self, rid, user, kind, name=''):
        with self.db() as db:
            db.execute('INSERT OR REPLACE INTO resources VALUES(?,?,?,?)', (rid, user['id'], kind, name))

    def get_progress(self, user, key):
        with self.db() as db:
            row = db.execute('SELECT value,revision FROM progress WHERE user_id=? AND key=?', (user['id'], key)).fetchone()
        return dict(value=json.loads(row['value']), revision=row['revision']) if row else dict(value=None, revision=0)

    def put_progress(self, db, user, key, value, revision):
        if not isinstance(value,dict):
            raise ApiError('无效进度格式')
        row = db.execute('SELECT revision FROM progress WHERE user_id=? AND key=?', (user['id'], key)).fetchone()
        if (row['revision'] if row else 0) != revision:
            raise ApiError('另一个窗口已更新进度，请重新加载后继续；当前修改仍保留在本页', 409)
        db.execute('INSERT OR REPLACE INTO progress VALUES(?,?,?,?)', (user['id'], key, json.dumps(value, ensure_ascii=False), revision+1))
        return revision+1

    def start(self, user, cid, name, mode):
        if mode not in ('learning', 'application', 'innovation'):
            raise ApiError('无效练习难度')
        key = 'case:'+cid+':'+mode
        progress = self.get_progress(user, key)
        rid = secrets.token_hex(16)
        with self.db() as db:
            db.execute('INSERT INTO records(id,user_id,case_id,name,mode,started,snapshot) VALUES(?,?,?,?,?,?,?)',
                       (rid,user['id'],cid,name,mode,time.time(),json.dumps(progress['value'])))
        return dict(id=rid, **progress)

    def save_record(self, user, rid, data):
        with self.db() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM records WHERE id=? AND user_id=?', (rid,user['id'])).fetchone()
            if not row or row['ended']:
                raise ApiError('游玩记录已结束或不存在', 409)
            seconds = float(data.get('seconds', row['seconds']))
            if not 0 <= seconds <= time.time()-row['started']+2:
                raise ApiError('无效游玩时长')
            revision = data.get('revision')
            if 'value' in data:
                value=data['value']
                if not isinstance(value,dict) or not isinstance(value.get('draft'),dict) or not isinstance(value.get('view',{}),dict):
                    raise ApiError('无效病例快照')
                draft=value['draft']
                if any(not isinstance(draft.get(k,{}),dict) for k in ('answers','localization','practice','evaluation')) or any(not isinstance(draft.get(k,''),str) for k in ('findings','diagnosis')):
                    raise ApiError('无效作业格式')
                attempts=draft.get('localization',{}).get('attempts',0)
                if type(attempts) is not int or attempts<0:
                    raise ApiError('无效定位次数')
                evaluation=draft.get('evaluation',{})
                for key in ('score','reportScore','reportMax','localizationScore','complete','matched'):
                    number=evaluation.get(key)
                    if number is not None and (type(number) not in (int,float) or not math.isfinite(number) or not 0<=number<=100):
                        raise ApiError('无效评估数据')
                if 'comparisons' in evaluation and (not isinstance(evaluation['comparisons'],list) or any(not isinstance(c,dict) for c in evaluation['comparisons'])):
                    raise ApiError('无效比较数据')
                revision = self.put_progress(db,user,'case:'+row['case_id']+':'+row['mode'],data['value'],revision)
                db.execute('UPDATE records SET snapshot=?,revision=? WHERE id=?', (json.dumps(data['value']),revision,rid))
            db.execute('UPDATE records SET seconds=max(seconds,?),ended=? WHERE id=?', (seconds,int(bool(data.get('ended'))),rid))
        return dict(revision=revision)

    def records(self, user, query='', page=0):
        if user['role'] != 'admin':
            raise ApiError('需要管理员身份',403)
        where = " FROM records r JOIN users u ON r.user_id=u.id WHERE u.id<>? AND (u.username LIKE ? OR r.name LIKE ?)"
        values = (user['id'],'%'+query+'%','%'+query+'%')
        with self.db() as db:
            total = db.execute('SELECT count(*)'+where,values).fetchone()[0]
            rows = db.execute('SELECT r.*,u.username'+where+' ORDER BY started DESC LIMIT 25 OFFSET ?',(*values,max(0,page)*25)).fetchall()
        return dict(total=total,records=[{**{k:r[k] for k in r.keys() if k!='snapshot'},'score':(json.loads(r['snapshot']) or {}).get('draft',{}).get('evaluation',{}).get('score') if (json.loads(r['snapshot']) or {}).get('draft',{}).get('submitted') else None} for r in rows])

    def record(self, user, rid):
        if user['role'] != 'admin':
            raise ApiError('需要管理员身份',403)
        with self.db() as db:
            row = db.execute('SELECT r.*,u.username FROM records r JOIN users u ON u.id=r.user_id WHERE r.id=?', (rid,)).fetchone()
        if not row:
            raise ApiError('记录不存在',404)
        return {**dict(row),'snapshot':json.loads(row['snapshot'])}


if __name__ == '__main__':
    import argparse
    import getpass
    parser = argparse.ArgumentParser(description='创建管理员账号（不会覆盖已有账号）')
    parser.add_argument('--user-data-root', default=DEFAULT_ROOT)
    parser.add_argument('--username', required=True)
    args = parser.parse_args()
    password = getpass.getpass('管理员密码: ')
    if password != getpass.getpass('再次输入: '):
        parser.error('两次密码不同')
    try:
        print(Store(args.user_data_root).create_user(args.username,password,'admin')['username'], '已创建')
    except ApiError as ex:
        parser.error(str(ex))
