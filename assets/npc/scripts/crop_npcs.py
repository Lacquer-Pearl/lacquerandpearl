#!/usr/bin/env python3
"""Run from any directory. Pillow required. No pixel-color boundary detection."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def run(variant):
    config = json.loads((ROOT / 'crop_config.json').read_text())
    source = ROOT / config['sources'][variant]['path']
    if digest(source) != config['sources'][variant]['sha256']:
        raise ValueError('Source checksum mismatch; review grid before using another sheet')
    sheet = Image.open(source).convert('RGBA')
    if list(sheet.size) != config['source_size']:
        raise ValueError('Unexpected source dimensions')
    manifest = json.loads((ROOT / 'review/npcManifest.json').read_text())
    assert len(manifest['npcs']) == 40
    xs, ys = config['x_edges'], config['y_edges']
    assert xs[0] == ys[0] == 0 and xs[-1] == sheet.width and ys[-1] == sheet.height
    assert all(a < b for a,b in zip(xs,xs[1:])) and all(a < b for a,b in zip(ys,ys[1:]))
    target = ROOT if variant == 'corrected' else ROOT / 'alternate-uploaded'
    out = target / 'public/npc/portraits'
    out.mkdir(parents=True, exist_ok=True)
    canvas_size = tuple(config['canvas_size'])
    rebuilt = Image.new('RGBA', sheet.size)
    contact = Image.new('RGB', (8*216,5*252), '#ddd3c6')
    draw = ImageDraw.Draw(contact)
    seen = set()
    for npc in manifest['npcs']:
        r,c = npc['row']-1,npc['column']-1
        assert 0 <= r < 5 and 0 <= c < 8 and (r,c) not in seen
        seen.add((r,c))
        assert npc['id'] == f'npc_r{r+1:02}c{c+1:02}'
        assert npc['portrait'] == f"/npc/portraits/{npc['id']}.png"
        box = (xs[c],ys[r],xs[c+1],ys[r+1])
        cell = sheet.crop(box)
        offset = ((canvas_size[0]-cell.width)//2,(canvas_size[1]-cell.height)//2)
        assert min(offset) >= 4
        canvas = Image.new('RGBA', canvas_size)
        canvas.paste(cell, offset)
        path = out / (npc['id']+'.png')
        canvas.save(path)
        loaded = Image.open(path).convert('RGBA')
        recovered = loaded.crop((offset[0],offset[1],offset[0]+cell.width,offset[1]+cell.height))
        assert recovered.tobytes() == cell.tobytes()
        rebuilt.paste(recovered,box[:2])
        assert loaded.size == canvas_size
        named = target / 'named_portraits'
        named.mkdir(exist_ok=True)
        alias = f"{r*8+c+1:03}_{config['english_slugs'][npc['id']]}.png"
        shutil.copyfile(path, named / alias)
        npc['named_file'] = 'named_portraits/' + alias
        npc['name_en'] = config['english_names'][npc['id']]
        npc.update(number=r*8+c+1, crop_box=list(box), content_offset=list(offset),
                   output_size=list(canvas_size), sha256=digest(path))
        contact.paste(loaded,(c*216+4,r*252+4),loaded)
        draw.text((c*216+4,r*252+234),f"{r*8+c+1:03} {npc['id']}",fill='black')
    assert len(seen) == 40 and rebuilt.tobytes() == sheet.tobytes()
    manifest['source'] = config['sources'][variant]
    manifest['crop_method'] = 'Fixed manually reviewed grid boundaries, full cell retained, transparent outer padding; no resizing or color heuristics'
    dest = target / 'src/lib'; dest.mkdir(parents=True,exist_ok=True)
    (dest/'npcManifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    contact.save(target/'contact_sheet.jpg',quality=95)
    report = {'variant':variant,'count':40,'source_sha256':digest(source),'canvas_size':canvas_size,
              'all_cells_pixel_exact':True,'full_sheet_reconstruction_pixel_exact':True,
              'minimum_added_padding_px':4,'unique_ids_and_paths':True}
    (target/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--variant',choices=['corrected','uploaded','both'],default='both')
    args = parser.parse_args()
    for variant in (['corrected','uploaded'] if args.variant == 'both' else [args.variant]):
        run(variant)
