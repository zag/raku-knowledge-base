#!/bin/bash
# Refresh zef module data: index -> dedup -> tarballs -> parse.
# Resumable: existing module dirs are skipped; rerun after a network failure.
set -eu
cd "$(dirname "$0")/.."

mkdir -p built work_mods/zef

echo "[1/5] zef index"
curl -s -m 120 -o built/zef-mods.json https://360.zef.pm/

echo "[2/5] dedup -> built/mods.json"
python3 - <<'PY'
import json, re

def vkey(e):
    v = str(e.get('version', ''))
    parts = re.findall(r'\d+', v)
    return [int(p) for p in parts[:6]]

mods = {}
for e in json.load(open('built/zef-mods.json')):
    name = e.get('name')
    if not name or not e.get('path'):
        continue
    cur = mods.get(name)
    if cur is None or vkey(e) >= vkey(cur):
        mods[name] = e
out = sorted(mods.values(), key=lambda e: e['name'])
json.dump(out, open('built/mods.json', 'w'), indent=1, ensure_ascii=False)
print('modules:', len(out))
PY

echo "[3/5] tarballs (parallel, skip existing)"
python3 - <<'PY'
import io, json, os, tarfile, urllib.request
from concurrent.futures import ThreadPoolExecutor

base = 'work_mods/zef'
os.makedirs(base, exist_ok=True)

def fetch(entry):
    name = entry['name'].replace('/', '_')
    dest = os.path.join(base, name)
    if os.path.isdir(dest) and os.listdir(dest):
        return 'skip'
    try:
        with urllib.request.urlopen('https://360.zef.pm/' + entry['path'], timeout=60) as r:
            data = r.read()
        os.makedirs(dest, exist_ok=True)
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as t:
            t.extractall(dest, filter='data')
        return 'ok'
    except Exception:
        try:
            os.rmdir(dest)
        except OSError:
            pass
        return 'fail'

mods = json.load(open('built/mods.json'))
with ThreadPoolExecutor(max_workers=8) as ex:
    results = list(ex.map(fetch, mods))
print('ok:', results.count('ok'), '| skip:', results.count('skip'), '| fail:', results.count('fail'))

import shutil
known = {e['name'].replace('/', '_') for e in mods}
removed = 0
for d in os.listdir(base):
    if d not in known:
        shutil.rmtree(os.path.join(base, d), ignore_errors=True)
        removed += 1
print('removed stale zef dirs:', removed)
PY

echo "downloaded: $(ls work_mods/zef | wc -l | tr -d ' ') dirs"

echo "[4/5] p6c ecosystem: META.list -> ecosystem.json + clone/pull work_mods/all"
python3 - <<'PY'
import json, os, subprocess, urllib.request
from concurrent.futures import ThreadPoolExecutor

LIST_URL = 'https://raw.githubusercontent.com/Raku/ecosystem/master/META.list'
urls = [u for u in urllib.request.urlopen(LIST_URL, timeout=60).read().decode().split() if u.strip()]

def fetch_meta(u):
    try:
        return json.loads(urllib.request.urlopen(u, timeout=30).read().decode('utf-8', 'replace'))
    except Exception:
        return None

with ThreadPoolExecutor(max_workers=8) as ex:
    metas = [m for m in ex.map(fetch_meta, urls) if m and m.get('name')]
json.dump(metas, open('built/ecosystem.json', 'w'), indent=1, ensure_ascii=False)
print('ecosystem.json:', len(metas), 'of', len(urls), 'metas')

base = 'work_mods/all'
os.makedirs(base, exist_ok=True)

# github turned off the git:// protocol in 2022, and ssh needs a key no build machine has
def to_https(src):
    if src.startswith('git://'):
        return 'https://' + src[len('git://'):]
    if src.startswith('git@') and ':' in src:
        host, path = src[len('git@'):].split(':', 1)
        return f'https://{host}/{path}'
    return src

def sync_repo(m):
    src = m.get('source-url') or (m.get('support') or {}).get('source')
    if not src:
        return 'nosrc'
    src = to_https(src)
    dest = os.path.join(base, m['name'].replace('/', '_'))
    try:
        if os.path.isdir(os.path.join(dest, '.git')):
            r = subprocess.run(['git', '-C', dest, 'pull', '-q', '--ff-only'], timeout=120,
                               capture_output=True)
            return 'pull' if r.returncode == 0 else 'pullfail'
        r = subprocess.run(['git', 'clone', '-q', '--depth', '1', src, dest], timeout=180,
                           capture_output=True)
        return 'clone' if r.returncode == 0 else 'clonefail'
    except Exception:
        return 'timeout'

with ThreadPoolExecutor(max_workers=8) as ex:
    results = list(ex.map(sync_repo, metas))
from collections import Counter
counts = Counter(results)
print('repos:', dict(counts))

# a third of the sources once vanished while the run still reported success.
# a failed pull is not that case: the checkout stays, it is merely stale.
missing = counts['clonefail'] + counts['timeout']
stale = counts['pullfail']
total = len(results)
if stale:
    print(f'note: {stale} checkouts could not be updated and stay at their previous state')
if total and missing / total > 0.05:
    raise SystemExit(f'ERROR: {missing} of {total} module sources have no checkout at all ({missing*100//total}%) — refusing to build a corpus this incomplete')

import shutil
known = {m['name'].replace('/', '_') for m in metas}
removed = 0
for d in os.listdir(base):
    if d not in known:
        shutil.rmtree(os.path.join(base, d), ignore_errors=True)
        removed += 1
print('removed stale p6c dirs:', removed)
PY

echo "[5/5] parse -> built/mods-tree.json"
node ./bin/pick-module-docs.mjs work_mods > ./built/mods-files.txt
node ./bin/parsesrc.mjs @./built/mods-files.txt > ./built/mods-tree.json

echo "done: $(du -h built/mods-tree.json | cut -f1) mods-tree.json"
