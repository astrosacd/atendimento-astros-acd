import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ParticleFaceProps {
  /** 0..1 — intensidade da fala (boca/ondas) */
  amplitude: number;
  /** 0..1 — intensidade da escuta (microfone) */
  listening: number;
  /** estado visual */
  state: "idle" | "listening" | "thinking" | "speaking";
}

const FACE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform float uListen;
  uniform float uThink;
  varying float vGlow;
  void main() {
    vec3 p = position;
    float mouth = exp(-pow(p.x * 3.3, 2.0) - pow((p.y + 0.48) * 8.0, 2.0));
    float jaw = smoothstep(-0.18, -0.78, p.y);
    p.y -= uAmp * (mouth * 0.13 + jaw * 0.025);
    p.z += uAmp * mouth * 0.08;
    p.z += sin(uTime * 1.4 + p.y * 5.0) * 0.006;
    p.z += sin(length(p.xy) * 15.0 - uTime * 5.0) * uListen * 0.012;
    p.x += sin(uTime * 5.0 + p.y * 9.0) * uThink * 0.008;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.9 + mouth * uAmp * 0.65) * (7.0 / -mv.z);
    vGlow = clamp(0.12 + mouth * uAmp * 0.72 + uListen * 0.18 + uThink * 0.14, 0.0, 1.0);
  }
`;

const POINT_FRAG = /* glsl */ `
  precision highp float;
  varying float vGlow;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    vec3 color = mix(vec3(0.16, 0.62, 0.92), vec3(0.82, 0.96, 1.0), vGlow);
    gl_FragColor = vec4(color, core * (0.18 + vGlow * 0.42));
  }
