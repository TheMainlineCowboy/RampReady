#!/usr/bin/env python3
import argparse, hashlib, json, xml.etree.ElementTree as ET
from pathlib import Path

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('wed'); ap.add_argument('out'); args=ap.parse_args()
    source=Path(args.wed); out=Path(args.out); raw=source.read_bytes()
    root=ET.fromstring(raw)
    placements=[]
    for obj in root.iter('object'):
        if obj.attrib.get('class') != 'WED_ObjPlacement':
            continue
        placement=obj.find('obj_placement'); point=obj.find('point'); hierarchy=obj.find('hierarchy')
        if placement is None or point is None:
            continue
        placements.append({
            'sourceOrder': len(placements),
            'wedObjectId': int(obj.attrib['id']),
            'parentId': int(obj.attrib['parent_id']) if obj.attrib.get('parent_id') else None,
            'name': hierarchy.attrib.get('name','') if hierarchy is not None else '',
            'resource': placement.attrib.get('resource',''),
            'showLevel': placement.attrib.get('show_level',''),
            'customMsl': placement.attrib.get('custom_msl',''),
            'msl': placement.attrib.get('msl',''),
            'latitude': point.attrib.get('latitude',''),
            'longitude': point.attrib.get('longitude',''),
            'heading': point.attrib.get('heading',''),
        })
    payload={
        'schemaVersion':1,
        'authority':'KPHX-1.75.1-earth.wed.xml',
        'source':{'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()},
        'objectPlacementCount':len(placements),
        'uniqueResourceCount':len({p['resource'] for p in placements}),
        'placements':placements,
    }
    encoded=(json.dumps(payload,indent=2,ensure_ascii=False)+'\n').encode('utf-8')
    out.parent.mkdir(parents=True,exist_ok=True); out.write_bytes(encoded)
    print(json.dumps({'out':str(out),'bytes':len(encoded),'sha256':hashlib.sha256(encoded).hexdigest(),'placements':len(placements),'uniqueResources':payload['uniqueResourceCount']},indent=2))
if __name__=='__main__': main()
