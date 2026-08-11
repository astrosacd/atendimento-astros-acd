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

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform float uListen;
  uniform float uThink;
  attribute float aRand;
  varying float vGlow;

  // hash noise
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main() {
    vec3 p = position;
    vec3 dir = normalize(p);

    // respiração base
    float breathe = 0.035 * sin(uTime * 0.9 + aRand * 6.2831);

    // turbulência orgânica
    float n = noise(p * 1.9 + vec3(uTime * 0.35)) - 0.5;

    // "boca": faixa horizontal abaixo do centro reage à fala
    float mouth = exp(-pow((p.y + 0.28) * 4.2, 2.0)) * exp(-pow(p.z - 0.7, 2.0) * 1.2);
    float speak = uAmp * mouth * 0.55;

    // ondas concêntricas quando escuta
    float ripple = sin(length(p.xy) * 9.0 - uTime * 4.0) * 0.05 * uListen;

    // rotação de energia enquanto pensa
    float think = sin(p.y * 8.0 + uTime * 6.0) * 0.035 * uThink;

    float disp = breathe + n * (0.10 + uAmp * 0.22) + speak + ripple + think;
    p += dir * disp;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = 0.7 + aRand * 0.6 + uAmp * 0.8;
    gl_PointSize = size * (26.0 / -mv.z);

    vGlow = clamp(0.18 + abs(n) * 0.8 + speak * 2.0 + uListen * 0.3 + uThink * 0.25, 0.0, 1.2);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vGlow;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.1, d);
    vec3 color = mix(uColorA, uColorB, clamp(vGlow, 0.0, 1.0));
    gl_FragColor = vec4(color, alpha * (0.06 + vGlow * 0.20));
  }
`;

/** Gera pontos numa superfície tipo "cabeça" (esferoide alongado com queixo). */
function buildHeadPositions(count: number) {
  const pos = new Float32Array(count * 3);
  const rand = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // distribuição fibonacci na esfera
    const k = i + 0.5;
    const phi = Math.acos(1 - (2 * k) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * k;
    let x = Math.sin(phi) * Math.cos(theta);
    let y = Math.cos(phi);
    let z = Math.sin(phi) * Math.sin(theta);

    // formato de cabeça: mais estreito nos lados, alongado na vertical, queixo afinado
    x *= 0.78;
    z *= 0.86;
    y *= 1.12;
    const chin = y < 0 ? 1 - Math.pow(-y, 2.2) * 0.35 : 1;
    x *= chin;
    z *= chin;

    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    rand[i] = Math.random();
  }
  return { pos, rand };
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
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 6.2;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const COUNT = 34000;
    const { pos, rand } = buildHeadPositions(COUNT);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));

    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: 0 },
      uListen: { value: 0 },
      uThink: { value: 0 },
      uColorA: { value: new THREE.Color("#1d4ed8") },
      uColorB: { value: new THREE.Color("#67e8f9") },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, material);
    scene.add(points);

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

      points.rotation.y = Math.sin(t * 0.15) * 0.16;
      points.rotation.x = Math.sin(t * 0.11) * 0.05;
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      geo.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />;
}

export default ParticleFace;
