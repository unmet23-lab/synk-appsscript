import bpy
import math
from mathutils import Vector


def srgb_to_linear(c):
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(h):
    h = h.lstrip('#')
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b))


def rgba_linear(h, a=1.0):
    r, g, b = hex_to_linear(h)
    return (r, g, b, a)


def _new_proc_mat(name):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (600, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (300, 0)
    # CRITICAL: During diffuse baking in Cycles, Principled BSDF multiplies diffuse by (1 - Metallic).
    # Keep Metallic = 0.0 on all procedural bake materials so their full diffuse albedo is baked.
    bsdf.inputs["Metallic"].default_value = 0.0
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat, nt, bsdf


def _add_world_coord(nt, scale=(1.0, 1.0, 1.0)):
    geom = nt.nodes.new("ShaderNodeNewGeometry")
    geom.location = (-900, 0)
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.location = (-700, 0)
    mapping.inputs["Scale"].default_value = scale
    nt.links.new(geom.outputs["Position"], mapping.inputs["Vector"])
    return geom, mapping


def _add_vertex_color_multiply(nt, base_socket, color_node_loc=(-200, 200)):
    vcol = nt.nodes.new("ShaderNodeVertexColor")
    vcol.layer_name = "Color"
    vcol.location = (color_node_loc[0] - 200, color_node_loc[1])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs["Factor"].default_value = 1.0
    mix.location = color_node_loc
    nt.links.new(base_socket, mix.inputs[6])
    nt.links.new(vcol.outputs["Color"], mix.inputs[7])
    return mix.outputs[2]


def _add_bump(nt, bsdf, height_socket, strength=0.08, distance=0.008):
    bump = nt.nodes.new("ShaderNodeBump")
    bump.location = (80, -180)
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    nt.links.new(height_socket, bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return bump


def build_procedural_materials():
    """
    Creates all procedural Cycles materials matching v20 day-materials.mjs palettes
    with refined surface grain (wood grain, lime plaster, dressed limestone, slate ribs,
    woven cotton, ceramic glaze, brushed metal/brass, greenhouse steel frame, garden soil).
    """
    mats = {}

    # 1. proc_wood: Warm oak timber (#ba9566 .. #ceb083), multiplied by vertex Color
    mat, nt, bsdf = _new_proc_mat("proc_wood")
    bsdf.inputs["Roughness"].default_value = 0.86
    _, mapping = _add_world_coord(nt, scale=(2.5, 14.0, 6.0))
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'X'
    wave.wave_profile = 'SIN'
    wave.inputs["Scale"].default_value = 4.2
    wave.inputs["Distortion"].default_value = 3.6
    wave.inputs["Detail"].default_value = 3.0
    wave.inputs["Detail Scale"].default_value = 2.0
    nt.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 18.0
    noise.inputs["Detail"].default_value = 4.0
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    mix_grain = nt.nodes.new("ShaderNodeMix")
    mix_grain.data_type = 'FLOAT'
    mix_grain.inputs["Factor"].default_value = 0.35
    nt.links.new(wave.outputs["Fac"], mix_grain.inputs[2])
    nt.links.new(noise.outputs["Fac"], mix_grain.inputs[3])

    col_wood = nt.nodes.new("ShaderNodeMix")
    col_wood.data_type = 'RGBA'
    col_wood.inputs[6].default_value = rgba_linear("#ba9566")
    col_wood.inputs[7].default_value = rgba_linear("#ceb083")
    nt.links.new(mix_grain.outputs[0], col_wood.inputs["Factor"])

    final_col = _add_vertex_color_multiply(nt, col_wood.outputs[2])
    nt.links.new(final_col, bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, mix_grain.outputs[0], strength=0.06, distance=0.004)
    mats['proc_wood'] = mat

    # 2. proc_dark_wood: Aged walnut / dark structural timber (#64513c .. #7a664e)
    mat, nt, bsdf = _new_proc_mat("proc_dark_wood")
    bsdf.inputs["Roughness"].default_value = 0.88
    _, mapping = _add_world_coord(nt, scale=(3.0, 12.0, 6.0))
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'X'
    wave.inputs["Scale"].default_value = 4.5
    wave.inputs["Distortion"].default_value = 3.2
    wave.inputs["Detail"].default_value = 3.0
    nt.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])

    col_dw = nt.nodes.new("ShaderNodeMix")
    col_dw.data_type = 'RGBA'
    col_dw.inputs[6].default_value = rgba_linear("#64513c")
    col_dw.inputs[7].default_value = rgba_linear("#7a664e")
    nt.links.new(wave.outputs["Fac"], col_dw.inputs["Factor"])

    final_col = _add_vertex_color_multiply(nt, col_dw.outputs[2])
    nt.links.new(final_col, bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, wave.outputs["Fac"], strength=0.07, distance=0.004)
    mats['proc_dark_wood'] = mat

    # 3. proc_plaster: Warm cream-white lime plaster (#e5e4dc .. #f1f0e9)
    mat, nt, bsdf = _new_proc_mat("proc_plaster")
    bsdf.inputs["Roughness"].default_value = 0.94
    _, mapping = _add_world_coord(nt, scale=(6.0, 6.0, 6.0))
    noise1 = nt.nodes.new("ShaderNodeTexNoise")
    noise1.inputs["Scale"].default_value = 4.5
    noise1.inputs["Detail"].default_value = 5.0
    noise1.inputs["Roughness"].default_value = 0.65
    nt.links.new(mapping.outputs["Vector"], noise1.inputs["Vector"])

    col_pl = nt.nodes.new("ShaderNodeMix")
    col_pl.data_type = 'RGBA'
    col_pl.inputs[6].default_value = rgba_linear("#e5e4dc")
    col_pl.inputs[7].default_value = rgba_linear("#f1f0e9")
    nt.links.new(noise1.outputs["Fac"], col_pl.inputs["Factor"])
    nt.links.new(col_pl.outputs[2], bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, noise1.outputs["Fac"], strength=0.05, distance=0.003)
    mats['proc_plaster'] = mat

    # 3b. proc_home_plaster: Home lime plaster (#f4f5f1 -> #eceee9 .. #f7f8f4)
    mat, nt, bsdf = _new_proc_mat("proc_home_plaster")
    bsdf.inputs["Roughness"].default_value = 0.94
    _, mapping = _add_world_coord(nt, scale=(6.0, 6.0, 6.0))
    noise_hp = nt.nodes.new("ShaderNodeTexNoise")
    noise_hp.inputs["Scale"].default_value = 4.5
    noise_hp.inputs["Detail"].default_value = 5.0
    noise_hp.inputs["Roughness"].default_value = 0.65
    nt.links.new(mapping.outputs["Vector"], noise_hp.inputs["Vector"])

    col_hp = nt.nodes.new("ShaderNodeMix")
    col_hp.data_type = 'RGBA'
    col_hp.inputs[6].default_value = rgba_linear("#eceee9")
    col_hp.inputs[7].default_value = rgba_linear("#f7f8f4")
    nt.links.new(noise_hp.outputs["Fac"], col_hp.inputs["Factor"])
    nt.links.new(col_hp.outputs[2], bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, noise_hp.outputs["Fac"], strength=0.05, distance=0.003)
    mats['proc_home_plaster'] = mat

    # 3c. proc_workshop_plaster: Workshop lime plaster (#eff1ed -> #e7eae5 .. #f3f5f1)
    mat, nt, bsdf = _new_proc_mat("proc_workshop_plaster")
    bsdf.inputs["Roughness"].default_value = 0.94
    _, mapping = _add_world_coord(nt, scale=(6.0, 6.0, 6.0))
    noise_wp = nt.nodes.new("ShaderNodeTexNoise")
    noise_wp.inputs["Scale"].default_value = 4.5
    noise_wp.inputs["Detail"].default_value = 5.0
    noise_wp.inputs["Roughness"].default_value = 0.65
    nt.links.new(mapping.outputs["Vector"], noise_wp.inputs["Vector"])

    col_wp = nt.nodes.new("ShaderNodeMix")
    col_wp.data_type = 'RGBA'
    col_wp.inputs[6].default_value = rgba_linear("#e7eae5")
    col_wp.inputs[7].default_value = rgba_linear("#f3f5f1")
    nt.links.new(noise_wp.outputs["Fac"], col_wp.inputs["Factor"])
    nt.links.new(col_wp.outputs[2], bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, noise_wp.outputs["Fac"], strength=0.05, distance=0.003)
    mats['proc_workshop_plaster'] = mat

    # 4. proc_interior_plaster: Shaded warm interior wall (#897b64)
    mat, nt, bsdf = _new_proc_mat("proc_interior_plaster")
    bsdf.inputs["Roughness"].default_value = 0.95
    _, mapping = _add_world_coord(nt, scale=(5.0, 5.0, 5.0))
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 6.0
    noise.inputs["Detail"].default_value = 3.0
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    col_ip = nt.nodes.new("ShaderNodeMix")
    col_ip.data_type = 'RGBA'
    col_ip.inputs[6].default_value = rgba_linear("#82745e")
    col_ip.inputs[7].default_value = rgba_linear("#90826b")
    nt.links.new(noise.outputs["Fac"], col_ip.inputs["Factor"])
    nt.links.new(col_ip.outputs[2], bsdf.inputs["Base Color"])
    mats['proc_interior_plaster'] = mat

    # 5. proc_glass_backing: Deep warm interior shadow backing (#433f36)
    mat, nt, bsdf = _new_proc_mat("proc_glass_backing")
    bsdf.inputs["Roughness"].default_value = 0.96
    bsdf.inputs["Base Color"].default_value = rgba_linear("#433f36")
    mats['proc_glass_backing'] = mat

    # 6. proc_stone: Dressed limestone piers & curbs (#d3d6d0 .. #e2e5df)
    mat, nt, bsdf = _new_proc_mat("proc_stone")
    bsdf.inputs["Roughness"].default_value = 0.93
    _, mapping = _add_world_coord(nt, scale=(5.0, 5.0, 5.0))
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 8.0
    noise.inputs["Detail"].default_value = 5.0
    noise.inputs["Roughness"].default_value = 0.6
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    col_st = nt.nodes.new("ShaderNodeMix")
    col_st.data_type = 'RGBA'
    col_st.inputs[6].default_value = rgba_linear("#d3d6d0")
    col_st.inputs[7].default_value = rgba_linear("#e2e5df")
    nt.links.new(noise.outputs["Fac"], col_st.inputs["Factor"])
    final_col = _add_vertex_color_multiply(nt, col_st.outputs[2])
    nt.links.new(final_col, bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, noise.outputs["Fac"], strength=0.07, distance=0.005)
    mats['proc_stone'] = mat

    # 7. proc_paving: Courtyard limestone flagstones (#c9cdc7 .. #d3d7d1, mean #ced2cc)
    mat, nt, bsdf = _new_proc_mat("proc_paving")
    bsdf.inputs["Roughness"].default_value = 0.92
    _, mapping = _add_world_coord(nt, scale=(3.5, 3.5, 3.5))
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 7.0
    noise.inputs["Detail"].default_value = 4.0
    noise.inputs["Roughness"].default_value = 0.55
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    col_pv = nt.nodes.new("ShaderNodeMix")
    col_pv.data_type = 'RGBA'
    col_pv.inputs[6].default_value = rgba_linear("#c9cdc7")
    col_pv.inputs[7].default_value = rgba_linear("#d3d7d1")
    nt.links.new(noise.outputs["Fac"], col_pv.inputs["Factor"])
    final_col = _add_vertex_color_multiply(nt, col_pv.outputs[2])
    nt.links.new(final_col, bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, noise.outputs["Fac"], strength=0.04, distance=0.003)
    mats['proc_paving'] = mat

    # 8. proc_mortar: Recessed lime mortar joints (#d4d0c7)
    mat, nt, bsdf = _new_proc_mat("proc_mortar")
    bsdf.inputs["Roughness"].default_value = 0.96
    _, mapping = _add_world_coord(nt, scale=(8.0, 8.0, 8.0))
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 12.0
    noise.inputs["Detail"].default_value = 4.0
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    col_mt = nt.nodes.new("ShaderNodeMix")
    col_mt.data_type = 'RGBA'
    col_mt.inputs[6].default_value = rgba_linear("#ccc8bf")
    col_mt.inputs[7].default_value = rgba_linear("#dbd7ce")
    nt.links.new(noise.outputs["Fac"], col_mt.inputs["Factor"])
    nt.links.new(col_mt.outputs[2], bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, noise.outputs["Fac"], strength=0.06, distance=0.003)
    mats['proc_mortar'] = mat

    # 9. proc_gravel: Compacted river gravel path (#b0a189 .. #c2b39b, mean #b9aa92)
    mat, nt, bsdf = _new_proc_mat("proc_gravel")
    bsdf.inputs["Roughness"].default_value = 0.95
    _, mapping = _add_world_coord(nt, scale=(10.0, 10.0, 10.0))
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 14.0
    vor.inputs["Randomness"].default_value = 0.85
    nt.links.new(mapping.outputs["Vector"], vor.inputs["Vector"])

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 8.0
    noise.inputs["Detail"].default_value = 4.0
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    mix_g = nt.nodes.new("ShaderNodeMix")
    mix_g.data_type = 'FLOAT'
    mix_g.inputs["Factor"].default_value = 0.5
    nt.links.new(vor.outputs["Distance"], mix_g.inputs[2])
    nt.links.new(noise.outputs["Fac"], mix_g.inputs[3])

    col_gr = nt.nodes.new("ShaderNodeMix")
    col_gr.data_type = 'RGBA'
    col_gr.inputs[6].default_value = rgba_linear("#b0a189")
    col_gr.inputs[7].default_value = rgba_linear("#c2b39b")
    nt.links.new(mix_g.outputs[0], col_gr.inputs["Factor"])
    nt.links.new(col_gr.outputs[2], bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, mix_g.outputs[0], strength=0.08, distance=0.004)
    mats['proc_gravel'] = mat

    # 10. proc_lawn: Uses vertex Color (which encodes exact terrainColor * grassMap mean)
    mat, nt, bsdf = _new_proc_mat("proc_lawn")
    bsdf.inputs["Roughness"].default_value = 0.98
    _, mapping = _add_world_coord(nt, scale=(12.0, 12.0, 12.0))
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Detail"].default_value = 3.0
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    col_lw = nt.nodes.new("ShaderNodeMix")
    col_lw.data_type = 'RGBA'
    col_lw.inputs[6].default_value = (0.97, 0.97, 0.97, 1.0)
    col_lw.inputs[7].default_value = (1.03, 1.03, 1.03, 1.0)
    nt.links.new(noise.outputs["Fac"], col_lw.inputs["Factor"])
    final_col = _add_vertex_color_multiply(nt, col_lw.outputs[2])
    nt.links.new(final_col, bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, noise.outputs["Fac"], strength=0.03, distance=0.002)
    mats['proc_lawn'] = mat

    # 11. proc_roof_slate: Deep blue-grey ceramic/slate roof (#374450 .. #455462, mean #3e4c59)
    mat, nt, bsdf = _new_proc_mat("proc_roof_slate")
    bsdf.inputs["Roughness"].default_value = 0.78
    _, mapping = _add_world_coord(nt, scale=(6.0, 6.0, 6.0))
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 10.0
    noise.inputs["Detail"].default_value = 4.0
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    col_rf = nt.nodes.new("ShaderNodeMix")
    col_rf.data_type = 'RGBA'
    col_rf.inputs[6].default_value = rgba_linear("#374450")
    col_rf.inputs[7].default_value = rgba_linear("#455462")
    nt.links.new(noise.outputs["Fac"], col_rf.inputs["Factor"])
    nt.links.new(col_rf.outputs[2], bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, noise.outputs["Fac"], strength=0.05, distance=0.003)
    mats['proc_roof_slate'] = mat

    # 12. proc_cotton_white: Warm cream woven cotton (#ede6da .. #f8f3e9)
    mat, nt, bsdf = _new_proc_mat("proc_cotton_white")
    bsdf.inputs["Roughness"].default_value = 0.92
    _, mapping = _add_world_coord(nt, scale=(24.0, 24.0, 24.0))
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = 'BANDS'
    wave.inputs["Scale"].default_value = 8.0
    wave.inputs["Distortion"].default_value = 0.8
    nt.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])

    col_cw = nt.nodes.new("ShaderNodeMix")
    col_cw.data_type = 'RGBA'
    col_cw.inputs[6].default_value = rgba_linear("#ede6da")
    col_cw.inputs[7].default_value = rgba_linear("#f8f3e9")
    nt.links.new(wave.outputs["Fac"], col_cw.inputs["Factor"])
    nt.links.new(col_cw.outputs[2], bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, wave.outputs["Fac"], strength=0.04, distance=0.002)
    mats['proc_cotton_white'] = mat

    # 13. proc_cotton_lapis: Lapis banner/book cloth (#335373 .. #3e6286)
    mat, nt, bsdf = _new_proc_mat("proc_cotton_lapis")
    bsdf.inputs["Roughness"].default_value = 0.90
    _, mapping = _add_world_coord(nt, scale=(24.0, 24.0, 24.0))
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = 'BANDS'
    wave.inputs["Scale"].default_value = 8.0
    wave.inputs["Distortion"].default_value = 0.8
    nt.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])

    col_cl = nt.nodes.new("ShaderNodeMix")
    col_cl.data_type = 'RGBA'
    col_cl.inputs[6].default_value = rgba_linear("#335373")
    col_cl.inputs[7].default_value = rgba_linear("#3e6286")
    nt.links.new(wave.outputs["Fac"], col_cl.inputs["Factor"])
    nt.links.new(col_cl.outputs[2], bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, wave.outputs["Fac"], strength=0.04, distance=0.002)
    mats['proc_cotton_lapis'] = mat

    # 14. proc_paper: Warm handmade paper (#f6efe2)
    mat, nt, bsdf = _new_proc_mat("proc_paper")
    bsdf.inputs["Roughness"].default_value = 0.92
    bsdf.inputs["Base Color"].default_value = rgba_linear("#f6efe2")
    mats['proc_paper'] = mat

    # 15. proc_ceramic: Glazed cream-white stoneware/porcelain (#e7e6e0 .. #f1f0eb)
    mat, nt, bsdf = _new_proc_mat("proc_ceramic")
    bsdf.inputs["Roughness"].default_value = 0.34
    _, mapping = _add_world_coord(nt, scale=(8.0, 8.0, 8.0))
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 10.0
    noise.inputs["Detail"].default_value = 2.0
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    col_ce = nt.nodes.new("ShaderNodeMix")
    col_ce.data_type = 'RGBA'
    col_ce.inputs[6].default_value = rgba_linear("#e7e6e0")
    col_ce.inputs[7].default_value = rgba_linear("#f1f0eb")
    nt.links.new(noise.outputs["Fac"], col_ce.inputs["Factor"])
    nt.links.new(col_ce.outputs[2], bsdf.inputs["Base Color"])
    mats['proc_ceramic'] = mat

    # 16. proc_tea: Warm amber-green tea infusion (#b68f52)
    mat, nt, bsdf = _new_proc_mat("proc_tea")
    bsdf.inputs["Roughness"].default_value = 0.20
    bsdf.inputs["Base Color"].default_value = rgba_linear("#b68f52")
    mats['proc_tea'] = mat

    # 17. proc_metal: Dark pewter / iron (#6c7075)
    mat, nt, bsdf = _new_proc_mat("proc_metal")
    bsdf.inputs["Roughness"].default_value = 0.52
    bsdf.inputs["Base Color"].default_value = rgba_linear("#6c7075")
    mats['proc_metal'] = mat

    # 18. proc_brass: Warm aged brass (#b89258)
    mat, nt, bsdf = _new_proc_mat("proc_brass")
    bsdf.inputs["Roughness"].default_value = 0.42
    bsdf.inputs["Base Color"].default_value = rgba_linear("#b89258")
    mats['proc_brass'] = mat

    # 19. proc_butter: Warm lantern globe (#f5e2b0)
    mat, nt, bsdf = _new_proc_mat("proc_butter")
    bsdf.inputs["Roughness"].default_value = 0.35
    bsdf.inputs["Base Color"].default_value = rgba_linear("#f5e2b0")
    mats['proc_butter'] = mat

    # 20. proc_stem & proc_foliage
    mat, nt, bsdf = _new_proc_mat("proc_stem")
    bsdf.inputs["Roughness"].default_value = 0.90
    bsdf.inputs["Base Color"].default_value = rgba_linear("#526646")
    mats['proc_stem'] = mat

    mat, nt, bsdf = _new_proc_mat("proc_foliage")
    bsdf.inputs["Roughness"].default_value = 0.88
    vcol = nt.nodes.new("ShaderNodeVertexColor")
    vcol.layer_name = "Color"
    nt.links.new(vcol.outputs["Color"], bsdf.inputs["Base Color"])
    mats['proc_foliage'] = mat

    # 21. proc_shutters: Soft sage-grey painted door/shutter wood (#d8dfd9 -> #cfd7d1 .. #dfe6e0)
    mat, nt, bsdf = _new_proc_mat("proc_shutters")
    bsdf.inputs["Roughness"].default_value = 0.84
    _, mapping = _add_world_coord(nt, scale=(3.0, 12.0, 6.0))
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'X'
    wave.inputs["Scale"].default_value = 4.8
    wave.inputs["Distortion"].default_value = 2.5
    nt.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])
    col_sh = nt.nodes.new("ShaderNodeMix")
    col_sh.data_type = 'RGBA'
    col_sh.inputs[6].default_value = rgba_linear("#cfd7d1")
    col_sh.inputs[7].default_value = rgba_linear("#dfe6e0")
    nt.links.new(wave.outputs["Fac"], col_sh.inputs["Factor"])
    final_col = _add_vertex_color_multiply(nt, col_sh.outputs[2])
    nt.links.new(final_col, bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, wave.outputs["Fac"], strength=0.05, distance=0.003)
    mats['proc_shutters'] = mat

    # 22. proc_coral: Warm coral enamel / terracotta (#d87c6c -> #cf7363 .. #e08575)
    mat, nt, bsdf = _new_proc_mat("proc_coral")
    bsdf.inputs["Roughness"].default_value = 0.56
    _, mapping = _add_world_coord(nt, scale=(8.0, 8.0, 8.0))
    noise_co = nt.nodes.new("ShaderNodeTexNoise")
    noise_co.inputs["Scale"].default_value = 10.0
    noise_co.inputs["Detail"].default_value = 3.0
    nt.links.new(mapping.outputs["Vector"], noise_co.inputs["Vector"])
    col_co = nt.nodes.new("ShaderNodeMix")
    col_co.data_type = 'RGBA'
    col_co.inputs[6].default_value = rgba_linear("#cf7363")
    col_co.inputs[7].default_value = rgba_linear("#e08575")
    nt.links.new(noise_co.outputs["Fac"], col_co.inputs["Factor"])
    nt.links.new(col_co.outputs[2], bsdf.inputs["Base Color"])
    mats['proc_coral'] = mat

    # 23. proc_frame: Greenhouse dark blue-slate steel frame (#3c4b57 -> #364450 .. #435360)
    mat, nt, bsdf = _new_proc_mat("proc_frame")
    bsdf.inputs["Roughness"].default_value = 0.62
    _, mapping = _add_world_coord(nt, scale=(8.0, 8.0, 8.0))
    noise_fr = nt.nodes.new("ShaderNodeTexNoise")
    noise_fr.inputs["Scale"].default_value = 14.0
    noise_fr.inputs["Detail"].default_value = 3.0
    nt.links.new(mapping.outputs["Vector"], noise_fr.inputs["Vector"])
    col_fr = nt.nodes.new("ShaderNodeMix")
    col_fr.data_type = 'RGBA'
    col_fr.inputs[6].default_value = rgba_linear("#364450")
    col_fr.inputs[7].default_value = rgba_linear("#435360")
    nt.links.new(noise_fr.outputs["Fac"], col_fr.inputs["Factor"])
    final_col = _add_vertex_color_multiply(nt, col_fr.outputs[2])
    nt.links.new(final_col, bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, noise_fr.outputs["Fac"], strength=0.04, distance=0.002)
    mats['proc_frame'] = mat

    # 24. proc_soil: Rich garden soil (#7f6b56 -> #75624e .. #88735d), multiplied by vertex Color
    mat, nt, bsdf = _new_proc_mat("proc_soil")
    bsdf.inputs["Roughness"].default_value = 0.96
    _, mapping = _add_world_coord(nt, scale=(12.0, 12.0, 12.0))
    noise_so = nt.nodes.new("ShaderNodeTexNoise")
    noise_so.inputs["Scale"].default_value = 14.0
    noise_so.inputs["Detail"].default_value = 5.0
    nt.links.new(mapping.outputs["Vector"], noise_so.inputs["Vector"])
    col_so = nt.nodes.new("ShaderNodeMix")
    col_so.data_type = 'RGBA'
    col_so.inputs[6].default_value = rgba_linear("#75624e")
    col_so.inputs[7].default_value = rgba_linear("#88735d")
    nt.links.new(noise_so.outputs["Fac"], col_so.inputs["Factor"])
    final_col = _add_vertex_color_multiply(nt, col_so.outputs[2])
    nt.links.new(final_col, bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, noise_so.outputs["Fac"], strength=0.09, distance=0.005)
    mats['proc_soil'] = mat

    # 25. proc_soil_vcol: For ground soilPocket meshes whose vertex Color already stores the full soil-to-lawn blend
    mat, nt, bsdf = _new_proc_mat("proc_soil_vcol")
    bsdf.inputs["Roughness"].default_value = 0.96
    _, mapping = _add_world_coord(nt, scale=(12.0, 12.0, 12.0))
    noise_sv = nt.nodes.new("ShaderNodeTexNoise")
    noise_sv.inputs["Scale"].default_value = 14.0
    noise_sv.inputs["Detail"].default_value = 4.0
    nt.links.new(mapping.outputs["Vector"], noise_sv.inputs["Vector"])
    col_sv = nt.nodes.new("ShaderNodeMix")
    col_sv.data_type = 'RGBA'
    col_sv.inputs[6].default_value = (0.94, 0.94, 0.94, 1.0)
    col_sv.inputs[7].default_value = (1.06, 1.06, 1.06, 1.0)
    nt.links.new(noise_sv.outputs["Fac"], col_sv.inputs["Factor"])
    final_col = _add_vertex_color_multiply(nt, col_sv.outputs[2])
    nt.links.new(final_col, bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, noise_sv.outputs["Fac"], strength=0.07, distance=0.004)
    mats['proc_soil_vcol'] = mat

    # 26. proc_pebble: River/pond pebbles (#b9b2a4 * vertex Color)
    mat, nt, bsdf = _new_proc_mat("proc_pebble")
    bsdf.inputs["Roughness"].default_value = 0.88
    _, mapping = _add_world_coord(nt, scale=(10.0, 10.0, 10.0))
    noise_pb = nt.nodes.new("ShaderNodeTexNoise")
    noise_pb.inputs["Scale"].default_value = 12.0
    noise_pb.inputs["Detail"].default_value = 4.0
    nt.links.new(mapping.outputs["Vector"], noise_pb.inputs["Vector"])
    col_pb = nt.nodes.new("ShaderNodeMix")
    col_pb.data_type = 'RGBA'
    col_pb.inputs[6].default_value = rgba_linear("#b1aa9c")
    col_pb.inputs[7].default_value = rgba_linear("#c1baac")
    nt.links.new(noise_pb.outputs["Fac"], col_pb.inputs["Factor"])
    final_col = _add_vertex_color_multiply(nt, col_pb.outputs[2])
    nt.links.new(final_col, bsdf.inputs["Base Color"])
    _add_bump(nt, bsdf, noise_pb.outputs["Fac"], strength=0.06, distance=0.004)
    mats['proc_pebble'] = mat

    # 27. live_glass: Real-time glass material (#bedbd5, roughness 0.1, opacity 0.29)
    mat, nt, bsdf = _new_proc_mat("live_glass")
    bsdf.inputs["Base Color"].default_value = rgba_linear("#bedbd5")
    bsdf.inputs["Roughness"].default_value = 0.10
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Alpha"].default_value = 0.29
    if hasattr(mat, "blend_method"):
        mat.blend_method = 'BLEND'
    if hasattr(mat, "surface_render_method"):
        mat.surface_render_method = 'BLENDED'
    mats['live_glass'] = mat

    return mats


