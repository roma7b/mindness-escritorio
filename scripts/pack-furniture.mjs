import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

globalThis.FileReader = class FileReader {
  onloadend = null;
  result = null;
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
};
import { Box3, Group, MeshStandardMaterial, Vector3 } from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const names = [
  "desk",
  "deskCorner",
  "chairDesk",
  "computerScreen",
  "computerKeyboard",
  "laptop",
  "bookcaseOpen",
  "books",
  "plantSmall1",
  "plantSmall2",
  "pottedPlant",
  "loungeSofaLong",
  "loungeChair",
  "tableCoffee",
  "lampRoundFloor",
  "lampRoundTable",
  "rugRounded",
  "wall",
  "wallWindow",
  "wallCorner",
  "wallDoorway",
  "floorFull",
  "sideTable",
  "doorwayOpen",
];

const root = new Group();
root.name = "furniture";

for (const name of names) {
  const dir = "/tmp/kenney-models/Models";
  const materials = new MTLLoader().parse(readFileSync(`${dir}/${name}.mtl`, "utf8"));
  materials.preload();
  const object = new OBJLoader().setMaterials(materials).parse(readFileSync(`${dir}/${name}.obj`, "utf8"));
  object.name = name;
  object.traverse((child) => {
    if (!child.isMesh) return;
    const source = Array.isArray(child.material) ? child.material[0] : child.material;
    const color = source?.color?.clone() ?? undefined;
    child.material = new MeshStandardMaterial({
      color: color ?? "#d7d2cc",
      roughness: 0.78,
      metalness: 0.04,
    });
    child.castShadow = true;
    child.receiveShadow = true;
    child.name = `${name}Mesh`;
  });
  object.updateMatrixWorld(true);
  const box = new Box3().setFromObject(object);
  const center = box.getCenter(new Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= box.min.y;
  object.userData.size = {
    x: Number((box.max.x - box.min.x).toFixed(3)),
    y: Number((box.max.y - box.min.y).toFixed(3)),
    z: Number((box.max.z - box.min.z).toFixed(3)),
  };
  root.add(object);
}

const exporter = new GLTFExporter();
const glb = await new Promise((resolve, reject) => {
  exporter.parse(root, resolve, reject, { binary: true });
});
mkdirSync("public/models", { recursive: true });
writeFileSync("public/models/furniture.glb", Buffer.from(glb));
const kb = Math.round(Buffer.from(glb).byteLength / 1024);
console.log(`furniture.glb ${kb} KB`);
for (const child of root.children) {
  console.log(child.name, JSON.stringify(child.userData.size));
}
