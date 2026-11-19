import argparse
from array import array
from bisect import bisect_right
from dataclasses import dataclass
import math
from pathlib import Path
import random
import sys
from tempfile import TemporaryDirectory
import time

import bpy
from mathutils import Matrix, Quaternion, Vector, noise


FILLET = 0.26
CORE = 1.0 - FILLET
SIDE = 2.0 * CORE
FACE_AREA = 6.0 * SIDE**2
EDGE_AREA = 6.0 * math.pi * SIDE * FILLET
CORNER_AREA = 4.0 * math.pi * FILLET**2
VOLUME = SIDE**3 + FACE_AREA * FILLET + 3.0 * math.pi * SIDE * FILLET**2
VOLUME += 4.0 * math.pi * FILLET**3 / 3.0
SPHERE_RADIUS = (3.0 * VOLUME / (4.0 * math.pi)) ** (1.0 / 3.0)
NOISE_A = Vector((4.31, 7.10, 2.90))
NOISE_B = Vector((13.72, -3.55, 9.82))
MASK_EDGE = 1.16
CLOSED_LID = 0.12


def finite_float(text):
    value = float(text)
    if not math.isfinite(value):
        raise argparse.ArgumentTypeError("유한한 수를 입력하세요.")
    return value


def bounded(low, high):
    def parse(text):
        value = finite_float(text)
        if not low <= value <= high:
            raise argparse.ArgumentTypeError(f"{low}~{high} 사이의 값을 입력하세요.")
        return value

    return parse


