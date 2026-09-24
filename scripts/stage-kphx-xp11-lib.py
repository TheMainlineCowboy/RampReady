#!/usr/bin/env python3
import hashlib, json, os, re, shutil, sys
from pathlib import Path

if len(sys.argv) != 6:
    raise SystemExit("usage: stage-kphx-xp11-lib.py <xp11-root> <audit.json> <directory.txt> <out> <extensions-csv>")

xp=Path(sys.argv[1]).resolve()
audit=Path(sys.argv[2]).resolve()
directory=Path(sys.argv[3]).resolve()
out=Path(sys.argv[4]).resolve()
exts={e.strip().lower() for e in sys.argv[5].split(",") if e.strip()}
BUILD=115501
EXTRAS={"lib/g10/decals/grass_and_stony_dirt_1.dcl","lib/g10/decals/low_freq_mod_1.dcl"}

def norm(s): return s.replace("\\","/")

def md5(path):
    h=hashlib.md5()
    with open(path,"rb") as f:
        for b in iter(lambda:f.read(1024*1024),b""): h.update(b)
    return h.hexdigest()

# Pinned X-Plane 11.55r2 / build 115501 manifest authority.
manifest={}
cur=""
for raw in directory.read_text(errors="replace").splitlines():
    if raw.startswith("DIR "):
        cur=raw[4:].strip()
    elif raw.startswith("FILE "):
        p=raw.split(" ",10)
        if len(p)<11: continue
        try: ver=int(p[2])
        except: continue
        if ver>BUILD: continue
        full=norm(cur+p[10])
        prev=manifest.get(full)
        if prev is None or ver>=prev["version"]:
            manifest[full]={"version":ver,"md5":p[9],"raw":raw}

data=json.loads(audit.read_text())
requested=set(data["unresolved"]["lib"]["resources"])
requested|=EXTRAS
requested={r for r in requested if Path(r).suffix.lower() in exts}
if not requested:
    raise RuntimeError("no requested resources selected")

# Resolve virtual lib paths through the installed exact library.txt files.
exports={r:[] for r in requested}
for lib in (xp/"Resources"/"default scenery").rglob("library.txt"):
    base=lib.parent
    regions=[]
    for lineno,raw in enumerate(lib.read_text(errors="replace").splitlines(),1):
        line=raw.strip()
        if not line or line.startswith("#"): continue
        p=line.split()
        if not p: continue
        if p[0] in {"REGION_DEFINE","REGION_BITMAP","REGION_RECT","REGION_DREF"}: continue
        if p[0]=="REGION":
            regions=p[1:]; continue
        if p[0] in {"EXPORT","EXPORT_BACKUP","EXPORT_EXTEND"} and len(p)>=3:
            virtual=p[1]; physical=" ".join(p[2:])
        elif p[0]=="EXPORT_RATIO" and len(p)>=4:
            virtual=p[2]; physical=" ".join(p[3:])
        else:
            continue
        if virtual in exports:
            exports[virtual].append({
                "physical":str((base/physical).resolve()),
                "library":str(lib),
                "line":lineno,
                "regions":regions[:],
                "directive":p[0],
            })

resolved={}
missing=[]
ambiguous={}
for virtual,cands in exports.items():
    existing=[c for c in cands if Path(c["physical"]).is_file()]
    if not existing:
        missing.append(virtual); continue
    preferred=[c for c in existing if not c["regions"]]
    pool=preferred or existing
    uniq={str(Path(c["physical"]).resolve()):c for c in pool}
    if len(uniq)!=1:
        ambiguous[virtual]=pool; continue
    resolved[virtual]=next(iter(uniq.values()))

if missing or ambiguous:
    raise RuntimeError(f"resolve failed missing={len(missing)} ambiguous={len(ambiguous)}")

xp_prefix=str(xp)+os.sep
copied={}
queue=[Path(v["physical"]) for v in resolved.values()]
seen=set()

TEXT_EXT={".obj",".fac",".lin",".pol",".str",".agp",".for",".net",".dcl",".ter",".txt"}

def relxp(p):
    rp=str(p.resolve())
    if not rp.startswith(xp_prefix):
        raise RuntimeError(f"dependency outside XP tree: {p}")
    return norm(os.path.relpath(rp,xp))

def candidate_refs(path):
    if path.suffix.lower() not in TEXT_EXT: return []
    refs=[]
    parent=path.parent
    for raw in path.read_text(errors="replace").splitlines():
        line=raw.split("#",1)[0].strip()
        if not line: continue
        toks=line.split()
        if not toks: continue
        cmd=toks[0]
        vals=[]
        if cmd in {"TEXTURE","TEXTURE_LIT","TEXTURE_DRAPED","WEATHER"} and len(toks)>=2:
            vals=[" ".join(toks[1:])]
        elif cmd in {"TEXTURE_NORMAL","TEXTURE_DRAPED_NORMAL"} and len(toks)>=2:
            start=2 if len(toks)>=3 and re.fullmatch(r"[-+0-9.eE]+",toks[1]) else 1
            vals=[" ".join(toks[start:])]
        elif cmd=="DECAL_LIB" and len(toks)>=2:
            # DECAL_LIB is a virtual lib path; resolve from installed libraries if requested or physically mapped nearby.
            vals=[]
        elif cmd in {"OBJ","OBJECT","OBJECT_DRAPED","FACADE","FOREST","RESOURCE","TERRAIN","BEACH","LINE","POLYGON"} and len(toks)>=2:
            vals=[" ".join(toks[1:])]
        for v in vals:
            v=v.strip().strip('"')
            if not v or v.startswith("lib/"): continue
            p=(parent/v).resolve()
            if p.is_file(): refs.append(p)
    return refs

while queue:
    p=queue.pop()
    rp=str(p.resolve())
    if rp in seen: continue
    seen.add(rp)
    if not p.is_file(): raise RuntimeError(f"missing dependency {p}")
    rel=relxp(p)
    authority=manifest.get(rel)
    if not authority:
        raise RuntimeError(f"file not in pinned 11.55r2 manifest: {rel}")
    actual=md5(p)
    if actual.lower()!=authority["md5"].lower():
        raise RuntimeError(f"MD5 mismatch {rel}: {actual} != {authority['md5']}")
    dest=out/rel
    dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(p,dest)
    copied[rel]={"md5":actual,"bytes":p.stat().st_size,"manifestVersion":authority["version"]}
    queue.extend(candidate_refs(p))

report={
    "build":BUILD,
    "extensions":sorted(exts),
    "requestedVirtualCount":len(requested),
    "resolvedVirtualCount":len(resolved),
    "copiedPhysicalFileCount":len(copied),
    "requested":sorted(requested),
    "mappings":resolved,
    "copied":copied,
}
out.mkdir(parents=True,exist_ok=True)
(out/"kphx-xp11-lib-chunk-manifest.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps({
    "requestedVirtualCount":len(requested),
    "resolvedVirtualCount":len(resolved),
    "copiedPhysicalFileCount":len(copied),
    "extensions":sorted(exts)
},indent=2))
