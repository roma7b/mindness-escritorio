import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { ACESFilmicToneMapping, CanvasTexture, ExtrudeGeometry, Shape, type Group, type OrthographicCamera } from "three";
import { RoundedBox } from "@react-three/drei";
import { desksIn, moveItem, type LayoutItem } from "../../shared/layout";
import { STATUS_META, type BotShape, type EffectiveStatus, type OfficeView, type TimeOfDay } from "../../shared/office";
import { Piece } from "./furniture";

const TILE = 1.6;

type SceneProps = {
  view: OfficeView;
  time: TimeOfDay;
  selected: string | null;
  sway: boolean;
  tall: boolean;
  reduced: boolean;
  editing: boolean;
  items: LayoutItem[];
  picked: string | null;
  onSelect: (id: string) => void;
  onPick: (id: string | null) => void;
  onItems: (items: LayoutItem[]) => void;
};

const SKY: Record<TimeOfDay, { sky: string; sun: string; plaster: string; ground: string; exposure: number; sunY: number }> = {
  day: { sky: "#8fd0ff", sun: "#ffe56a", plaster: "#f7f4ee", ground: "#f3e6c8", exposure: 1.22, sunY: 1.45 },
  evening: { sky: "#ff8d55", sun: "#ffd08a", plaster: "#f0ddd4", ground: "#c9a06a", exposure: 1.08, sunY: 1.05 },
  night: { sky: "#12182e", sun: "#f4e7b0", plaster: "#3c445c", ground: "#2a241c", exposure: 0.78, sunY: 1.4 },
};

function Exposure({ value }: { value: number }) {
  const gl = useThree((state) => state.gl);
  useLayoutEffect(() => {
    gl.toneMappingExposure = value;
  }, [gl, value]);
  return null;
}

function CameraRig({ sway, tall }: { sway: boolean; tall: boolean }) {
  const camera = useThree((state) => state.camera) as OrthographicCamera;
  const size = useThree((state) => state.size);
  const base = useRef({ x: 12, y: 11, z: 12 });
  useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const zoom = Math.min(size.width, size.height) / (tall || aspect < 0.9 ? 11.2 : 8.4);
    base.current = tall ? { x: 15.2, y: 16.2, z: 15.2 } : { x: 15.8, y: 14.2, z: 15.8 };
    camera.zoom = zoom;
    camera.position.set(base.current.x, base.current.y, base.current.z);
    camera.lookAt(5.8, 0.8, 3.05);
    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width, tall]);
  useFrame((state) => {
    if (!sway) return;
    const t = state.clock.elapsedTime;
    camera.position.x = base.current.x + Math.sin(t * 0.16) * 0.7;
    camera.lookAt(5.8, 0.8, 3.05);
    camera.updateProjectionMatrix();
  });
  return null;
}