def hex_rgb(text):
    digits = text.strip().removeprefix("#")
    if len(digits) != 6 or any(c not in "0123456789abcdefABCDEF" for c in digits):
        raise argparse.ArgumentTypeError("6자리 sRGB 색을 입력하세요.")
    rgb = [int(digits[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(
        c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055)**2.4
        for c in rgb
    )


def parse_args():
    parser = argparse.ArgumentParser(
        description="SYNK 양모 펠트 큐브",
        epilog=(
            "2027 --body 색상  |  루미너스 블루 26409B, 에너지 오렌지 F2683C, "
            "팝 핑크 EE9CC0, 메도랜드 그린 9DA85C, 클레이 B98C7E"
        ),
    )
    parser.add_argument("--out", type=Path, default=Path("felt-cube-out"))
    parser.add_argument("--name", default="felt-cube.png")
    parser.add_argument("--res", type=int, default=1024)
    parser.add_argument("--samples", type=int, default=160)
    parser.add_argument("--yaw", type=finite_float, default=13.0)
    parser.add_argument("--pitch", type=finite_float, default=14.5)
    parser.add_argument("--roll", type=finite_float, default=0.0)
    parser.add_argument("--morph", type=bounded(0.0, 1.0), default=0.0)
    parser.add_argument("--squash", type=bounded(0.8, 1.2), default=1.0)
    parser.add_argument("--eyes", choices=("dot", "pill", "none"), default="dot")
    parser.add_argument("--patch", type=int, choices=(0, 1), default=1)
    parser.add_argument("--blink", type=bounded(0.0, 1.0), default=0.0)
    parser.add_argument("--gaze-x", type=bounded(-1.0, 1.0), default=0.0)
    parser.add_argument("--gaze-y", type=bounded(-1.0, 1.0), default=0.0)
    for name, color in (
        ("body", "4A362C"),
        ("eye", "F1E6CF"),
        ("accent", "F96859"),
        ("bg", "000000"),
    ):
        parser.add_argument(f"--{name}", type=hex_rgb, default=color)
    parser.add_argument("--transparent", type=int, choices=(0, 1), default=0)
    parser.add_argument("--seed", type=int, default=27)
    parser.add_argument("--save-blend", type=Path)
    parser.add_argument("--anim", choices=("turn", "sway", "none"), default="none")
    parser.add_argument("--frames", type=int, default=120)
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--end", type=int, help="마지막으로 저장할 장 번호. 이 장도 저장합니다.")

    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parser.parse_args(argv)
    if not 4 <= args.res <= 65536 or not 1 <= args.samples <= 16777216:
        parser.error("--res 또는 --samples가 Blender의 설정 범위를 벗어났습니다.")
    if args.frames < 1:
        parser.error("--frames는 1 이상이어야 합니다.")
    if args.end is None:
        args.end = args.frames - 1
    if not 0 <= args.start <= args.end < args.frames:
        parser.error("장 번호는 0 <= --start <= --end < --frames여야 합니다.")
    return args


def inside_output(root, path):
    path = path.resolve()
    if path == root or not path.is_relative_to(root):
        raise ValueError(f"출력 경로는 --out 폴더 안이어야 합니다. {path}")
    return path


def output_paths(args):
    root = args.out.expanduser().resolve()
    name = args.name
    if not name.strip() or name in (".", "..") or any(c in name for c in "/\\:"):
        raise ValueError("--name에는 파일 이름만 입력하세요.")

    blend = None
    if args.save_blend is not None:
        target = args.save_blend.expanduser()
        if not target.is_absolute() and not target.resolve().is_relative_to(root):
            target = root / target
        if target.suffix.lower() != ".blend":
            target = target.with_name(target.name + ".blend")
        blend = inside_output(root, target)

    root.mkdir(parents=True, exist_ok=True)
    if blend is not None:
        blend.parent.mkdir(parents=True, exist_ok=True)
    return root, blend


def image_path(root, name, frame):
    if frame is not None:
        name = f"{Path(name).stem}_{frame:04d}.png"
    elif not name.lower().endswith(".png"):
        name += ".png"
    return inside_output(root, root / name)


def ease(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3.0 - 2.0 * t)


def core_coord(value):
    return min(CORE, max(-CORE, value))


def rounded_surface(point):
    core = Vector(tuple(core_coord(c) for c in point))
    normal = (point - core).normalized()
    return core + normal * FILLET, normal


def front_surface(x, z):
    dx, dz = x - core_coord(x), z - core_coord(z)
    dy = -math.sqrt(max(1e-12, FILLET**2 - dx**2 - dz**2))
    return Vector((x, -CORE + dy, z)), Vector((dx, dy, dz)) / FILLET


class Shape:
    def __init__(self, morph, squash):
        self.morph = ease(morph)
        self.cube_weight = 1.0 - self.morph
        self.z_scale = squash
        self.xy_scale = squash ** -0.5

    def place(self, point, normal, depth=0.0):
        radius = point.length
        direction = point / radius
        peak = max(abs(direction.x), abs(direction.y), abs(direction.z))
        bulge = 0.024 * (max(0.0, peak - 0.58) / 0.42)**2
        relief = 0.013 * noise.noise(point * 3.15 + NOISE_A)
        relief += 0.005 * noise.noise(point * 7.90 + NOISE_B)
        moved_radius = self.cube_weight * (radius + bulge) + self.morph * SPHERE_RADIUS + relief
        result = direction * moved_radius
        if depth:
            ratio = self.cube_weight * radius / moved_radius
            changed = normal * ratio + direction * (normal.dot(direction) * (1.0 - ratio))
            result += changed.normalized() * depth
        return Vector((result.x * self.xy_scale, result.y * self.xy_scale, result.z * self.z_scale))

    def front(self, x, z, depth):
        point, normal = front_surface(x, z)
        return self.place(point, normal, depth)


def wool_material(name, rgb, gains, grain=None, depth=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*rgb, 1.0)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    diffuse = nodes.new("ShaderNodeBsdfDiffuse")
    diffuse.inputs["Roughness"].default_value = 0.46

    if grain is None:
        source = nodes.new("ShaderNodeHairInfo").outputs["Random"]
    else:
        coords = nodes.new("ShaderNodeTexCoord")
        texture = nodes.new("ShaderNodeTexNoise")
        texture.inputs["Scale"].default_value = grain
        texture.inputs["Detail"].default_value = 2.5
        links.new(coords.outputs["Object"], texture.inputs["Vector"])
        source = texture.outputs["Fac"]
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.26
        bump.inputs["Distance"].default_value = depth
        links.new(source, bump.inputs["Height"])
        links.new(bump.outputs["Normal"], diffuse.inputs["Normal"])

    # 가장 밝은 채널이 한계에 닿으면 세 채널의 배율을 함께 제한한다.
    ramp = nodes.new("ShaderNodeValToRGB")
    limit = 1.0 / max(rgb) if max(rgb) > 0.0 else 1.0
    for stop, gain in zip(ramp.color_ramp.elements, gains):
        scale = min(gain, limit)
        stop.color = (*(c * scale for c in rgb), 1.0)
    links.new(source, ramp.inputs["Fac"])
    dye = ramp.outputs["Color"]
    links.new(dye, diffuse.inputs["Color"])

    # 카메라에 보이는 색 일부를 염색 원색으로 채운다. 입체 명암은 확산광이 만든다.
    pigment = nodes.new("ShaderNodeEmission")
    links.new(dye, pigment.inputs["Color"])
    pigment.inputs["Strength"].default_value = 1.0
    ray = nodes.new("ShaderNodeLightPath")
    weight = nodes.new("ShaderNodeMath")
    weight.operation = "MULTIPLY"
    weight.inputs[1].default_value = 0.26 if grain is None else 0.20
    links.new(ray.outputs["Is Camera Ray"], weight.inputs[0])
    mix = nodes.new("ShaderNodeMixShader")
    links.new(weight.outputs[0], mix.inputs[0])
    links.new(diffuse.outputs[0], mix.inputs[1])
    links.new(pigment.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])

    settings = getattr(material, "cycles", None)
    if hasattr(settings, "emission_sampling"):
        settings.emission_sampling = "NONE"
    return material


def link_object(scene, parent, name, data=None):
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def mesh_object(scene, parent, name, vertices, faces, material):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.polygons.foreach_set("use_smooth", [True] * len(faces))
    mesh.materials.append(material)
    return link_object(scene, parent, name, mesh)


def body_shell(scene, parent, shape, material, divisions=64):
    vertices, faces, indices = [], [], {}
    for axis in range(3):
        u, v = (axis + 1) % 3, (axis + 2) % 3
        for sign in (-1, 1):
            grid = []
            for i in range(divisions + 1):
                row = []
                for j in range(divisions + 1):
                    coords = [0, 0, 0]
                    coords[axis] = divisions if sign > 0 else 0
                    coords[u], coords[v] = i, j
                    key = tuple(coords)
                    if key not in indices:
                        cube = Vector(tuple(2.0 * k / divisions - 1.0 for k in key))
                        point, normal = rounded_surface(cube)
                        indices[key] = len(vertices)
                        vertices.append(shape.place(point, normal))
                    row.append(indices[key])
                grid.append(row)
            for i in range(divisions):
                for j in range(divisions):
                    quad = (grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1])
                    faces.append(quad if sign > 0 else quad[::-1])
    return mesh_object(scene, parent, "Felt body", vertices, faces, material)


