import argparse
from array import array
from bisect import bisect_right
from dataclasses import dataclass
import math
from pathlib import Path
import random
import sys
import time

import bpy
from mathutils import Matrix, Quaternion, Vector, noise


FILLET = 0.33
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
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055)**2.4 for c in rgb)


def parse_args():
    parser = argparse.ArgumentParser(description="SYNK 양모 펠트 큐브")
    parser.add_argument("--out", type=Path, default=Path("felt-cube-out"))
    parser.add_argument("--name", default="felt-cube.png")
    parser.add_argument("--res", type=int, default=1024)
    parser.add_argument("--samples", type=int, default=160)
    parser.add_argument("--yaw", type=finite_float, default=22.0)
    parser.add_argument("--pitch", type=finite_float, default=17.0)
    parser.add_argument("--roll", type=finite_float, default=0.0)
    parser.add_argument("--morph", type=bounded(0.0, 1.0), default=0.0)
    parser.add_argument("--squash", type=bounded(0.8, 1.2), default=1.0)
    parser.add_argument("--eyes", choices=("dot", "pill", "none"), default="dot")
    parser.add_argument("--patch", type=int, choices=(0, 1), default=1)
    parser.add_argument("--blink", type=bounded(0.0, 1.0), default=0.0)
    parser.add_argument("--gaze-x", type=bounded(-1.0, 1.0), default=0.0)
    parser.add_argument("--gaze-y", type=bounded(-1.0, 1.0), default=0.0)
    for name, color in (("body", "3A2F2A"), ("eye", "F1E6CF"), ("accent", "F96859"), ("bg", "000000")):
        parser.add_argument(f"--{name}", type=hex_rgb, default=color)
    parser.add_argument("--transparent", type=int, choices=(0, 1), default=0)
    parser.add_argument("--seed", type=int, default=27)
    parser.add_argument("--save-blend", type=Path)
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parser.parse_args(argv)
    if not 4 <= args.res <= 65536 or not 1 <= args.samples <= 16777216:
        parser.error("--res 또는 --samples가 Blender의 설정 범위를 벗어났습니다.")
    return args


def output_paths(args):
    root = args.out.expanduser().resolve()
    name = args.name
    if not name.strip() or name in (".", "..") or any(c in name for c in "/\\:"):
        raise ValueError("--name에는 파일 이름만 입력하세요.")
    if not name.lower().endswith(".png"):
        name += ".png"
    image = (root / name).resolve()
    blend = None
    if args.save_blend is not None:
        target = args.save_blend.expanduser()
        if not target.is_absolute() and not target.resolve().is_relative_to(root):
            target = root / target
        if target.suffix.lower() != ".blend":
            target = target.with_name(target.name + ".blend")
        blend = target.resolve()
    for path in (image, blend):
        if path is not None and (path == root or not path.is_relative_to(root)):
            raise ValueError(f"출력 경로는 --out 폴더 안이어야 합니다. {path}")
    if image == blend:
        raise ValueError("PNG와 Blender 장면의 저장 경로가 같습니다.")
    image.parent.mkdir(parents=True, exist_ok=True)
    if blend is not None:
        blend.parent.mkdir(parents=True, exist_ok=True)
    return image, blend


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


def material_nodes(name, rgb):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*rgb, 1.0)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    return material, nodes, links, nodes.new("ShaderNodeOutputMaterial")


def tint(nodes, links, source, rgb, gains):
    ramp = nodes.new("ShaderNodeValToRGB")
    for stop, gain in zip(ramp.color_ramp.elements, gains):
        stop.color = (*(min(1.0, c * gain) for c in rgb), 1.0)
    links.new(source, ramp.inputs["Fac"])
    return ramp.outputs["Color"]


def set_socket(node, name, value):
    socket = node.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def wool_surface(name, rgb, grain, depth, gains):
    material, nodes, links, output = material_nodes(name, rgb)
    surface = nodes.new("ShaderNodeBsdfPrincipled")
    coords = nodes.new("ShaderNodeTexCoord")
    texture = nodes.new("ShaderNodeTexNoise")
    bump = nodes.new("ShaderNodeBump")
    texture.inputs["Scale"].default_value = grain
    texture.inputs["Detail"].default_value = 3.0
    surface.inputs["Roughness"].default_value = 0.93
    set_socket(surface, "Specular IOR Level", 0.16)
    set_socket(surface, "Sheen Weight", 0.07)
    bump.inputs["Strength"].default_value = 0.33
    bump.inputs["Distance"].default_value = depth
    links.new(coords.outputs["Object"], texture.inputs["Vector"])
    links.new(texture.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], surface.inputs["Normal"])
    links.new(tint(nodes, links, texture.outputs["Fac"], rgb, gains), surface.inputs["Base Color"])
    links.new(surface.outputs["BSDF"], output.inputs["Surface"])
    return material