def setup_lighting_and_world(sky_img_path, sun_only=False):
    """
    Configures the scene lighting according to 자산규격.md Section 5:
    - Main Sun: #fff3de, strength 3.15, direction toward sun = (-9, -7, 11) normalized, angle 1.5 deg
    - Fill Sun: #cddfff, strength 0.18, direction toward fill = (8, 10, 4) normalized
    - World Shader:
      - Hemisphere light: upper #d8eaff * 0.58/pi, lower #71815e * 0.58/pi (linear)
      - Environment texture: sky/azure-sky-v3.jpg (sRGB) * 0.45, Z-axis rotation 0.65 rad
    If sun_only=True, Fill Sun and World strength are set to 0.0 so only Main Sun direct light is baked.
    """
    scene = bpy.context.scene

    for obj in list(bpy.data.objects):
        if obj.type == 'LIGHT':
            bpy.data.objects.remove(obj, do_unlink=True)

    # 1. Main Sun
    sun_data = bpy.data.lights.new(name="sun_main", type='SUN')
    sun_data.color = hex_to_linear("#fff3de")
    sun_data.energy = 3.15
    sun_data.angle = math.radians(1.5)
    sun_obj = bpy.data.objects.new(name="sun_main", object_data=sun_data)
    scene.collection.objects.link(sun_obj)
    dir_to_sun = Vector((-9.0, -7.0, 11.0)).normalized()
    sun_obj.rotation_mode = 'QUATERNION'
    sun_obj.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(dir_to_sun)

    # 2. Fill Sun
    fill_data = bpy.data.lights.new(name="sun_fill", type='SUN')
    fill_data.color = hex_to_linear("#cddfff")
    fill_data.energy = 0.0 if sun_only else 0.18
    fill_data.angle = math.radians(5.0)
    fill_obj = bpy.data.objects.new(name="sun_fill", object_data=fill_data)
    scene.collection.objects.link(fill_obj)
    dir_to_fill = Vector((8.0, 10.0, 4.0)).normalized()
    fill_obj.rotation_mode = 'QUATERNION'
    fill_obj.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(dir_to_fill)

    # 3. World Shader
    world = scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
        scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputWorld")
    out.location = (600, 0)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.location = (350, 0)
    bg.inputs["Strength"].default_value = 0.0 if sun_only else 1.0
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])

    tex_coord = nt.nodes.new("ShaderNodeTexCoord")
    tex_coord.location = (-800, 0)
    sep_xyz = nt.nodes.new("ShaderNodeSeparateXYZ")
    sep_xyz.location = (-550, 200)
    nt.links.new(tex_coord.outputs["Generated"], sep_xyz.inputs["Vector"])

    greater_z = nt.nodes.new("ShaderNodeMath")
    greater_z.operation = 'GREATER_THAN'
    greater_z.inputs[1].default_value = 0.0
    greater_z.location = (-350, 200)
    nt.links.new(sep_xyz.outputs["Z"], greater_z.inputs[0])

    hemi_scale = 0.58 / math.pi
    sky_r, sky_g, sky_b = hex_to_linear("#d8eaff")
    gnd_r, gnd_g, gnd_b = hex_to_linear("#71815e")

    mix_hemi = nt.nodes.new("ShaderNodeMix")
    mix_hemi.data_type = 'RGBA'
    mix_hemi.location = (-120, 200)
    mix_hemi.inputs[6].default_value = (gnd_r * hemi_scale, gnd_g * hemi_scale, gnd_b * hemi_scale, 1.0)
    mix_hemi.inputs[7].default_value = (sky_r * hemi_scale, sky_g * hemi_scale, sky_b * hemi_scale, 1.0)
    nt.links.new(greater_z.outputs["Value"], mix_hemi.inputs["Factor"])

    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.location = (-550, -150)
    mapping.inputs["Rotation"].default_value = (0.0, 0.0, 0.65)
    nt.links.new(tex_coord.outputs["Generated"], mapping.inputs["Vector"])

    env_tex = nt.nodes.new("ShaderNodeTexEnvironment")
    env_tex.location = (-320, -150)
    img = bpy.data.images.load(sky_img_path, check_existing=True)
    img.colorspace_settings.name = 'sRGB'
    env_tex.image = img
    nt.links.new(mapping.outputs["Vector"], env_tex.inputs["Vector"])

    mul_env = nt.nodes.new("ShaderNodeVectorMath")
    mul_env.operation = 'SCALE'
    mul_env.inputs["Scale"].default_value = 0.45
    mul_env.location = (-80, -150)
    nt.links.new(env_tex.outputs["Color"], mul_env.inputs[0])

    add_world = nt.nodes.new("ShaderNodeVectorMath")
    add_world.operation = 'ADD'
    add_world.location = (150, 50)
    nt.links.new(mix_hemi.outputs[2], add_world.inputs[0])
    nt.links.new(mul_env.outputs["Vector"], add_world.inputs[1])
    nt.links.new(add_world.outputs["Vector"], bg.inputs["Color"])

    return sun_obj, fill_obj