def capsule_outline(radius, half_line):
    if half_line == 0.0:
        angles = (math.tau * i / 24 for i in range(24))
        return [(radius * math.cos(a), radius * math.sin(a)) for a in angles]
    outline = []
    for start, center_z in ((0.0, half_line), (math.pi, -half_line)):
        for i in range(13):
            angle = start + math.pi * i / 12
            outline.append((radius * math.cos(angle), center_z + radius * math.sin(angle)))
        side_x = -radius if center_z > 0.0 else radius
        for i in range(1, 8):
            outline.append((side_x, center_z * (1.0 - 2.0 * i / 8)))
    return outline


def coral_outline():
    corners = [Vector(p) for p in ((0.35, 0.72), (0.72, 0.42), (0.86, 0.92))]
    center = sum(corners, Vector((0.0, 0.0))) / 3.0
    outline = []
    for i, corner in enumerate(corners):
        following = corners[(i + 1) % 3]
        entry = corner.lerp(corners[i - 1], 0.046)
        exit_point = corner.lerp(following, 0.046)
        next_entry = following.lerp(corner, 0.046)
        for j in range(5):
            t = j / 5.0
            outline.append(entry.lerp(corner, t).lerp(corner.lerp(exit_point, t), t) - center)
        segments = math.ceil((next_entry - exit_point).length / 0.017)
        for j in range(segments):
            outline.append(exit_point.lerp(next_entry, j / segments) - center)
    for point in outline:
        angle = math.atan2(point.y, point.x)
        wobble = 0.0023 * math.sin(9.0 * angle + 0.45) + 0.0011 * math.sin(19.0 * angle + 1.8)
        point *= 1.0 + wobble / point.length
    return tuple(center), [tuple(point) for point in outline]


class Piece:
    def __init__(self, center, scale, outline, rise, rim, fringe):
        self.x, self.z = center
        self.scale = scale
        self.rise, self.rim, self.fringe = rise, rim, fringe
        self.outline = sorted(outline, key=lambda p: math.atan2(p[1], p[0]))
        self.angles = [math.atan2(z, x) for x, z in self.outline]
        self.planes, self.areas = [], []
        total_area = 0.0
        for i, (ax, az) in enumerate(self.outline):
            bx, bz = self.outline[(i + 1) % len(self.outline)]
            area = ax * bz - az * bx
            self.planes.append(((bz - az) / area, (ax - bx) / area))
            total_area += area
            self.areas.append(total_area)

    def rho(self, x, z):
        sector = bisect_right(self.angles, math.atan2(z, x)) - 1
        ax, az = self.planes[sector]
        return ax * x + az * z

    def sample(self, rng):
        sector = bisect_right(self.areas, rng.random() * self.areas[-1], 0, len(self.areas) - 1)
        ax, az = self.outline[sector]
        bx, bz = self.outline[(sector + 1) % len(self.outline)]
        t, radius = rng.random(), math.sqrt(rng.random())
        return radius * (ax + (bx - ax) * t), radius * (az + (bz - az) * t)

    def height(self, rho):
        return -0.0016 + (self.rise + 0.0016) * ease((1.0 - rho) / self.rim)

    def chart(self, x, z):
        return self.x + x, self.z + z * self.scale


