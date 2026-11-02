import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Box3, Color, Mesh, MeshStandardMaterial, Vector3, type Group, type Material } from "three";

export const FURNITURE_URL = "/models/furniture.glb";
const KENNEY = 0.16;

type PieceProps = {
  name: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  plaster?: string;
};

function isWood(material: Material): material is MeshStandardMaterial {
  return material instanceof MeshStandardMaterial && material.color.r > 0.7 && material.color.g > 0.55 && material.color.b < 0.55;
}

export function Piece({ name, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, plaster }: PieceProps) {
  const gltf = useGLTF(FURNITURE_URL);
  const object = useMemo(() => {
    const found = gltf.scene.getObjectByName(name);
    if (!found) return null;
    const clone = found.clone(true) as Group;
    clone.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (!plaster) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = materials.map((material) => {
        if (!isWood(material)) return material;
        const copy = material.clone();
        copy.color = new Color(plaster);
        return copy;
      });
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
    });
    clone.position.set(0, 0, 0);
    clone.updateMatrixWorld(true);
    const box = new Box3().setFromObject(clone);
    const center = box.getCenter(new Vector3());
    clone.position.set(-center.x, -box.min.y, -center.z);
    return clone;
  }, [gltf, name, plaster]);

  if (!object) return null;
  return (
    <group position={position} rotation={rotation} scale={KENNEY * scale}>
      <primitive object={object} />
    </group>
  );
}

useGLTF.preload(FURNITURE_URL);