`;

const gauss = (x: number, y: number, cx: number, cy: number, sx: number, sy: number) =>
  Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));

function facePoint(u: number, v: number) {
  const forehead = 0.93 + 0.07 * Math.max(v, 0);
  const jaw = v < 0 ? 1 - 0.32 * Math.pow(-v, 1.5) : 1;
  const x = u * 1.02 * forehead * jaw;
  const y = v * 1.38;
  const oval = Math.sqrt(Math.max(0, 1 - u * u - v * v));
  let z = oval * 0.30;
  z += gauss(u, v, 0, 0.05, 0.13, 0.30) * 0.62;
  z += gauss(u, v, 0, -0.16, 0.20, 0.14) * 0.16;
  z -= gauss(u, v, -0.34, 0.22, 0.22, 0.13) * 0.17;
  z -= gauss(u, v, 0.34, 0.22, 0.22, 0.13) * 0.17;
  z += gauss(u, v, -0.46, -0.08, 0.31, 0.28) * 0.11;
  z += gauss(u, v, 0.46, -0.08, 0.31, 0.28) * 0.11;
  z -= gauss(u, v, 0, -0.36, 0.34, 0.055) * 0.09;
  z += gauss(u, v, 0, -0.43, 0.34, 0.065) * 0.07;
  z += gauss(u, v, 0, -0.64, 0.24, 0.16) * 0.08;
  return new THREE.Vector3(x, y, z);
}

function buildFaceGeometry() {
  const columns = 78;
  const rows = 96;
  const positions: number[] = [];
  const indices: number[] = [];
  const valid = new Map<string, number>();
  for (let row = 0; row <= rows; row++) {
    const v = 1 - (row / rows) * 2;
    for (let column = 0; column <= columns; column++) {
      const u = -1 + (column / columns) * 2;
      if (u * u + v * v > 1) continue;
      const point = facePoint(u, v);
      valid.set(`${column}:${row}`, positions.length / 3);
      positions.push(point.x, point.y, point.z);
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = valid.get(`${column}:${row}`);
      const b = valid.get(`${column + 1}:${row}`);
      const c = valid.get(`${column}:${row + 1}`);
      const d = valid.get(`${column + 1}:${row + 1}`);
      if (a !== undefined && b !== undefined && c !== undefined) indices.push(a, c, b);
      if (b !== undefined && c !== undefined && d !== undefined) indices.push(b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function featureLine(points: THREE.Vector3[], material: THREE.LineBasicMaterial) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

export function ParticleFace({ amplitude, listening, state }: ParticleFaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef({ amp: 0, listen: 0, think: 0 });

  useEffect(() => {
    targetRef.current.amp = amplitude;
    targetRef.current.listen = state === "listening" ? Math.max(0.25, listening) : 0;
    targetRef.current.think = state === "thinking" ? 1 : 0;
  }, [amplitude, listening, state]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 3.15);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    const faceGeometry = buildFaceGeometry();
    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: 0 },
      uListen: { value: 0 },
      uThink: { value: 0 },
    };
    const pointMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: FACE_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.45, 0.86, 1), wireframe: true, transparent: true,
      opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const featureMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(0.82, 0.96, 1), transparent: true, opacity: 0.58,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const faceGroup = new THREE.Group();
    const facePoints = new THREE.Points(faceGeometry, pointMaterial);
    const faceWire = new THREE.Mesh(faceGeometry, wireMaterial);
    faceGroup.add(faceWire, facePoints);
    faceGroup.scale.setScalar(1.08);

    const makeCurve = (coords: Array<[number, number]>, zOffset = 0.018) => coords.map(([u, v]) => {
      const point = facePoint(u, v);
      point.z += zOffset;
      return point;
    });
    faceGroup.add(
      featureLine(makeCurve([[-0.57, 0.23], [-0.47, 0.29], [-0.34, 0.30], [-0.22, 0.24]]), featureMaterial),
      featureLine(makeCurve([[0.22, 0.24], [0.34, 0.30], [0.47, 0.29], [0.57, 0.23]]), featureMaterial),
      featureLine(makeCurve([[-0.55, 0.20], [-0.44, 0.16], [-0.32, 0.16], [-0.23, 0.21]]), featureMaterial),
      featureLine(makeCurve([[0.23, 0.21], [0.32, 0.16], [0.44, 0.16], [0.55, 0.20]]), featureMaterial),
      featureLine(makeCurve([[0, 0.28], [-0.05, 0.05], [-0.08, -0.13], [0, -0.20], [0.10, -0.14]]), featureMaterial),
      featureLine(makeCurve([[-0.35, -0.42], [-0.19, -0.37], [0, -0.39], [0.19, -0.37], [0.35, -0.42]]), featureMaterial),
      featureLine(makeCurve([[-0.32, -0.43], [-0.16, -0.48], [0, -0.49], [0.16, -0.48], [0.32, -0.43]]), featureMaterial),
    );
    scene.add(faceGroup);

    const sparkCount = 1800;
    const sparkPositions = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.08 + Math.random() * 1.15;
      sparkPositions[i * 3] = Math.cos(angle) * radius * (0.72 + Math.random() * 0.3);
      sparkPositions[i * 3 + 1] = Math.sin(angle) * radius * 1.1;
      sparkPositions[i * 3 + 2] = (Math.random() - 0.5) * 1.7;
    }
    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMaterial = new THREE.PointsMaterial({
      color: new THREE.Color(0.44, 0.88, 1), size: 0.012, transparent: true,
      opacity: 0.48, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
    scene.add(sparks);

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let raf = 0;
    const clock = new THREE.Clock();
    const cur = { amp: 0, listen: 0, think: 0 };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      const tgt = targetRef.current;
      cur.amp += (tgt.amp - cur.amp) * 0.18;
      cur.listen += (tgt.listen - cur.listen) * 0.08;
      cur.think += (tgt.think - cur.think) * 0.06;

      uniforms.uTime.value = t;
      uniforms.uAmp.value = cur.amp;
      uniforms.uListen.value = cur.listen;
      uniforms.uThink.value = cur.think;

      faceGroup.rotation.y = Math.sin(t * 0.28) * 0.075;
      faceGroup.rotation.x = Math.sin(t * 0.19) * 0.025;
      faceGroup.position.y = Math.sin(t * 0.75) * 0.018;
      sparks.rotation.z = t * (0.018 + cur.think * 0.07);
      sparks.rotation.y = -t * 0.025;
      sparkMaterial.opacity = 0.32 + cur.listen * 0.18 + cur.amp * 0.34 + cur.think * 0.18;
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      faceGeometry.dispose();
      pointMaterial.dispose();
      wireMaterial.dispose();
      featureMaterial.dispose();
      faceGroup.children.forEach((child) => {
        if (child instanceof THREE.Line) child.geometry.dispose();
      });
      sparkGeometry.dispose();
      sparkMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />;
}

export default ParticleFace;