def eye_groups(args, center_z, lid):
    if args.eyes == "none":
        return []
    pill = args.eyes == "pill"
    outline = capsule_outline(0.055, 0.095) if pill else capsule_outline(0.047, 0.0)
    groups = []
    for eye_x in (-0.40, 0.40):
        x = eye_x + 0.09 * args.gaze_x
        if pill:
            pieces = [Piece((x, center_z), lid, outline, 0.012, 0.35, 1.14)]
        else:
            pieces = [
                Piece((x + col * 0.10, center_z + row * 0.10 * lid), lid, outline, 0.022, 0.78, 1.14)
                for col in (-0.5, 0.5) for row in range(-2, 3)
            ]
        groups.append(pieces)
    return groups


def drive(owner, prop, expression, index=None):
    curve = owner.driver_add(prop) if index is None else owner.driver_add(prop, index)
    curve.driver.type = "SCRIPTED"
    curve.driver.expression = expression


def cube_rig(scene, args):
    tilt = link_object(scene, None, "Sway pitch")
    cube = link_object(scene, tilt, "SYNK felt cube")

    # 2회차의 양의 yaw는 카메라가 큐브의 오른쪽으로 간 각도였다.
    # 고정 카메라에서 같은 면을 보려면 큐브를 그 반대 방향으로 돌린다.
    base_z = -math.radians(args.yaw % 360.0)
    cube.rotation_euler.z = base_z
    phase = f"({math.tau!r}*frame/{args.frames})"
    if args.anim == "turn":
        drive(cube, "rotation_euler", f"({base_z!r})-{phase}", 2)
    elif args.anim == "sway":
        drive(cube, "rotation_euler", f"({base_z!r})-{math.radians(26)!r}*sin({phase})", 2)
        drive(tilt, "rotation_euler", f"{math.radians(4)!r}*sin({phase})", 0)
    return cube


def attribute_data(data, name, kind, domain):
    attr = data.attributes.get(name)
    if attr is None:
        attr = data.attributes.new(name=name, type=kind, domain=domain)
    return attr.data


@dataclass
class BlinkRig:
    group: object
    center_z: float
    closed_ratio: float


def make_blink_rig(frames, center_z, lid):
    group = bpy.data.node_groups.new("Felt eye blink", "GeometryNodeTree")
    group.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    group.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    nodes, links = group.nodes, group.links
    source = nodes.new("NodeGroupInput")
    output = nodes.new("NodeGroupOutput")
    move = nodes.new("GeometryNodeSetPosition")
    links.new(source.outputs["Geometry"], move.inputs["Geometry"])
    links.new(move.outputs["Geometry"], output.inputs["Geometry"])

    weight = nodes.new("ShaderNodeValue").outputs[0]
    phase = f"(frame/{frames}-floor(frame/{frames}))"
    window = f"min(1.0,max(0.0,({phase}-0.55)/0.08))"
    drive(weight, "default_value", f"0.5-0.5*cos({math.tau!r}*{window})")

    def vector_attribute(name):
        node = nodes.new("GeometryNodeInputNamedAttribute")
        node.data_type = "FLOAT_VECTOR"
        node.inputs["Name"].default_value = name
        return node.outputs["Attribute"]

    def scale_vector(vector, factor):
        node = nodes.new("ShaderNodeVectorMath")
        node.operation = "SCALE"
        links.new(vector, node.inputs[0])
        links.new(factor, node.inputs["Scale"])
        return node.outputs["Vector"]

    inverse = nodes.new("ShaderNodeMath")
    inverse.operation = "SUBTRACT"
    inverse.inputs[0].default_value = 1.0
    links.new(weight, inverse.inputs[1])

    # 열린 위치, 반쯤 감은 위치, 감은 위치를 모두 지나도록 얼굴의 곡률을 보간한다.
    add = nodes.new("ShaderNodeVectorMath")
    add.operation = "ADD"
    links.new(vector_attribute("blink_travel"), add.inputs[0])
    links.new(scale_vector(vector_attribute("blink_bow"), inverse.outputs[0]), add.inputs[1])
    links.new(scale_vector(add.outputs["Vector"], weight), move.inputs["Offset"])
    return BlinkRig(group, center_z, CLOSED_LID / lid)


