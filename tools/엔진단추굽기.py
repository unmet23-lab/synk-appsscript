"""Preserved 4K prototype. Final document badges use built-in Imagegen instead.
Run with Blender: blender -b --python-exit-code 1 -P tools/엔진단추굽기.py -- --px 4096 --number 1
No generated image is enlarged or used as a texture. Palette and typeface come from the brand kit.
"""
import bpy, math, random, sys, json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parent.parent
args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(name, default):
    return args[args.index(name)+1] if name in args else default
PX = int(arg('--px','4096'))
ONLY = arg('--number','all')
OUT = ROOT / 'docs' / '엔진' / '단추'
OUT.mkdir(parents=True,exist_ok=True)
kit = json.loads((ROOT/'docs/디자인_토큰.json').read_text(encoding='utf-8'))
colors = {v['이름']:v['hex'] for v in kit['색']['킷']}
def linear(hex):
    values=[int(hex[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values)+(1,)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.engine=arg('--engine','CYCLES')
scene.cycles.samples=24 if PX<4096 else 48
scene.cycles.use_denoising=True
scene.render.resolution_x=scene.render.resolution_y=PX
scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.image_settings.color_depth='8'
scene.view_settings.view_transform='Khronos PBR Neutral'
scene.view_settings.exposure=-.25
scene.world=bpy.data.worlds.new('softbox-world')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.65,.65,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35

def material(name,color,roughness=.82):
    mat=bpy.data.materials.new(name);mat.diffuse_color=linear(colors[color]);mat.use_nodes=True
    nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=mat.diffuse_color
    bs.inputs['Roughness'].default_value=roughness
    bs.inputs['Sheen Weight'].default_value=.35
    bs.inputs['Specular IOR Level'].default_value=.23
    noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=410
    noise.inputs['Detail'].default_value=3
    bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.16;bump.inputs['Distance'].default_value=.001
    nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],bs.inputs['Normal'])
    return mat
paper=material('Paper-wool','Paper');oat=material('Oat-wool','Oat')
ink=material('Ink-embroidered-thread','Ink',.65);seam=material('Stitch-thread','Stitch',.67)

def curves(name,paths,radius,mat):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=1
    data.bevel_depth=radius;data.bevel_resolution=2
    for coords in paths:
        s=data.splines.new('POLY');s.points.add(len(coords)-1)
        for p,c in zip(s.points,coords):p.co=(*c,1)
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.data.materials.append(mat)
    return ob

def disk(name,radius,depth,z,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=256,radius=radius,depth=depth,location=(0,0,z))
    ob=bpy.context.object;ob.name=name;ob.data.materials.append(mat)
    bevel=ob.modifiers.new('softly-tailored-edge','BEVEL');bevel.width=.045;bevel.segments=6
    ob.modifiers.new('weighted-normals','WEIGHTED_NORMAL')
    for p in ob.data.polygons:p.use_smooth=True
    return ob
disk('outer-wool-button',1,.13,0,oat)
disk('raised-felt-face',.858,.07,.082,paper)

# Actual surface fibers. They are 3D strands, independently shaded at output resolution.
random.seed(90409)
for label,rmin,rmax,z,mat,count in [('face',0,.823,.119,paper,48000),('rim',.875,.975,.067,oat,9500)]:
    paths=[]
    for _ in range(count):
        r=math.sqrt(random.uniform(rmin*rmin,rmax*rmax));a=random.uniform(0,math.tau)
        x,y=r*math.cos(a),r*math.sin(a);d=random.uniform(0,math.tau);length=random.uniform(.006,.020)
        paths.append([(x+math.cos(d)*length*(t-.5),y+math.sin(d)*length*(t-.5),z+.0006+math.sin(math.pi*t)*random.uniform(.0008,.003)) for t in (0,.25,.5,.75,1)])
    curves('individual-wool-fibers-'+label,paths,.00045,mat)