def wool_fiber(name, rgb, gains):
    material, nodes, links, output = material_nodes(name, rgb)
    info = nodes.new("ShaderNodeHairInfo")
    color = tint(nodes, links, info.outputs["Random"], rgb, gains)
    diffuse = nodes.new("ShaderNodeBsdfDiffuse")
    hair = nodes.new("ShaderNodeBsdfHairPrincipled")
    if hasattr(hair, "parametrization"):
        hair.parametrization = "COLOR"
    hair_color = hair.inputs.get("Color")
    if hair_color is not None:
        links.new(color, hair_color)
    set_socket(hair, "Roughness", 0.72)
    set_socket(hair, "Radial Roughness", 0.84)
    set_socket(hair, "Coat", 0.0)
    set_socket(hair, "IOR", 1.43)
    diffuse.inputs["Roughness"].default_value = 0.52
    links.new(color, diffuse.inputs["Color"])
    mix = nodes.new("ShaderNodeMixShader")
    mix.inputs[0].default_value = 0.32 if hair_color is not None else 0.0
    links.new(diffuse.outputs[0], mix.inputs[1])
    links.new(hair.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])
    return material


def mesh_object(scene, parent, name, vertices, faces, material):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.polygons.foreach_set("use_smooth", [True] * len(faces))
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


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
    return mesh_object(scene, parent, "Chocolate felt", vertices, faces, material)


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


def eye_groups(args):
    if args.eyes == "none":
        return []
    pill = args.eyes == "pill"
    outline = capsule_outline(0.055, 0.095) if pill else capsule_outline(0.033, 0.0)
    lid = 1.0 - 0.88 * args.blink
    groups = []
    for eye_x in (-0.41, 0.41):
        x, z = eye_x + 0.09 * args.gaze_x, -0.14 + 0.09 * args.gaze_y
        if pill:
            pieces = [Piece((x, z), lid, outline, 0.012, 0.35, 1.14)]
        else:
            pieces = [
                Piece((x + col * 0.09, z + row * 0.09 * lid), lid, outline, 0.012, 0.53, 1.14)
                for col in (-0.5, 0.5) for row in range(-2, 3)
            ]
        groups.append(pieces)
    return groups


def cap_point(shape, piece, x, z, rho, loft=0.0):
    point, normal = front_surface(*piece.chart(x, z))
    return shape.place(point, normal, piece.height(rho) + loft)


def cap_mesh(scene, parent, shape, pieces, material, name, rings):
    vertices, faces = [], []
    for piece in pieces:
        center = len(vertices)
        vertices.append(cap_point(shape, piece, 0.0, 0.0, 0.0))
        count = len(piece.outline)
        for ring in range(1, rings + 1):
            rho = ring / rings
            current = len(vertices)
            for x, z in piece.outline:
                vertices.append(cap_point(shape, piece, x * rho, z * rho, rho))
            for i in range(count):
                j = (i + 1) % count
                if ring == 1:
                    faces.append((center, current + i, current + j))
                else:
                    inner = current - count
                    faces.append((inner + i, current + i, current + j, inner + j))
    return mesh_object(scene, parent, name, vertices, faces, material)


def mask_groups(groups):
    result = []
    for pieces in groups:
        points = [piece.chart(x * MASK_EDGE, z * MASK_EDGE)
                  for piece in pieces for x, z in piece.outline]
        xs, zs = zip(*points)
        result.append((min(xs), max(xs), min(zs), max(zs), pieces))
    return result


def body_hair_visibility(point, masks):
    if point.y >= -CORE:
        return 1.0
    x, z = point.x, point.z
    keep = 1.0
    for left, right, bottom, top, pieces in masks:
        if left <= x <= right and bottom <= z <= top:
            for piece in pieces:
                rho = piece.rho(x - piece.x, (z - piece.z) / piece.scale)
                keep = min(keep, ease((rho - 1.0) / (MASK_EDGE - 1.0)))
    return keep


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


MAT = Fiber(10, (0.030, 0.070), (0.00165, 0.00305), (0.0035, 0.011), 2.60, (0.68, 1.55), (0.75, 1.50))
HALO = Fiber(13, (0.100, 0.250), (0.00115, 0.00255), (0.0130, 0.048), 1.65, (0.16, 0.62), (0.50, 1.08))
EYE = Fiber(8, (0.012, 0.030), (0.00110, 0.00205), (0.0016, 0.0052), 2.05, (0.48, 1.10), (0.65, 1.22))
CORAL = Fiber(8, (0.016, 0.036), (0.00095, 0.00170), (0.0012, 0.0041), 1.80, (0.45, 1.05), (0.65, 1.22))