class CapPoints:
    def __init__(self, shape, blink):
        self.shape = shape
        self.blink = blink
        self.travel = array("f")
        self.bow = array("f")

    def point(self, piece, x, z, rho, loft=0.0):
        x, z = piece.chart(x, z)
        height = piece.height(rho) + loft
        opened = self.shape.front(x, z, height)
        if self.blink is not None:
            pivot = self.blink.center_z
            closed_z = pivot + (z - pivot) * self.blink.closed_ratio
            closed = self.shape.front(x, closed_z, height)
            middle = self.shape.front(x, 0.5 * (z + closed_z), height)
            self.travel.extend(closed - opened)
            self.bow.extend((middle - (opened + closed) * 0.5) * 4.0)
        return opened

    def attach(self, obj):
        if self.blink is None:
            return
        for name, values in (("blink_travel", self.travel), ("blink_bow", self.bow)):
            attribute_data(obj.data, name, "FLOAT_VECTOR", "POINT").foreach_set("vector", values)
        obj.data.update_tag()
        modifier = obj.modifiers.new("Blink", "NODES")
        modifier.node_group = self.blink.group


def cap_mesh(scene, parent, shape, pieces, material, name, rings, blink=None):
    points = CapPoints(shape, blink)
    vertices, faces = [], []
    for piece in pieces:
        center = len(vertices)
        vertices.append(points.point(piece, 0.0, 0.0, 0.0))
        count = len(piece.outline)
        for ring in range(1, rings + 1):
            rho = ring / rings
            current = len(vertices)
            for x, z in piece.outline:
                vertices.append(points.point(piece, x * rho, z * rho, rho))
            for i in range(count):
                j = (i + 1) % count
                if ring == 1:
                    faces.append((center, current + i, current + j))
                else:
                    inner = current - count
                    faces.append((inner + i, current + i, current + j, inner + j))
    obj = mesh_object(scene, parent, name, vertices, faces, material)
    points.attach(obj)


def mask_groups(groups):
    result = []
    for pieces in groups:
        points = [
            piece.chart(x * MASK_EDGE, z * MASK_EDGE)
            for piece in pieces for x, z in piece.outline
        ]
        xs, zs = zip(*points)
        result.append((min(xs), max(xs), min(zs), max(zs), pieces))
    return result


def patch_visibility(x, z, masks):
    keep = 1.0
    for left, right, bottom, top, pieces in masks:
        if left <= x <= right and bottom <= z <= top:
            for piece in pieces:
                rho = piece.rho(x - piece.x, (z - piece.z) / piece.scale)
                keep = min(keep, ease((rho - 1.0) / (MASK_EDGE - 1.0)))
    return keep


def eye_coat_height(x, z, height, eye_boxes):
    # 눈 아래에도 몸의 올을 남겨서 눈을 감았을 때 빈 자리가 드러나지 않게 한다.
    pressed = 0.0015
    if height <= pressed:
        return height
    margin = 0.035
    for left, right, bottom, top in eye_boxes:
        distance = max(left - x, x - right, bottom - z, z - top)
        if distance < margin:
            return pressed + (height - pressed) * ease(distance / margin)
    return height


def sample_body(rng):
    region = rng.random() * (FACE_AREA + EDGE_AREA + CORNER_AREA)
    axis = rng.randrange(3)
    u, v = (axis + 1) % 3, (axis + 2) % 3
    core, normal = Vector((0.0, 0.0, 0.0)), Vector((0.0, 0.0, 0.0))
    if region < FACE_AREA:
        sign = rng.choice((-1.0, 1.0))
        core[axis], normal[axis] = CORE * sign, sign
        core[u], core[v] = rng.uniform(-CORE, CORE), rng.uniform(-CORE, CORE)
    elif region < FACE_AREA + EDGE_AREA:
        su, sv = rng.choice((-1.0, 1.0)), rng.choice((-1.0, 1.0))
        angle = rng.uniform(0.0, math.pi / 2.0)
        core[u], core[v] = CORE * su, CORE * sv
        normal[u], normal[v] = su * math.cos(angle), sv * math.sin(angle)
        core[axis] = rng.uniform(-CORE, CORE)
    else:
        z = rng.random()
        angle = rng.uniform(0.0, math.pi / 2.0)
        radial = math.sqrt(1.0 - z * z)
        normal = Vector((radial * math.cos(angle), radial * math.sin(angle), z))
        for i in range(3):
            sign = rng.choice((-1.0, 1.0))
            core[i], normal[i] = CORE * sign, normal[i] * sign
    return core + normal * FILLET, normal


@dataclass(frozen=True)
class Fiber:
    keys: int
    length: tuple[float, float]
    radius: tuple[float, float]
    loft: tuple[float, float]
    bend: float
    curl: tuple[float, float]
    turns: tuple[float, float]
    tip_fraction: tuple[float, float] = (0.16, 0.60)
    arc_weight: float = 1.0