# Perimeter running stitch with fine twisted constituent threads.
paths=[]
for k in range(56):
    a=k*math.tau/56
    for strand in range(3):
        coords=[]
        for j in range(21):
            t=j/20;angle=a+(t-.5)*.076
            twist=t*math.tau*3+strand*math.tau/3
            radius=.918+.0015*math.cos(twist)
            coords.append((radius*math.cos(angle),radius*math.sin(angle),.071+.010*math.sin(math.pi*t)+.0015*math.sin(twist)))
        paths.append(coords)
curves('peach-running-stitch',paths,.00135,seam)

def light(name,xyz,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=xyz
    ob.rotation_euler=(Vector((0,0,0))-ob.location).to_track_quat('-Z','Y').to_euler()
light('large-soft-key',(-2.8,3.7,5),390,3.5)
light('quiet-fill',(3,-1,4),135,4)
camdata=bpy.data.cameras.new('orthographic');cam=bpy.data.objects.new('orthographic',camdata);scene.collection.objects.link(cam)
cam.location=(0,0,6);camdata.type='ORTHO';camdata.ortho_scale=2.20;scene.camera=cam

font=bpy.data.fonts.load(str(ROOT/'docs/브랜드_폰트/InterTight/InterTight-Bold.ttf'))
numbers=range(1,7) if ONLY=='all' else [int(ONLY)]
for number in numbers:
    bpy.ops.object.text_add(location=(0,0,.124))
    text=bpy.context.object;text.name='numerals-'+str(number)
    text.data.body=f'{number:02}';text.data.font=font;text.data.align_x='CENTER';text.data.align_y='CENTER'
    text.data.size=1.22;text.data.extrude=.008;text.data.bevel_depth=.004;text.data.bevel_resolution=3;text.data.resolution_u=24
    bpy.context.view_layer.update()
    # Optical centering from actual glyph bounds, not font advance metrics.
    local=[Vector(v) for v in text.bound_box]
    text.location.x=-.5*(min(v.x for v in local)+max(v.x for v in local))
    text.location.y=-.5*(min(v.y for v in local)+max(v.y for v in local))
    bpy.ops.object.convert(target='MESH');text=bpy.context.object;text.data.materials.append(ink)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    bpy.context.view_layer.update()
    tree=BVHTree.FromObject(text,bpy.context.evaluated_depsgraph_get())
    # Scan actual font geometry. Each connected span becomes one arched satin stitch.
    paths=[];y=-.46
    while y<=.46:
        spans=[];start=None;x=-.72
        while x<=.723:
            hit=tree.ray_cast(Vector((x,y,.4)),Vector((0,0,-1)),.4)[0]
            inside=hit is not None
            if inside and start is None:start=x
            if not inside and start is not None:spans.append((start,x-.0015));start=None
            x+=.0015
        for left,right in spans:
            if right-left<.003:continue
            # Three slender parallel fibers resolve the thread twist under macro viewing.
            for strand in range(3):
                coords=[]
                for j in range(17):
                    t=j/16;phase=t*math.tau*2+strand*math.tau/3
                    coords.append((left+(right-left)*t,y+.0011*math.sin(phase),.138+.009*math.sin(math.pi*t)+.0011*math.cos(phase)))
                paths.append(coords)
        y+=.0048
    stitching=curves('satin-stitches-'+str(number),paths,.00145,ink)
    filename=f'number-{number:02}-'+('4k' if PX==4096 else 'preview')+'.png'
    scene.render.filepath=str(OUT/filename)
    bpy.ops.render.render(write_still=True)
    if not (OUT/filename).exists():raise RuntimeError('Render not written')
    print('BADGE_RENDERED',number,PX,len(paths),flush=True)
    bpy.data.objects.remove(stitching,do_unlink=True);bpy.data.objects.remove(text,do_unlink=True)

(OUT/'prototype-production.json').write_text(json.dumps({'producer':'Codex / Blender original 3D','resolution':[PX,PX],'upscaled':False,'numbers':list(numbers),'palette':'docs/디자인_토큰.json','font':'InterTight-Bold.ttf'},ensure_ascii=False,indent=2),encoding='utf-8')