def fiber_points(profile, rng):
    steps = profile.keys - 1
    step = rng.uniform(*profile.length) / steps
    radius = rng.uniform(*profile.radius)
    loft = rng.uniform(*profile.loft)
    tip = loft * rng.uniform(0.16, 0.60)
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
        height = -0.0019 * (1.0 - t) + loft * arc + tip * t
        width = radius * (0.94 + 0.10 * arc) * (1.0 - 0.73 * t**2)
        yield x, y, height, width


def curve_attribute(data, name, kind, domain):
    attr = data.attributes.get(name)
    if attr is None:
        attr = data.attributes.new(name=name, type=kind, domain=domain)
    return attr.data


def hair_object(scene, parent, name, material, count, keys, positions, radii):
    data = bpy.data.hair_curves.new(name)
    if not hasattr(data, "add_curves"):
        raise RuntimeError("이 Blender 빌드에는 Curves.add_curves가 필요합니다.")
    data.add_curves([keys] * count)
    curve_attribute(data, "position", "FLOAT_VECTOR", "POINT").foreach_set("vector", positions)
    curve_attribute(data, "radius", "FLOAT", "POINT").foreach_set("value", radii)
    resolution = curve_attribute(data, "resolution", "INT", "CURVE")
    resolution.foreach_set("value", array("i", [2]) * count)
    data.materials.append(material)
    data.update_tag()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.parent = parent


def body_hair(scene, parent, shape, masks, material, name, count, profile, seed):
    rng = random.Random(f"{seed}/{name}")
    positions, radii = array("f"), array("f")
    for _ in range(count):
        root, root_normal = sample_body(rng)
        tangent = root_normal.orthogonal().normalized()
        bitangent = root_normal.cross(tangent)
        for dx, dy, height, radius in fiber_points(profile, rng):
            point, normal = rounded_surface(root + tangent * dx + bitangent * dy)
            positions.extend(shape.place(point, normal, height))
            keep = body_hair_visibility(point, masks)
            radii.append(max(0.000002, radius * keep))
    hair_object(scene, parent, name, material, count, profile.keys, positions, radii)


def piece_hair(scene, parent, shape, pieces, material, name, count, profile, seed):
    rng = random.Random(f"{seed}/{name}")
    positions, radii = array("f"), array("f")
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
            positions.extend(cap_point(shape, piece, x, z, rho, height))
            radii.append(max(0.000002, radius * keep))
    hair_object(scene, parent, name, material, count, profile.keys, positions, radii)


def make_world(scene, bg):
    world = bpy.data.worlds.new("Backdrop and ambient")
    scene.world = world
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputWorld")
    ray = nodes.new("ShaderNodeLightPath")
    mix = nodes.new("ShaderNodeMixShader")
    ambient, backdrop = nodes.new("ShaderNodeBackground"), nodes.new("ShaderNodeBackground")
    ambient.inputs["Color"].default_value = (0.76, 0.68, 0.60, 1.0)
    ambient.inputs["Strength"].default_value = 0.035
    backdrop.inputs["Color"].default_value = (*bg, 1.0)
    links.new(ray.outputs["Is Camera Ray"], mix.inputs[0])
    links.new(ambient.outputs[0], mix.inputs[1])
    links.new(backdrop.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])