MAT = Fiber(
    7, (0.068, 0.134), (0.00082, 0.00148), (0.0016, 0.0055),
    1.55, (0.12, 0.45), (0.46, 0.82),
)
THREAD = Fiber(
    8, (0.100, 0.195), (0.00098, 0.00170), (0.0032, 0.0080),
    1.80, (0.17, 0.52), (0.43, 0.88),
)
NAP = Fiber(
    4, (0.010, 0.030), (0.00043, 0.00080), (0.006, 0.018),
    0.85, (0.04, 0.19), (0.26, 0.55), tip_fraction=(0.70, 1.0), arc_weight=0.22,
)
HALO = Fiber(
    7, (0.062, 0.142), (0.00059, 0.00106), (0.010, 0.027),
    1.35, (0.08, 0.32), (0.30, 0.72),
)
EYE = Fiber(
    8, (0.012, 0.030), (0.00110, 0.00205), (0.0016, 0.0052),
    2.05, (0.48, 1.10), (0.65, 1.22),
)
CORAL = Fiber(
    8, (0.016, 0.036), (0.00095, 0.00170), (0.0012, 0.0041),
    1.80, (0.45, 1.05), (0.65, 1.22),
)


def fiber_points(profile, rng):
    steps = profile.keys - 1
    step = rng.uniform(*profile.length) / steps
    radius = rng.uniform(*profile.radius)
    loft = rng.uniform(*profile.loft)
    tip = loft * rng.uniform(*profile.tip_fraction)
    arc_height = loft * profile.arc_weight
    heading = rng.uniform(0.0, math.tau)
    phase = rng.uniform(0.0, math.tau)
    initial_wave = math.sin(phase)
    frequency = math.tau * rng.uniform(*profile.turns)
    curl = rng.uniform(*profile.curl)
    bend = rng.uniform(-profile.bend, profile.bend)
    x, y = 0.0, 0.0
    for i in range(profile.keys):
        t = i / steps
        if i:
            mid = (i - 0.5) / steps
            angle = heading + bend * mid + curl * (math.sin(phase + frequency * mid) - initial_wave)
            x += step * math.cos(angle)
            y += step * math.sin(angle)
        arc = math.sin(math.pi * t)
        height = -0.0019 * (1.0 - t) + arc_height * arc + tip * t
        width = radius * (0.94 + 0.10 * arc) * (1.0 - 0.73 * t**2)
        yield x, y, height, width


def hair_object(scene, parent, name, material, count, keys, positions, radii):
    data = bpy.data.hair_curves.new(name)
    if not hasattr(data, "add_curves"):
        raise RuntimeError("이 Blender 빌드에는 Curves.add_curves가 필요합니다.")
    data.add_curves([keys] * count)
    attribute_data(data, "position", "FLOAT_VECTOR", "POINT").foreach_set("vector", positions)
    attribute_data(data, "radius", "FLOAT", "POINT").foreach_set("value", radii)
    attribute_data(data, "resolution", "INT", "CURVE").foreach_set("value", array("i", [2]) * count)
    data.materials.append(material)
    data.update_tag()
    return link_object(scene, parent, name, data)


def body_hair(scene, parent, shape, masks, eye_boxes, material, name, count, profile, seed):
    rng = random.Random(f"{seed}/{name}")
    positions, radii = array("f"), array("f")
    for _ in range(count):
        root, root_normal = sample_body(rng)
        tangent = root_normal.orthogonal().normalized()
        bitangent = root_normal.cross(tangent)
        for dx, dy, height, radius in fiber_points(profile, rng):
            point, normal = rounded_surface(root + tangent * dx + bitangent * dy)
            if point.y < -CORE:
                radius *= patch_visibility(point.x, point.z, masks)
                height = eye_coat_height(point.x, point.z, height, eye_boxes)
            positions.extend(shape.place(point, normal, height))
            radii.append(max(0.000002, radius))
    hair_object(scene, parent, name, material, count, profile.keys, positions, radii)


def piece_hair(scene, parent, shape, pieces, material, name, count, profile, seed, blink=None):
    rng = random.Random(f"{seed}/{name}")
    positions, radii = array("f"), array("f")
    points = CapPoints(shape, blink)
    for i in range(count):
        piece = pieces[i % len(pieces)]
        root_x, root_z = piece.sample(rng)
        for dx, dz, height, radius in fiber_points(profile, rng):
            x, z = root_x + dx, root_z + dz
            rho = piece.rho(x, z)
            keep = 1.0 - ease((rho - 0.94) / (piece.fringe - 0.94))
            if rho > piece.fringe:
                shrink = piece.fringe / rho
                x, z, rho = x * shrink, z * shrink, piece.fringe
            positions.extend(points.point(piece, x, z, rho, height))
            radii.append(max(0.000002, radius * keep))
    obj = hair_object(scene, parent, name, material, count, profile.keys, positions, radii)
    points.attach(obj)


