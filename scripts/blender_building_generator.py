"""
Blender 3D Building Model Generator — Headless Script for MutuneRent Pro
Usage:
  blender --background --python scripts/blender_building_generator.py -- --floors 5 --units 20 --output frontend/public/models/building_custom.glb
"""

import sys
import argparse
import os

try:
    import bpy
    import mathutils
except ImportError:
    print("[ERROR] This script must be run inside Blender's Python environment:")
    print("        blender --background --python scripts/blender_building_generator.py -- <args>")
    sys.exit(1)


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    parser = argparse.ArgumentParser(description="Generate 3D Architectural Building GLB")
    parser.add_argument("--floors", type=int, default=4, help="Number of floors")
    parser.add_argument("--units", type=int, default=16, help="Total number of units")
    parser.add_argument("--width", type=float, default=24.0, help="Building width (meters)")
    parser.add_argument("--depth", type=float, default=20.0, help="Building depth (meters)")
    parser.add_argument("--floor_height", type=float, default=3.5, help="Height per floor (meters)")
    parser.add_argument("--output", type=str, default="frontend/public/models/building_generated.glb", help="Output GLB path")
    return parser.parse_args(argv)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def create_materials():
    mat_wall = bpy.data.materials.new(name="WallMaterial")
    mat_wall.use_nodes = True
    bsdf_wall = mat_wall.node_tree.nodes.get("Principled BSDF")
    if bsdf_wall:
        bsdf_wall.inputs["Base Color"].default_value = (0.15, 0.35, 0.75, 1.0)
        bsdf_wall.inputs["Roughness"].default_value = 0.4

    mat_glass = bpy.data.materials.new(name="GlassMaterial")
    mat_glass.use_nodes = True
    bsdf_glass = mat_glass.node_tree.nodes.get("Principled BSDF")
    if bsdf_glass:
        bsdf_glass.inputs["Base Color"].default_value = (0.9, 0.95, 1.0, 1.0)
        bsdf_glass.inputs["Emission Color"].default_value = (1.0, 0.9, 0.5, 1.0)
        bsdf_glass.inputs["Emission Strength"].default_value = 1.2

    mat_roof = bpy.data.materials.new(name="RoofMaterial")
    mat_roof.use_nodes = True
    bsdf_roof = mat_roof.node_tree.nodes.get("Principled BSDF")
    if bsdf_roof:
        bsdf_roof.inputs["Base Color"].default_value = (0.1, 0.12, 0.15, 1.0)

    return mat_wall, mat_glass, mat_roof


def generate_building(floors, units, width, depth, floor_height, mat_wall, mat_glass, mat_roof):
    total_height = floors * floor_height

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, total_height / 2.0))
    body = bpy.context.active_object
    body.name = "BuildingBody"
    body.scale = (width, depth, total_height)
    body.data.materials.append(mat_wall)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, total_height + 0.4))
    roof = bpy.context.active_object
    roof.name = "BuildingRoof"
    roof.scale = (width + 0.6, depth + 0.6, 0.8)
    roof.data.materials.append(mat_roof)

    units_per_floor = max(1, units // floors)
    windows_per_facade = max(2, units_per_floor // 2)

    win_w = 1.8
    win_h = 1.8
    win_d = 0.2

    for f in range(floors):
        z_pos = (f * floor_height) + (floor_height / 2.0)
        x_spacing = width / (windows_per_facade + 1)
        for i in range(1, windows_per_facade + 1):
            x_pos = -width / 2.0 + (i * x_spacing)
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x_pos, depth / 2.0 + 0.05, z_pos))
            win = bpy.context.active_object
            win.scale = (win_w, win_d, win_h)
            win.data.materials.append(mat_glass)

            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x_pos, -depth / 2.0 - 0.05, z_pos))
            win_back = bpy.context.active_object
            win_back.scale = (win_w, win_d, win_h)
            win_back.data.materials.append(mat_glass)


def export_glb(output_path):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=False,
        export_materials='EXPORT'
    )
    print(f"[SUCCESS] Exported 3D Building model to: {output_path}")


def main():
    args = parse_args()
    clear_scene()
    mat_wall, mat_glass, mat_roof = create_materials()
    generate_building(
        floors=args.floors,
        units=args.units,
        width=args.width,
        depth=args.depth,
        floor_height=args.floor_height,
        mat_wall=mat_wall,
        mat_glass=mat_glass,
        mat_roof=mat_roof
    )
    export_glb(args.output)


if __name__ == "__main__":
    main()