def camera_and_lights(scene, parent, args):
    yaw, pitch = (math.radians(angle % 360.0) for angle in (args.yaw, args.pitch))
    view = Vector((math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
    right = Vector((math.cos(yaw), math.sin(yaw), 0.0))
    up = view.cross(right)
    camera_data = bpy.data.cameras.new("85 mm")
    camera_data.lens = 85.0
    camera_data.sensor_fit = "HORIZONTAL"
    camera_data.sensor_width = 36.0
    camera_data.shift_y = -0.016
    camera = bpy.data.objects.new("Camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = view * 9.20
    camera.rotation_euler = Matrix((right, up, view)).transposed().to_euler()
    scene.camera = camera
    parent.rotation_mode = "QUATERNION"
    parent.rotation_quaternion = Quaternion(view, math.radians(args.roll % 360.0))

    lights = (
        ("Key", (-3.5, 4.6, 4.2), 820.0, 5.6, (1.0, 0.95, 0.91)),
        ("Fill", (-0.55, 0.2, 5.5), 72.0, 4.8, (0.96, 0.97, 1.0)),
        ("Rim", (-1.8, 2.4, -3.8), 145.0, 3.6, (1.0, 0.91, 0.85)),
    )
    for name, (x, y, z), power, size, color in lights:
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.shape, data.size, data.color = power, "DISK", size, color
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = right * x + up * y + view * z
        light.rotation_euler = (-light.location).to_track_quat("-Z", "Y").to_euler()


def configure_render(scene, args, image):
    scene.render.engine = "CYCLES"
    cycles = scene.cycles
    cycles.samples = args.samples
    cycles.use_adaptive_sampling = True
    cycles.adaptive_threshold = 0.018
    cycles.adaptive_min_samples = min(24, args.samples)
    cycles.use_denoising = True
    if hasattr(cycles, "denoiser"):
        cycles.denoiser = "OPENIMAGEDENOISE"
    if hasattr(cycles, "hair_shape"):
        cycles.hair_shape = "RIBBON"
    cycles.max_bounces, cycles.diffuse_bounces, cycles.glossy_bounces = 6, 2, 2
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.exposure, scene.view_settings.gamma = 0.0, 1.0
    render = scene.render
    render.resolution_x = render.resolution_y = args.res
    render.resolution_percentage = 100
    render.film_transparent = bool(args.transparent)
    render.image_settings.file_format = "PNG"
    render.image_settings.color_mode = "RGBA" if args.transparent else "RGB"
    render.image_settings.color_depth = "8"
    render.use_file_extension = False
    render.filepath = str(image)


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


def render_frame(scene, image):
    for backend in ("OPTIX", "CUDA", "CPU"):
        gpu = backend != "CPU"
        if gpu and not enable_gpu(backend):
            continue
        scene.cycles.device = "GPU" if gpu else "CPU"
        if hasattr(scene.cycles, "denoising_use_gpu"):
            scene.cycles.denoising_use_gpu = gpu
        print(f"CYCLES_DEVICE {backend}", flush=True)
        try:
            result = bpy.ops.render.render(write_still=True)
            if "FINISHED" not in result or not image.is_file():
                raise RuntimeError(f"PNG 저장을 확인할 수 없습니다. {image}")
            return
        except RuntimeError as error:
            if not gpu:
                raise
            print(f"CYCLES_RENDER_RETRY {backend} {error}", flush=True)


def main():
    started = time.perf_counter()
    args = parse_args()
    image, blend = output_paths(args)
    scene = bpy.context.scene
    for obj in tuple(scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    parent = bpy.data.objects.new("SYNK felt cube", None)
    scene.collection.objects.link(parent)
    shape = Shape(args.morph, args.squash)
    eyes = eye_groups(args)
    patch = []
    if args.patch:
        center, outline = coral_outline()
        patch = [Piece(center, 1.0, outline, 0.010, 0.15, 1.04)]
    masks = mask_groups(eyes + ([patch] if patch else []))

    base = wool_surface("Chocolate wool", args.body, 42.0, 0.009, (0.65, 1.14))
    body_shell(scene, parent, shape, base)
    short = wool_fiber("Chocolate mat fibers", args.body, (0.82, 1.39))
    long = wool_fiber("Chocolate flyaway fibers", args.body, (1.00, 1.54))
    body_hair(scene, parent, shape, masks, short, "Body mat", 112_000, MAT, args.seed)
    body_hair(scene, parent, shape, masks, long, "Body flyaways", 4_500, HALO, args.seed)

    if eyes:
        pieces = [piece for group in eyes for piece in group]
        base = wool_surface("Cream wool", args.eye, 76.0, 0.006, (0.87, 1.04))
        fibers = wool_fiber("Cream fibers", args.eye, (0.92, 1.07))
        cap_mesh(scene, parent, shape, pieces, base, "Eyes", 9)
        piece_hair(scene, parent, shape, pieces, fibers, "Eye fibers", 2_800, EYE, args.seed)
    if patch:
        base = wool_surface("Coral wool", args.accent, 88.0, 0.0045, (0.86, 1.05))
        fibers = wool_fiber("Coral fibers", args.accent, (0.90, 1.09))
        cap_mesh(scene, parent, shape, patch, base, "Coral triangle", 15)
        piece_hair(scene, parent, shape, patch, fibers, "Coral fibers", 4_300, CORAL, args.seed)

    make_world(scene, args.bg)
    camera_and_lights(scene, parent, args)
    configure_render(scene, args, image)
    render_frame(scene, image)
    if blend is not None:
        bpy.ops.wm.save_as_mainfile(filepath=str(blend), check_existing=False)
    print(f"RENDER_DONE {image} {time.perf_counter() - started:.2f}", flush=True)


if __name__ == "__main__":
    main()