def build_cube(scene, args):
    parent = cube_rig(scene, args)
    shape = Shape(args.morph, args.squash)
    eye_z = -0.14 + 0.09 * args.gaze_y
    lid = 1.0 - (1.0 - CLOSED_LID) * args.blink
    eyes = eye_groups(args, eye_z, lid)
    eye_boxes = [entry[:4] for entry in mask_groups(eyes)]

    patch = []
    if args.patch:
        center, outline = coral_outline()
        patch = [Piece(center, 1.0, outline, 0.010, 0.15, 1.04)]
    masks = mask_groups([patch]) if patch else []

    base = wool_material("Body wool", args.body, (0.94, 1.02), grain=48.0, depth=0.007)
    body_shell(scene, parent, shape, base)
    layers = (
        ("Body mat", 110_000, MAT, (0.97, 1.13)),
        ("Body surface threads", 7_200, THREAD, (1.10, 1.25)),
        ("Body nap", 14_000, NAP, (0.98, 1.09)),
        ("Body flyaways", 900, HALO, (1.02, 1.16)),
    )
    for name, count, profile, gains in layers:
        material = wool_material(name + " dye", args.body, gains)
        body_hair(scene, parent, shape, masks, eye_boxes, material, name, count, profile, args.seed)

    if eyes:
        pieces = [piece for group in eyes for piece in group]
        blink = None
        if args.anim == "sway" and args.blink < 1.0:
            blink = make_blink_rig(args.frames, eye_z, lid)
        base = wool_material("Eye wool", args.eye, (0.96, 1.02), grain=76.0, depth=0.006)
        fibers = wool_material("Eye fiber dye", args.eye, (0.97, 1.07))
        cap_mesh(scene, parent, shape, pieces, base, "Eyes", 9, blink)
        count = 4_800 if args.eyes == "dot" else 2_800
        piece_hair(scene, parent, shape, pieces, fibers, "Eye fibers", count, EYE, args.seed, blink)

    if patch:
        base = wool_material("Triangle wool", args.accent, (0.95, 1.02), grain=88.0, depth=0.0045)
        fibers = wool_material("Triangle fiber dye", args.accent, (0.98, 1.08))
        cap_mesh(scene, parent, shape, patch, base, "Coral triangle", 15)
        piece_hair(scene, parent, shape, patch, fibers, "Coral fibers", 4_300, CORAL, args.seed)


def make_world(scene, bg):
    world = bpy.data.worlds.new("Neutral studio and backdrop")
    scene.world = world
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputWorld")
    ray = nodes.new("ShaderNodeLightPath")
    mix = nodes.new("ShaderNodeMixShader")
    ambient = nodes.new("ShaderNodeBackground")
    ambient.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    ambient.inputs["Strength"].default_value = 0.32
    backdrop = nodes.new("ShaderNodeBackground")
    backdrop.inputs["Color"].default_value = (*bg, 1.0)
    backdrop.inputs["Strength"].default_value = 1.0
    links.new(ray.outputs["Is Camera Ray"], mix.inputs[0])
    links.new(ambient.outputs[0], mix.inputs[1])
    links.new(backdrop.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])


def camera_and_lights(scene, args):
    pitch = math.radians(args.pitch % 360.0)
    view = Vector((0.0, -math.cos(pitch), math.sin(pitch)))
    # 화면의 roll을 카메라와 조명에 함께 적용해 큐브의 회전축을 세워 둔다.
    roll = Quaternion(view, -math.radians(args.roll % 360.0))
    right = roll @ Vector((1.0, 0.0, 0.0))
    up = view.cross(right)

    data = bpy.data.cameras.new("85 mm")
    data.lens = 85.0
    data.sensor_fit = "HORIZONTAL"
    data.sensor_width = 36.0
    data.shift_y = -0.016
    data.dof.use_dof = False
    camera = link_object(scene, None, "Camera", data)
    camera.location = view * 8.75
    camera.rotation_euler = Matrix((right, up, view)).transposed().to_euler()
    scene.camera = camera

    lights = (
        ("Key", (-3.25, 3.60, 4.40), 405.0, 4.4),
        ("Fill", (3.15, 0.50, 4.10), 95.0, 4.0),
        ("Rim", (1.65, 3.20, -3.40), 82.0, 3.5),
    )
    for name, (x, y, z), power, size in lights:
        data = bpy.data.lights.new(name, "AREA")
        data.energy = power
        data.shape = "DISK"
        data.size = size
        data.color = (1.0, 1.0, 1.0)
        light = link_object(scene, None, name, data)
        light.location = right * x + up * y + view * z
        light.rotation_euler = (-light.location).to_track_quat("-Z", "Y").to_euler()


