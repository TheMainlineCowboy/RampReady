#!/usr/bin/env python3
import argparse, hashlib, json, struct
from io import BytesIO
from pathlib import Path
from PIL import Image

def align4(data):
    while len(data) % 4: data.append(0)

def identity(path):
    b=path.read_bytes(); return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}

def png_bytes(path):
    image=Image.open(path).convert('RGBA'); out=BytesIO(); image.save(out,format='PNG',compress_level=1); return out.getvalue(), image.size

def minmax(values,stride):
    rows=[values[i:i+stride] for i in range(0,len(values),stride)]
    return ([min(r[j] for r in rows) for j in range(stride)],[max(r[j] for r in rows) for j in range(stride)])

def stem_ref(value):
    return Path(value.replace('\\','/')).stem.lower()

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('obj'); ap.add_argument('day_dds'); ap.add_argument('lit_dds'); ap.add_argument('out'); args=ap.parse_args()
    obj=Path(args.obj); day=Path(args.day_dds); lit=None if args.lit_dds=='-' else Path(args.lit_dds); out=Path(args.out)
    lines=obj.read_bytes().decode('utf-8',errors='strict').splitlines()
    positions=[]; normals=[]; uvs=[]; indices=[]; draws=[]; point_counts=None; day_ref=None; lit_ref=None
    for line in lines:
        if not line: continue
        token=line.split(); head=token[0]
        if head=='POINT_COUNTS': point_counts=list(map(int,token[1:5]))
        elif head=='TEXTURE' and day_ref is None: day_ref=' '.join(token[1:])
        elif head=='TEXTURE_LIT' and lit_ref is None: lit_ref=' '.join(token[1:])
        elif head=='VT':
            v=list(map(float,token[1:9])); positions+=v[:3]; normals+=v[3:6]; uvs+=v[6:8]
        elif head=='IDX10': indices += list(map(int,token[1:]))
        elif head=='IDX': indices.append(int(token[1]))
        elif head=='TRIS': draws.append(tuple(map(int,token[1:3])))
    if point_counts is None: raise SystemExit('POINT_COUNTS missing')
    if len(positions)//3 != point_counts[0] or len(indices)!=point_counts[3]: raise SystemExit('authored point-count mismatch')
    if max(indices)>=len(positions)//3 or max(indices)>65535: raise SystemExit('index range unsupported')
    if sum(c for _,c in draws)!=len(indices): raise SystemExit('TRIS ranges do not cover index buffer')
    if not day_ref or stem_ref(day_ref)!=day.stem.lower(): raise SystemExit(f'day texture reference mismatch: {day_ref} vs {day.name}')
    if lit is None:
        if lit_ref: raise SystemExit(f'OBJ requires LIT texture {lit_ref}')
    elif not lit_ref or stem_ref(lit_ref)!=lit.stem.lower(): raise SystemExit(f'LIT texture reference mismatch: {lit_ref} vs {lit.name}')
    day_png,day_size=png_bytes(day); lit_png=lit_size=None
    if lit is not None: lit_png,lit_size=png_bytes(lit)
    binary=bytearray(); views=[]
    def add(payload,target=None):
        align4(binary); off=len(binary); binary.extend(payload); view={'buffer':0,'byteOffset':off,'byteLength':len(payload)}
        if target: view['target']=target
        views.append(view); return len(views)-1
    def pack_f32(v): return struct.pack(f'<{len(v)}f',*v)
    def pack_u16(v): return struct.pack(f'<{len(v)}H',*v)
    pos_view=add(pack_f32(positions),34962); normal_view=add(pack_f32(normals),34962); uv_view=add(pack_f32(uvs),34962); idx_view=add(pack_u16(indices),34963); day_view=add(day_png); lit_view=add(lit_png) if lit_png is not None else None
    pmin,pmax=minmax(positions,3); nmin,nmax=minmax(normals,3); umin,umax=minmax(uvs,2)
    accessors=[
      {'bufferView':pos_view,'componentType':5126,'count':len(positions)//3,'type':'VEC3','min':pmin,'max':pmax},
      {'bufferView':normal_view,'componentType':5126,'count':len(normals)//3,'type':'VEC3','min':nmin,'max':nmax},
      {'bufferView':uv_view,'componentType':5126,'count':len(uvs)//2,'type':'VEC2','min':umin,'max':umax},
      {'bufferView':idx_view,'componentType':5123,'count':len(indices),'type':'SCALAR','min':[min(indices)],'max':[max(indices)]},
    ]
    material={'name':'xplane-authored','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0.0,'roughnessFactor':1.0},'doubleSided':False,'alphaMode':'MASK','alphaCutoff':0.5}
    textures=[{'source':0}]; images=[{'bufferView':day_view,'mimeType':'image/png','name':day.stem}]
    source={'obj':identity(obj),'dayTexture':identity(day)}; decoded=[day_size]
    if lit is not None:
        material['emissiveTexture']={'index':1}; material['emissiveFactor']=[1,1,1]
        textures.append({'source':1}); images.append({'bufferView':lit_view,'mimeType':'image/png','name':lit.stem}); source['litTexture']=identity(lit); decoded.append(lit_size)
    gltf={
      'asset':{'version':'2.0','generator':'RampReady exact X-Plane OBJ8 importer v2'},'scene':0,'scenes':[{'nodes':[0]}],
      'nodes':[{'mesh':0,'name':obj.stem}],'meshes':[{'name':obj.stem,'primitives':[{'attributes':{'POSITION':0,'NORMAL':1,'TEXCOORD_0':2},'indices':3,'material':0,'mode':4}]}],
      'materials':[material],'textures':textures,'images':images,'accessors':accessors,'bufferViews':views,'buffers':[{'byteLength':len(binary)}],
      'extras':{'sourceAuthority':'exact-kphx-xplane-obj8','source':source,'pointCounts':point_counts,'drawRanges':draws,'decodedTextureSizes':decoded,'sourceTextureRefs':{'day':day_ref,'lit':lit_ref}}
    }
    jc=json.dumps(gltf,separators=(',',':')).encode(); jc += b' '*((4-len(jc)%4)%4); align4(binary)
    total=12+8+len(jc)+8+len(binary); glb=bytearray(b'glTF'+struct.pack('<II',2,total)+struct.pack('<II',len(jc),0x4E4F534A)+jc+struct.pack('<II',len(binary),0x004E4942)+binary)
    out.parent.mkdir(parents=True,exist_ok=True); out.write_bytes(glb)
    print(json.dumps({'out':str(out),'bytes':len(glb),'sha256':hashlib.sha256(glb).hexdigest(),'vertices':len(positions)//3,'indices':len(indices),'drawRanges':len(draws),'textures':len(images)},indent=2))
if __name__=='__main__': main()
