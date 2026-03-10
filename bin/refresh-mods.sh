#!/bin/bash
# Refresh zef module data: index -> dedup -> tarballs -> parse.
# Resumable: existing module dirs are skipped; rerun after a network failure.
set -eu
cd "$(dirname "$0")/.."

mkdir -p built work_mods/zef

echo "[1/4] zef index"
curl -s -m 120 -o built/zef-mods.json https://360.zef.pm/

echo "[2/4] dedup -> built/mods.json"
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

echo "[3/4] tarballs (parallel, skip existing)"
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
PY

echo "downloaded: $(ls work_mods/zef | wc -l | tr -d ' ') dirs"

echo "[4/4] parse -> built/mods-tree.json"
node ./bin/parsesrc.mjs 'work_mods/**/*.{pod6,md,rakudoc,rakumod,raku,pm6,pl,pm,p6}' > ./built/mods-tree.json

echo "done: $(du -h built/mods-tree.json | cut -f1) mods-tree.json"