def configure_render(scene, args):
    render = scene.render
    render.engine = "CYCLES"
    render.use_persistent_data = args.anim != "none"
    render.use_motion_blur = False
    render.resolution_x = render.resolution_y = args.res
    render.resolution_percentage = 100
    render.film_transparent = bool(args.transparent)
    render.image_settings.file_format = "PNG"
    render.image_settings.color_mode = "RGBA" if args.transparent else "RGB"
    render.image_settings.color_depth = "8"
    render.use_file_extension = False
    render.filter_size = 1.12
    render.dither_intensity = 0.0

    cycles = scene.cycles
    cycles.samples = args.samples
    cycles.use_adaptive_sampling = True
    cycles.adaptive_threshold = 0.024
    cycles.adaptive_min_samples = min(16, args.samples)
    cycles.seed = args.seed & 0x7FFFFFFF
    if hasattr(cycles, "use_animated_seed"):
        cycles.use_animated_seed = False
    if hasattr(cycles, "hair_shape"):
        cycles.hair_shape = "RIBBON"
    if hasattr(cycles, "pixel_filter_type"):
        cycles.pixel_filter_type = "BLACKMAN_HARRIS"
    cycles.use_denoising = False
    cycles.max_bounces = 2
    cycles.diffuse_bounces = 1
    cycles.glossy_bounces = 0

    scene.display_settings.display_device = "sRGB"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.view_settings.use_curve_mapping = False

    if args.anim != "none":
        max_frame = scene.bl_rna.properties["frame_end"].hard_max
        if args.frames - 1 > max_frame:
            raise ValueError(f"이 Blender에서 마지막 장 번호는 {max_frame} 이하여야 합니다.")
        scene.frame_start = 0
        scene.frame_end = args.frames - 1
        scene.frame_step = 1


def enable_gpu(backend):
    addon = bpy.context.preferences.addons.get("cycles")
    if addon is None:
        return False
    preferences = addon.preferences
    try:
        preferences.compute_device_type = backend
        if hasattr(preferences, "refresh_devices"):
            preferences.refresh_devices()
        elif hasattr(preferences, "get_devices"):
            preferences.get_devices()
        found = False
        for device in preferences.devices:
            device.use = device.type == backend
            found = found or device.use
        return found
    except (RuntimeError, TypeError, ValueError) as error:
        print(f"CYCLES_DEVICE_UNAVAILABLE {backend} {error}", flush=True)
        return False


def render_devices(scene):
    for backend in ("OPTIX", "CUDA", "CPU"):
        if backend != "CPU" and not enable_gpu(backend):
            continue
        scene.cycles.device = "CPU" if backend == "CPU" else "GPU"
        print(f"CYCLES_DEVICE {backend}", flush=True)
        yield backend


def render_images(scene, args, root):
    moving = args.anim != "none"
    numbers = range(args.start, args.end + 1) if moving else (None,)
    devices = render_devices(scene)
    backend = next(devices)

    # 분할 작업마다 임시 경로가 다르다. 저장이 끝난 PNG만 최종 이름으로 옮긴다.
    with TemporaryDirectory(prefix=".felt-render-", dir=root) as work:
        staged = Path(work) / "frame.png"
        scene.render.filepath = str(staged)
        for number in numbers:
            started = time.perf_counter()
            target = image_path(root, args.name, number)
            if moving:
                scene.frame_set(number)

            while True:
                staged.unlink(missing_ok=True)
                try:
                    result = bpy.ops.render.render(write_still=True)
                    if "FINISHED" not in result or not staged.is_file() or staged.stat().st_size == 0:
                        raise RuntimeError(f"PNG 저장을 확인할 수 없습니다. {target}")
                    break
                except RuntimeError as error:
                    if backend == "CPU":
                        raise
                    print(f"CYCLES_RENDER_RETRY {backend} {error}", flush=True)
                    backend = next(devices)

            staged.replace(target)
            if moving:
                print(f"FRAME_DONE {number} {time.perf_counter() - started:.2f}", flush=True)

    if moving:
        scene.render.filepath = str(root / (Path(args.name).stem + "_####"))
        scene.render.use_file_extension = True
        return root
    scene.render.filepath = str(target)
    return target


def main():
    started = time.perf_counter()
    args = parse_args()
    root, blend = output_paths(args)
    scene = bpy.context.scene
    configure_render(scene, args)
    for obj in tuple(scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    build_cube(scene, args)
    make_world(scene, args.bg)
    camera_and_lights(scene, args)
    result_path = render_images(scene, args, root)

    if blend is not None:
        if args.anim != "none":
            scene.frame_set(0)
        result = bpy.ops.wm.save_as_mainfile(filepath=str(blend), check_existing=False)
        if "FINISHED" not in result:
            raise RuntimeError(f"Blender 장면을 저장할 수 없습니다. {blend}")
    print(f"RENDER_DONE {result_path} {time.perf_counter() - started:.2f}", flush=True)


if __name__ == "__main__":
    main()
