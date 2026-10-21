"""Deterministic, lightweight foliage replacement for build_scene.py.

In Blender, import this module and call ``improve_foliage(bpy.context.scene)``
after building/loading the base scene. Original garden objects are hidden,
not removed. Each replacement tree has one bark mesh and one leaf mesh.
"""

import math
import random

import bpy
from mathutils import Vector


def improve_foliage(scene):
    """Replace the base scene's ball-shaped foliage; return geometry counts.

    Uses only local procedural geometry. Repeated calls replace only objects
    owned by this module. Camera, lights, architecture and planters are intact.
    """
    owner = "synk_hero_foliage_v1"
    garden = scene.collection.children.get("04 Han river gardens")
    if garden is None:
        raise ValueError("The build_scene.py garden collection was not found")

    collection_name = "09 Hero natural foliage"
    collection = bpy.data.collections.get(collection_name)
    if collection is not None and collection.get("generator") != owner:
        raise ValueError("Foliage collection name belongs to another asset")
    if collection is None:
        collection = bpy.data.collections.new(collection_name)
        collection["generator"] = owner
    if collection.name not in scene.collection.children:
        scene.collection.children.link(collection)
    for obj in list(collection.objects):
        if obj.get("generator") != owner:
            continue
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if isinstance(data, bpy.types.Mesh) and data.users == 0:
            bpy.data.meshes.remove(data)

    hidden = 0
    prefixes = ("Soft garden foliage", "Leaf cluster", "Slender garden trunk",
                "Garden branch")
    # Blender's collection iterator can change as viewport visibility updates.
    # Freeze it first so every original tree part is processed exactly once.
    for obj in list(garden.all_objects):
        if obj.get("generator") == owner:
            continue
        name = obj.name.lower()
        if "planter" in name or "ornamental fine grass" in name:
            continue
        material_names = [slot.material.name for slot in obj.material_slots
                          if slot.material is not None]
        old_leaf_material = obj.type == "MESH" and any(
            value.startswith(("Foliage sage", "Blossom cream pink"))
            for value in material_names)
        old_branch_material = obj.type == "CURVE" and any(
            value.startswith("Tree bark") for value in material_names)
        if obj.name.startswith(prefixes) or old_leaf_material or old_branch_material:
            if "hero_foliage_previous_hide_render" not in obj:
                obj["hero_foliage_previous_hide_render"] = obj.hide_render
                obj["hero_foliage_previous_hide_viewport"] = obj.hide_viewport
            obj.hide_render = True
            obj.hide_viewport = True
            hidden += 1

    def material(name, color, roughness=.73, leaf=False):
        mat = bpy.data.materials.get(name)
        if mat is None:
            mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        shader = mat.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = (*color, 1)
        shader.inputs["Roughness"].default_value = roughness
        if leaf:
            shader.inputs["Subsurface Weight"].default_value = .025
            shader.inputs["Sheen Weight"].default_value = .12
        return mat

    leaves = [material("Hero leaf / " + name, color, leaf=True)
              for name, color in [
                  ("deep olive", (.055, .095, .023)),
                  ("forest", (.085, .155, .036)),
                  ("sage green", (.14, .22, .064)),
                  ("sunlit olive", (.235, .285, .081)),
                  ("young leaf", (.30, .36, .105)),
              ]]
    bark = material("Hero bark / warm grey", (.105, .077, .047), .91)
    petals = [material("Hero flower / ivory", (.82, .76, .63)),
              material("Hero flower / pale pink", (.72, .42, .40))]

    def mesh_object(name, vertices, faces, materials, indices=None, smooth=False):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        for mat in materials:
            mesh.materials.append(mat)
        for i, polygon in enumerate(mesh.polygons):
            polygon.use_smooth = smooth
            if indices is not None:
                polygon.material_index = indices[i]
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        obj["generator"] = owner
        return obj

    def perpendicular(direction):
        direction = direction.normalized()
        reference = Vector((0, 0, 1))
        if abs(direction.dot(reference)) > .93:
            reference = Vector((0, 1, 0))
        return direction.cross(reference).normalized()

    def tube(vertices, faces, points, radii, sides=5):
        """Append one tapered branch into a single pooled bark mesh."""
        first = len(vertices)
        for i, point in enumerate(points):
            tangent = points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]
            u = perpendicular(tangent)
            v = tangent.normalized().cross(u)
            for k in range(sides):
                angle = math.tau * k / sides
                vertices.append(tuple(point + radii[i] *
                                      (math.cos(angle) * u + math.sin(angle) * v)))
            if i:
                previous, current = first + (i - 1) * sides, first + i * sides
                for k in range(sides):
                    j = (k + 1) % sides
                    faces.append((previous + k, previous + j, current + j, current + k))
        faces.append(tuple(first + k for k in reversed(range(sides))))
        last = first + (len(points) - 1) * sides
        faces.append(tuple(last + k for k in range(sides)))

    def blade(vertices, faces, indices, root, direction, length, width, roll, mat):
        """A folded pointed leaf: five vertices, four triangles, no alpha map."""
        axis = direction.normalized()
        u = perpendicular(axis)
        v = axis.cross(u).normalized()
        side = u * math.cos(roll) + v * math.sin(roll)
        normal = axis.cross(side).normalized()
        center = root + axis * (length * .48)
        first = len(vertices)
        vertices.extend([tuple(root), tuple(center - side * width * .5),
                         tuple(root + axis * length + normal * length * .065),
                         tuple(center + side * width * .5),
                         tuple(center + normal * length * .075)])
        faces.extend([(first, first + 1, first + 4),
                      (first + 1, first + 2, first + 4),
                      (first + 2, first + 3, first + 4),
                      (first + 3, first, first + 4)])
        indices.extend([mat] * 4)

    def tree(index, x, y, ground, height, leaf_count, blossom=False):
        rng = random.Random(21263000 + index * 103)
        origin = Vector((x, y, ground))
        scale = height / 5
        bark_v, bark_f, leaf_v, leaf_f, leaf_m = [], [], [], [], []
        bend = Vector((rng.uniform(-.23, .23), rng.uniform(-.18, .18), 0))
        trunk = [origin + bend * (t * t) + Vector((0, 0, height * .88 * t))
                 for t in (0, .25, .5, .75, 1)]
        tube(bark_v, bark_f, trunk,
             [scale * r for r in (.105, .083, .059, .033, .010)], 7)
        shoots = []
        for k in range(12):
            angle = k * 2.399963 + rng.uniform(-.19, .19)
            radial = Vector((math.cos(angle), math.sin(angle), 0))
            side = Vector((-radial.y, radial.x, 0))
            level = k / 11
            stem_z = height * (.37 + .039 * k)
            stem = origin + bend * (stem_z / height) ** 2 + Vector((0, 0, stem_z))
            reach = height * (.275 - .09 * level) * rng.uniform(.9, 1.12)
            end = origin + radial * reach + Vector((0, 0, height * (.62 + .031 * k)))
            middle = stem.lerp(end, .54) - Vector((0, 0, height * .023))
            tube(bark_v, bark_f, [stem, middle, end],
                 [scale * .031, scale * .020, scale * .005])
            for j in range(5):
                t = .15 + .20 * j
                root = middle.lerp(end, t)
                fan = (j - 2) * .27 + rng.uniform(-.20, .20)
                extension = (radial * rng.uniform(.27, .46) + side * fan +
                             Vector((0, 0, rng.uniform(.06, .34)))) * scale
                tip = root + extension
                curve_mid = root.lerp(tip, .5) + Vector((0, 0, scale * .045))
                tube(bark_v, bark_f, [root, curve_mid, tip],
                     [scale * .007, scale * .004, scale * .0015])
                shoots.append((root, tip, side))

        for i in range(leaf_count):
            root, tip, side = shoots[i % len(shoots)]
            t = rng.uniform(.10, 1)
            point = root.lerp(tip, t)
            sign = -1 if (i // len(shoots)) % 2 else 1
            axis = (tip - root).normalized()
            spread = side * sign * rng.uniform(.65, 1.05)
            direction = (spread + axis * rng.uniform(.08, .7) +
                         Vector((0, 0, rng.uniform(-.42, .45)))).normalized()
            point += side * rng.uniform(-.032, .032) * scale
            point += Vector((0, 0, rng.uniform(-.025, .025))) * scale
            length = rng.uniform(.20, .29) * min(1.08, max(.80, scale))
            material_index = rng.choices(range(5), weights=(12, 29, 31, 20, 8))[0]
            blade(leaf_v, leaf_f, leaf_m, point, direction, length,
                  length * rng.uniform(.45, .64), rng.uniform(-.8, .8), material_index)

        bark_obj = mesh_object("Hero tree %02d / tapered branches" % index,
                               bark_v, bark_f, [bark], smooth=True)
        leaf_obj = mesh_object("Hero tree %02d / individual leaves" % index,
                               leaf_v, leaf_f, leaves, leaf_m)
        leaf_obj["leaf_count"] = leaf_count
        leaf_obj["seed"] = 21263000 + index * 103
        bark_obj["base_location"] = [x, y, ground]
        if blossom:
            flower_v, flower_f, flower_m = [], [], []
            for n in range(100):
                root, tip, _ = shoots[n % len(shoots)]
                center = root.lerp(tip, rng.uniform(.55, 1.06))
                for petal in range(5):
                    a = petal * math.tau / 5 + n
                    direction = Vector((math.cos(a), math.sin(a), .18))
                    blade(flower_v, flower_f, flower_m, center, direction,
                          .055 * scale, .047 * scale, 0, n % 2)
            mesh_object("Hero tree %02d / scattered blossom" % index,
                        flower_v, flower_f, petals, flower_m)
        return leaf_count

    specifications = [
        (-9, -5, .59, 5.2, 1600, False),
        (-10, 2, .59, 6.4, 1800, False),
        (9, 1, .59, 4.5, 1500, False),
        (8, 7, .59, 5, 1600, False),
        (-11, -14, .59, 5.4, 1700, False),
        (11, 14, .59, 5, 1500, False),
    ]
    specifications.extend((x, 2.6, 14.65, 2.7, 1100, False)
                          for x in (-5.4, -1.8, 1.8, 5.4))
    specifications.extend((13, y, -.02, 4.2, 1000, y % 2 == 1)
                          for y in (15, 24, 33, 43, 56, 67))
    total_leaves = sum(tree(i, *spec) for i, spec in enumerate(specifications))

    # Low planting fills the existing entry planters, leaving their rims visible.
    rng = random.Random(21269901)
    shrub_v, shrub_f, shrub_m = [], [], []
    for x, y in ((-6.1, -8), (6.1, -8), (-7.9, -10.4), (8.6, -11.5)):
        for i in range(350):
            root = Vector((x + rng.uniform(-1.02, 1.02),
                           y + rng.uniform(-.45, .45), .69))
            angle = rng.uniform(0, math.tau)
            direction = Vector((math.cos(angle), math.sin(angle), rng.uniform(.3, 1.8)))
            blade(shrub_v, shrub_f, shrub_m, root, direction,
                  rng.uniform(.20, .44), rng.uniform(.045, .085),
                  rng.uniform(-.55, .55), rng.randrange(5))
    mesh_object("Hero entry planters / fine leaf undergrowth", shrub_v,
                shrub_f, leaves, shrub_m)

    summary = {"tree_count": len(specifications), "tree_leaf_count": total_leaves,
               "undergrowth_leaf_count": 1400, "hidden_original_objects": hidden,
               "generated_objects": len(collection.objects),
               "vertices": sum(len(o.data.vertices) for o in collection.objects
                               if o.type == "MESH")}
    scene["hero_foliage_generator"] = owner
    return summary