function textTexture(label: string, color: string, width = 512, height = 160) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  ctx.font = `800 ${Math.floor(height * 0.42)}px Nunito, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillText(label, width / 2, height / 2);
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function wrapLines(text: string, max = 22) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function SpriteLabel({
  text,
  position,
  scale,
  fill,
  ink,
}: {
  text: string;
  position: [number, number, number];
  scale: [number, number, number];
  fill?: string;
  ink: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, 512, 180);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(12, 18, 488, 144, 32);
      ctx.fill();
    }
    ctx.fillStyle = ink;
    ctx.font = "800 40px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = text.split("\n");
    lines.forEach((line, index) => ctx.fillText(line, 256, 90 + (index - (lines.length - 1) / 2) * 54));
    const map = new CanvasTexture(canvas);
    map.needsUpdate = true;
    return map;
  }, [text, fill, ink]);
  if (!texture) return null;
  return (
    <sprite position={position} scale={scale}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

function Neon({ text, position, color }: { text: string; position: [number, number, number]; color: string }) {
  const texture = useMemo(() => textTexture(text, color), [text, color]);
  if (!texture) return null;
  return (
    <mesh position={position}>
      <planeGeometry args={[1.35, 0.42]} />
      <meshStandardMaterial
        map={texture}
        transparent
        emissive={color}
        emissiveMap={texture}
        emissiveIntensity={2}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

function Clock({ position }: { position: [number, number, number] }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#f7f1e4";
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2c3038";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.lineTo(64, 28);
    ctx.moveTo(64, 64);
    ctx.lineTo(90, 70);
    ctx.stroke();
    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);
  if (!texture) return null;
  return (
    <mesh position={position}>
      <circleGeometry args={[0.22, 24]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

function RoomShell({
  origin,
  cols,
  rows,
  plaster,
  floor,
  windows,
  doorway,
}: {
  origin: [number, number];
  cols: number;
  rows: number;
  plaster: string;
  floor: string;
  windows: number[];
  doorway?: boolean;
}) {
  const [ox, oz] = origin;
  const width = cols * TILE;
  return (
    <group>
      {Array.from({ length: cols }, (_, col) =>
        Array.from({ length: rows }, (_, row) => (
          <Piece
            key={`floor-${ox}-${col}-${row}`}
            name="floorFull"
            plaster={floor}
            position={[ox + (col + 0.5) * TILE, 0, oz + (row + 0.5) * TILE]}
          />
        )),
      )}
      {Array.from({ length: cols }, (_, col) => (
        <Piece
          key={`back-${ox}-${col}`}
          name={windows.includes(col) ? "wallWindow" : "wall"}
          plaster={plaster}
          position={[ox + (col + 0.5) * TILE, 0, oz]}
        />
      ))}
      {Array.from({ length: rows }, (_, row) => (
        <Piece
          key={`left-${oz}-${row}`}
          name="wall"
          plaster={plaster}
          rotation={[0, Math.PI / 2, 0]}
          position={[ox, 0, oz + (row + 0.5) * TILE]}
        />
      ))}
      {doorway ? (
        <Piece name="doorwayOpen" plaster={plaster} rotation={[0, -Math.PI / 2, 0]} position={[ox + width, 0, oz + TILE * 1.5]} />
      ) : null}
    </group>
  );
}

function SkyWindows({ origin, cols, time }: { origin: [number, number]; cols: number[]; time: TimeOfDay }) {
  const look = SKY[time];
  return (
    <group>
      {cols.map((col) => (
        <group key={col} position={[origin[0] + (col + 0.5) * TILE, 0, origin[1] - 0.16]}>
          <mesh position={[0, 1.25, 0]}>
            <planeGeometry args={[0.86, 0.66]} />
            <meshBasicMaterial color={look.sky} toneMapped={false} />
          </mesh>
          <mesh position={[0.12, look.sunY, -0.02]}>
            <sphereGeometry args={[0.09, 16, 12]} />
            <meshBasicMaterial color={look.sun} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Screen({ position, status, time }: { position: [number, number, number]; status: EffectiveStatus | "empty"; time: TimeOfDay }) {
  const color = status === "empty" ? "#1c2433" : STATUS_META[status].color;
  const night = time === "night" ? 2.4 : time === "evening" ? 1.35 : 0.55;
  const intensity = status === "empty" || status === "sleeping" ? 0.08 : night;
  return (
    <mesh position={position}>
      <planeGeometry args={[0.46, 0.3]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />
    </mesh>
  );
}

function Mug({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} castShadow>
      <cylinderGeometry args={[0.045, 0.05, 0.08, 14]} />
      <meshStandardMaterial color="#f6f1e8" roughness={0.35} />
    </mesh>
  );
}

function Workstation({
  status,
  big,
  time,
}: {
  status: EffectiveStatus | "empty";
  big?: boolean;
  time: TimeOfDay;
}) {
  const scale = big ? 1.12 : 1;
  return (
    <group>
      <Piece name={big ? "deskCorner" : "desk"} scale={scale} />
      <Piece name="chairDesk" position={[0, 0, big ? 0.85 : 0.62]} scale={big ? 1.05 : 0.92} />
      <Piece name="computerScreen" position={[big ? 0.15 : 0.05, 0, big ? -0.15 : -0.12]} scale={big ? 1.15 : 1} />
      {big ? <Piece name="computerScreen" position={[-0.55, 0, -0.1]} scale={0.9} /> : null}
      <Piece name="computerKeyboard" position={[0.05, 0, 0.16]} scale={0.9} />
      <Piece name="laptop" position={[-0.34, 0, 0.12]} scale={0.85} />
      <Mug position={[big ? 0.55 : 0.42, 0.66, 0.18]} />
      <Screen position={[0.02, big ? 1.05 : 0.92, 0.05]} status={status} time={time} />
    </group>
  );
}

const dropGeometry = (() => {
  const shape = new Shape();
  shape.moveTo(0, 0.36);
  shape.quadraticCurveTo(0.14, 0.08, 0.22, -0.08);
  shape.lineTo(0.16, -0.26);
  shape.quadraticCurveTo(0, -0.3, -0.16, -0.26);
  shape.lineTo(-0.22, -0.08);
  shape.quadraticCurveTo(-0.14, 0.08, 0, 0.36);
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geometry.center();
  geometry.translate(0, 0.3, 0);
  return geometry;
})();

function BodyMaterial({ color, accent, gradient }: { color: string; accent: string; gradient?: boolean }) {
  const map = useMemo(() => {
    if (!gradient) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const paint = ctx.createLinearGradient(0, 0, 64, 128);
    paint.addColorStop(0, color);
    paint.addColorStop(1, accent);
    ctx.fillStyle = paint;
    ctx.fillRect(0, 0, 64, 128);
    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, [accent, color, gradient]);
  return <meshStandardMaterial color={gradient ? "#ffffff" : color} map={map ?? undefined} roughness={0.42} />;
}

function Eyes({ y, z, closed, color = "#fffaf4" }: { y: number; z: number; closed: boolean; color?: string }) {
  const glow = color !== "#fffaf4";
  return (
    <group position={[0, y, z]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (glow ? 0.08 : 0.07), 0, 0]} scale={[glow ? 1.7 : 1.45, closed ? 0.18 : glow ? 0.85 : 0.62, 0.45]}>
          <sphereGeometry args={[glow ? 0.048 : 0.038, 16, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow ? 2.4 : 0.25} toneMapped={!glow} />
        </mesh>
      ))}
    </group>
  );
}

function CharacterBody({ shape, color, accent, gradient, closed }: { shape: BotShape; color: string; accent: string; gradient?: boolean; closed: boolean }) {
  if (shape === "helmet") {
    return (
      <group>
        <mesh position={[0, 0.36, 0]} castShadow>
          <sphereGeometry args={[0.22, 32, 24]} />
          <meshStandardMaterial color="#141414" metalness={0.72} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.4, 0.06]} castShadow>
          <boxGeometry args={[0.38, 0.1, 0.2]} />
          <meshStandardMaterial color="#0c0c0c" metalness={0.8} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0.54, 0.02]} rotation={[0.15, 0, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.025, 28]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.55} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.66, -0.02]} castShadow>
          <cylinderGeometry args={[0.16, 0.18, 0.18, 24]} />
          <meshStandardMaterial color="#121212" metalness={0.5} roughness={0.42} />
        </mesh>
        <mesh position={[0, 0.58, 0]}>
          <cylinderGeometry args={[0.185, 0.185, 0.028, 24]} />
          <meshStandardMaterial color="#8b1530" roughness={0.45} />
        </mesh>
        <mesh position={[0.16, 0.7, -0.02]} rotation={[0.4, 0, -0.5]}>
          <boxGeometry args={[0.02, 0.16, 0.04]} />
          <meshStandardMaterial color="#d7b56a" metalness={0.6} roughness={0.35} />
        </mesh>
        <Eyes y={0.42} z={0.24} closed={closed} color="#ff2a2a" />
      </group>
    );
  }
  const eyes = <Eyes y={shape === "square" ? 0.32 : shape === "drop" ? 0.34 : 0.4} z={shape === "drop" ? 0.18 : 0.2} closed={closed} />;
  if (shape === "square") {
    return (
      <group>
        <RoundedBox args={[0.44, 0.4, 0.36]} radius={0.12} smoothness={4} position={[0, 0.28, 0]} castShadow>
          <BodyMaterial color={color} accent={accent} gradient={gradient} />
        </RoundedBox>
        {eyes}
      </group>
    );
  }
  if (shape === "drop") {
    return (
      <group>
        <mesh geometry={dropGeometry} castShadow>
          <BodyMaterial color={color} accent={accent} gradient={gradient} />
        </mesh>
        {eyes}
      </group>
    );
  }
  return (
    <group>
      <mesh position={[0, 0.34, 0]} scale={[1, 1.08, 0.92]} castShadow>
        <sphereGeometry args={[0.22, 32, 24]} />
        <BodyMaterial color={color} accent={accent} gradient={gradient} />
      </mesh>
      {eyes}
    </group>
  );
}

function Blob({
  color,
  accent,
  shape = "round",
  gradient,
  status,
  reduced,
  label,
  note,
  selected,
  onClick,
}: {
  color: string;
  accent: string;
  shape?: BotShape;
  gradient?: boolean;
  status: EffectiveStatus;
  reduced: boolean;
  label?: string;
  note?: string;
  selected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    const group = ref.current;
    if (!group) return;
    const t = state.clock.elapsedTime;
    if (reduced) {
      group.position.y = status === "sleeping" ? 0.02 : 0;
      return;
    }
    if (status === "sleeping") {
      group.position.y = 0.02;
      group.rotation.z = 0.18;
      return;
    }
    group.rotation.z = 0;
    if (status === "needs_you") {
      group.position.y = Math.abs(Math.sin(t * 5.5)) * 0.14;
      return;
    }
    const busy = status === "working" || status === "browsing" || status === "terminal" || status === "thinking";
    group.position.y = Math.sin(t * (busy ? 7 : 2.2)) * (busy ? 0.035 : 0.012);
    group.rotation.z = busy ? Math.sin(t * 7) * 0.1 : 0;
  });
  const closed = status === "sleeping";
  const crown = shape === "helmet" ? 1.02 : 0.78;
  return (
    <group ref={ref} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      {selected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.24, 0.3, 24]} />
          <meshBasicMaterial color="#ff9f1a" />
        </mesh>
      ) : null}
      <CharacterBody shape={shape} color={color} accent={accent} gradient={gradient} closed={closed} />
      {label ? <SpriteLabel text={label} position={[0, crown, 0]} scale={[0.72, 0.22, 1]} ink="#ffffff" /> : null}
      {status === "needs_you" ? (
        <SpriteLabel
          text={[label ?? "", ...wrapLines(note || "Precisa de um ok")].join("\n")}
          position={[0.15, crown + 0.42, 0]}
          scale={[1.9, 0.42 + wrapLines(note || "Precisa de um ok").length * 0.16, 1]}
          fill="#fff6df"
          ink="#2a2116"
        />
      ) : null}
      {status === "sleeping" ? <SpriteLabel text="z z z" position={[0.28, crown, 0]} scale={[0.55, 0.2, 1]} ink="#d5def8" /> : null}
    </group>
  );
}

const FRAME_COLORS = ["#7eb6ff", "#ffb4c8", "#ffe08a", "#9be7c4"];

function Frame({ tint }: { tint: string }) {
  return (
    <group position={[0, 1.2, 0]}>
      <mesh>
        <boxGeometry args={[0.5, 0.36, 0.04]} />
        <meshStandardMaterial color="#f6f1e6" />
      </mesh>
      <mesh position={[0, 0, 0.025]}>
        <planeGeometry args={[0.36, 0.22]} />
        <meshStandardMaterial color={tint} />
      </mesh>
    </group>
  );
}

function Whiteboard() {
  return (
    <group position={[0, 1.02, 0]}>
      <mesh>
        <planeGeometry args={[1, 0.62]} />
        <meshStandardMaterial color="#f7f4ea" roughness={0.9} />
      </mesh>
      {["#ffd27a", "#8ecbff", "#f5a3b5"].map((color, index) => (
        <mesh key={color} position={[-0.22 + (index % 2) * 0.38, 0.12 - Math.floor(index / 2) * 0.24, 0.02]}>
          <planeGeometry args={[0.2, 0.14]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function Cooler() {
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.32, 0.84, 0.28]} />
        <meshStandardMaterial color="#d5e2ea" />
      </mesh>
      <mesh position={[0, 0.22, 0.15]}>
        <boxGeometry args={[0.08, 0.08, 0.04]} />
        <meshStandardMaterial color="#8eb4c4" />
      </mesh>
    </group>
  );
}

function Diorama({
  view,
  time,
  selected,
  reduced,
  editing,
  items,
  picked,
  onSelect,
  onPick,
  onItems,
}: Omit<SceneProps, "sway" | "tall">) {
  const look = SKY[time];
  const plaster = look.plaster;
  const prospect = view.bots.filter((bot) => bot.area === "prospeccao");
  const chief = view.bots.find((bot) => bot.area === "chief");
  const home = view.bots.filter((bot) => bot.areaKind === "home");
  const prospectDesks = desksIn(items, "prospeccao");
  const dragging = useRef<string | null>(null);
  const lamps = time !== "day";
  const botFor = (item: LayoutItem) => {
    if (item.kind === "desk") return prospect[prospectDesks.findIndex((desk) => desk.id === item.id)];
    if (item.kind === "deskCorner") return chief;
    return undefined;
  };
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.2, -0.03, 4.2]} receiveShadow>
        <circleGeometry args={[9.2, 48]} />
        <meshStandardMaterial color={look.ground} roughness={1} />
      </mesh>
      <RoomShell origin={[0, 0]} cols={5} rows={4} plaster={plaster} floor={time === "night" ? "#6d4c32" : time === "evening" ? "#d09a58" : "#efc48a"} windows={[1, 3]} />
      <SkyWindows origin={[0, 0]} cols={[1, 3]} time={time} />
      <RoomShell origin={[8.35, 0.45]} cols={3} rows={3} plaster={plaster} floor={time === "night" ? "#7a5434" : time === "evening" ? "#e0a860" : "#f0c892"} windows={[1]} doorway />
      <SkyWindows origin={[8.35, 0.45]} cols={[1]} time={time} />

      <Neon text="prospecção" position={[4, 1.82, 0.16]} color="#ff7eb6" />
      <Clock position={[7.25, 1.55, 0.16]} />
      <Neon text="chief" position={[9.15, 1.78, 0.62]} color="#ff5ea8" />
      <group
        onPointerMove={(event) => {
          if (!dragging.current) return;
          const next = moveItem(items, dragging.current, event.point.x, event.point.z);
          if (next) onItems(next);
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
      >
        {editing ? <gridHelper args={[16, 40, "#c9a06a", "#e7d3a4"]} position={[6.2, 0.04, 4.2]} /> : null}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.2, 0.02, 4]}>
          <planeGeometry args={[24, 18]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {items.map((item, index) => {
          const bot = botFor(item);
          return (
            <group
              key={item.id}
              position={[item.x, item.y ?? 0, item.z]}
              rotation={[0, (item.rot * Math.PI) / 180, 0]}
              scale={item.scale ?? 1}
              onPointerDown={(event) => {
                if (!editing) return;
                event.stopPropagation();
                dragging.current = item.id;
                onPick(item.id);
              }}
            >
              {item.kind === "desk" || item.kind === "deskCorner" ? (
                <Workstation status={bot?.status ?? "empty"} big={item.kind === "deskCorner"} time={time} />
              ) : item.kind === "whiteboard" ? (
                <Whiteboard />
              ) : item.kind === "frame" ? (
                <Frame tint={FRAME_COLORS[index % FRAME_COLORS.length]} />
              ) : item.kind === "cooler" ? (
                <Cooler />
              ) : (
                <Piece name={item.kind} />
              )}
              {editing && picked === item.id ? (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
                  <ringGeometry args={[0.42, 0.5, 28]} />
                  <meshBasicMaterial color="#ff9f1a" />
                </mesh>
              ) : null}
              {bot ? (
                <group position={[0, bot.shape === "helmet" ? 0.04 : 0, item.kind === "deskCorner" ? 1.05 : 0.95]}>
                  <Blob
                    color={bot.color}
                    accent={bot.accent}
                    shape={bot.shape}
                    gradient={bot.gradient}
                    status={bot.status}
                    reduced={reduced}
                    label={bot.short}
                    note={bot.note}
                    selected={bot.id === selected}
                    onClick={() => {
                      if (!editing) onSelect(bot.id);
                    }}
                  />
                </group>
              ) : null}
            </group>
          );
        })}
      </group>
      <mesh position={[13.05, 1.15, 2.7]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.42, 0.18]} />
        <meshStandardMaterial color="#173d28" emissive="#3ddc84" emissiveIntensity={time === "day" ? 0.4 : 1.4} toneMapped={false} />
      </mesh>

      {time !== "day" ? <pointLight position={[4.1, 2.4, 2.6]} intensity={time === "night" ? 14 : 8} distance={8} color={time === "night" ? "#d5e2ff" : "#ffd0a4"} /> : null}
      {lamps ? <pointLight position={[12.45, 1.7, 3.55]} intensity={time === "night" ? 36 : 18} distance={7} color="#ffc27a" /> : null}
      {lamps ? <pointLight position={[9.15, 1.15, 3.9]} intensity={time === "night" ? 12 : 6} distance={3.5} color="#ffe1a8" /> : null}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4.6, 0.01, 8.15]} receiveShadow>
        <planeGeometry args={[8.2, 2.3]} />
        <meshStandardMaterial color={time === "day" ? "#7fbf63" : time === "evening" ? "#5e8a42" : "#2d4630"} />
      </mesh>
      {home.map((bot, index) => {
        const col = index % 7;
        const row = Math.floor(index / 7);
        const x = 0.55 + col * 0.95;
        const z = 7.55 + row * 1.05;
        return (
          <group key={bot.id} position={[x, 0, z]} onClick={(event) => { event.stopPropagation(); onSelect(bot.id); }}>
            <mesh position={[0, 0.22, 0]} castShadow>
              <boxGeometry args={[0.48, 0.42, 0.42]} />
              <meshStandardMaterial color="#f4efe4" />
            </mesh>
            <mesh position={[0, 0.52, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
              <coneGeometry args={[0.4, 0.3, 4]} />
              <meshStandardMaterial color={bot.color} />
            </mesh>
            <mesh position={[0.14, 0.28, 0.22]}>
              <boxGeometry args={[0.12, 0.1, 0.03]} />
              <meshStandardMaterial color={lamps ? "#ffd27a" : "#b9d7ee"} emissive={lamps ? "#ffb15a" : "#000000"} emissiveIntensity={lamps ? 0.7 : 0} />
            </mesh>
            <group position={[-0.05, 0, 0.38]} scale={0.62}>
              <Blob color={bot.color} accent={bot.accent} shape={bot.shape} gradient={bot.gradient} status="home_office" reduced={reduced} label={bot.id === selected ? bot.short : undefined} selected={bot.id === selected} onClick={() => onSelect(bot.id)} />
            </group>
          </group>
        );
      })}
    </group>
  );
}

function Lights({ time }: { time: TimeOfDay }) {
  if (time === "day") {
    return (
      <>
        <hemisphereLight args={["#e7f4ff", "#f6e6cc", 0.95]} />
        <ambientLight intensity={0.42} color="#fff8ee" />
        <directionalLight
          castShadow
          position={[9, 16, 7]}
          intensity={2.5}
          color="#fff6e4"
          shadow-mapSize={[1024, 1024]}
          shadow-camera-near={1}
          shadow-camera-far={40}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
          shadow-bias={-0.0008}
        />
        <directionalLight position={[-8, 8, -2]} intensity={0.85} color="#d5ecff" />
      </>
    );
  }
  if (time === "evening") {
    return (
      <>
        <hemisphereLight args={["#ffc9a4", "#c9a27a", 0.85]} />
        <ambientLight intensity={0.42} color="#ffe0c4" />
        <directionalLight
          castShadow
          position={[4, 9, 8]}
          intensity={2.1}
          color="#ffb27a"
          shadow-mapSize={[1024, 1024]}
          shadow-camera-near={1}
          shadow-camera-far={36}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-bias={-0.0008}
        />
        <directionalLight position={[-6, 5, -3]} intensity={0.35} color="#ffd0ea" />
      </>
    );
  }
  return (
    <>
      <hemisphereLight args={["#243056", "#1a140f", 0.55]} />
      <ambientLight intensity={0.28} color="#c5d2ee" />
      <directionalLight position={[6, 10, 4]} intensity={0.35} color="#9db4e0" />
    </>
  );
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function OfficeScene(props: SceneProps & { fallback: ReactNode }) {
  const look = SKY[props.time];
  return (
    <SceneBoundary fallback={props.fallback}>
      <Canvas
        className="webgl"
        orthographic
        shadows
        dpr={[1, 1.6]}
        camera={{ position: [12.5, 11.2, 12.5], zoom: 48, near: 0.1, far: 80 }}
        gl={{ alpha: false, antialias: true, preserveDrawingBuffer: true, toneMapping: ACESFilmicToneMapping }}
      >
        <color attach="background" args={[props.time === "day" ? "#d7e7f6" : props.time === "evening" ? "#2a2030" : "#141821"]} />
        <Exposure value={look.exposure} />
        <CameraRig sway={props.sway} tall={props.tall} />
        <Lights time={props.time} />
        <Suspense fallback={null}>
          <Diorama
            view={props.view}
            time={props.time}
            selected={props.selected}
            reduced={props.reduced}
            editing={props.editing}
            items={props.items}
            picked={props.picked}
            onSelect={props.onSelect}
            onPick={props.onPick}
            onItems={props.onItems}
          />
        </Suspense>
      </Canvas>
    </SceneBoundary>
  );
}

export function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
