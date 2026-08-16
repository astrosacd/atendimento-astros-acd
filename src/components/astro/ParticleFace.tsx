import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

interface ParticleFaceProps {
  /** 0..1 — intensidade da fala (boca/ondas) */
  amplitude: number;
  /** 0..1 — intensidade da escuta (microfone) */
  listening: number;
  /** estado visual */
  state: "idle" | "listening" | "thinking" | "speaking";
}

/* Deformação compartilhada entre pontos e wireframe */
const DEFORM = /* glsl */ `
  vec3 deform(vec3 p, float t, float amp, float listen, float think, out float mouthMask) {
    float mouth = exp(-pow(p.x * 3.3, 2.0) - pow((p.y + 0.46) * 7.2, 2.0));
    mouthMask = mouth;
    float jaw = smoothstep(-0.16, -0.82, p.y);
    p.y -= amp * (mouth * 0.26 + jaw * 0.075);
    p.z += amp * mouth * 0.16;
    // bochechas respiram
    p.z += amp * exp(-pow((abs(p.x) - 0.52) * 4.0, 2.0) - pow((p.y + 0.18) * 3.2, 2.0)) * 0.05;
    // respiração idle
    p.z += sin(t * 1.2 + p.y * 4.0) * 0.005;
    // ondas de escuta
    p.z += sin(length(p.xy) * 14.0 - t * 5.0) * listen * 0.016;
    // ruído de pensamento
    p.x += sin(t * 5.0 + p.y * 9.0) * think * 0.010;
    return p;
  }
`;

const FACE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform float uListen;
  uniform float uThink;
  attribute float aSeed;
  varying float vGlow;
  varying float vFresnel;
  varying float vIri;
  varying float vSpark;
  ${DEFORM}
  void main() {
    float mouth;
    vec3 p = deform(position, uTime, uAmp, uListen, uThink, mouth);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vec3 viewDir = normalize(-mv.xyz);
    float ndv = clamp(dot(n, viewDir), 0.0, 1.0);
    vFresnel = pow(1.0 - ndv, 2.2);

    // luz-chave: revela nariz, órbitas e lábios pelo relevo
    float key = clamp(dot(n, normalize(vec3(-0.55, 0.62, 0.85))), 0.0, 1.0);
    float rim = clamp(dot(n, normalize(vec3(0.75, -0.15, 0.35))), 0.0, 1.0);
    float shade = pow(key, 1.5) * 0.85 + pow(rim, 3.0) * 0.30;

    // iridescência: ângulo de visão + posição -> deslocamento de matiz (efeito cristal/espelho)
    vIri = fract(vFresnel * 1.35 + p.y * 0.22 + p.x * 0.10 + uTime * 0.035);

    // cintilância individual das partículas
    float tw = sin(uTime * 3.2 + aSeed * 62.8) * 0.5 + 0.5;
    vSpark = pow(tw, 6.0) * (0.30 + uAmp * 0.65) * (0.25 + shade);

    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.85 + shade * 0.95 + mouth * uAmp * 1.1 + vSpark * 0.9) * (7.2 / -mv.z);
    vGlow = clamp(0.04 + shade * 0.80 + mouth * uAmp * 0.75 + uListen * 0.12 + uThink * 0.10 + vFresnel * 0.25, 0.0, 1.0);

  }
`;

const POINT_FRAG = /* glsl */ `
  precision highp float;
  varying float vGlow;
  varying float vFresnel;
  varying float vIri;
  varying float vSpark;

  vec3 spectrum(float t) {
    return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.62, 0.46, 0.28)));
  }

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);

    vec3 base = mix(vec3(0.36, 0.66, 0.92), vec3(0.90, 0.98, 1.0), vGlow);
    vec3 iri = spectrum(vIri);
    vec3 color = mix(base, iri, 0.16 + vFresnel * 0.20);
    color += vec3(1.0) * vSpark * 0.60;

    float alpha = core * (0.22 + vGlow * 0.42 + vFresnel * 0.20 + vSpark * 0.45);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

const WIRE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform float uListen;
  uniform float uThink;
  varying float vFresnel;
  varying float vIri;
  ${DEFORM}
  void main() {
    float mouth;
    vec3 p = deform(position, uTime, uAmp, uListen, uThink, mouth);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    float ndv = clamp(dot(n, normalize(-mv.xyz)), 0.0, 1.0);
    vFresnel = pow(1.0 - ndv, 2.4);
    vIri = fract(vFresnel * 1.5 + p.y * 0.25 - uTime * 0.05);
    gl_Position = projectionMatrix * mv;
  }
`;

const WIRE_FRAG = /* glsl */ `
  precision highp float;
  varying float vFresnel;
  varying float vIri;
  vec3 spectrum(float t) {
    return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.62, 0.46, 0.28)));
  }
  void main() {
    vec3 color = mix(vec3(0.42, 0.72, 0.96), spectrum(vIri), 0.22);
    gl_FragColor = vec4(color, 0.05 + vFresnel * 0.22);
  }
`;

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
    camera.position.set(0, 0, 4.65);

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

    let faceGeometry: THREE.BufferGeometry | null = null;
    let particleGeometry: THREE.BufferGeometry | null = null;
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
      blending: THREE.AdditiveBlending,
    });
    const wireMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: WIRE_VERT,
      fragmentShader: WIRE_FRAG,
      wireframe: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const faceGroup = new THREE.Group();
    scene.add(faceGroup);

    // Uma cabeça humana escaneada substitui a antiga máscara oval paramétrica.
    // O material original não é usado: a própria topologia vira cristal, pontos e luz.
    const loader = new OBJLoader();
    loader.load("/models/astro/female-head.obj", (model) => {
      if (!container.isConnected) return;
      let source: THREE.Mesh | null = null;
      let largestVertexCount = 0;
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const vertexCount = object.geometry.getAttribute("position")?.count ?? 0;
        if (vertexCount > largestVertexCount) {
          source = object;
          largestVertexCount = vertexCount;
        }
      });
      if (!source) return;
      const raw = source.geometry.index ? source.geometry.toNonIndexed() : source.geometry.clone();
      const rawPosition = raw.getAttribute("position");
      const cropped: number[] = [];
      for (let i = 0; i < rawPosition.count; i += 3) {
        if (rawPosition.getY(i) < 104 || rawPosition.getY(i + 1) < 104 || rawPosition.getY(i + 2) < 104) continue;
        for (let j = 0; j < 3; j++) {
          cropped.push(rawPosition.getX(i + j), rawPosition.getY(i + j), rawPosition.getZ(i + j));
        }
      }
      raw.dispose();
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(cropped, 3));
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox;
      if (!bounds) return;
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      geometry.translate(-center.x, -center.y, -center.z);
      geometry.scale(2.62 / size.y, 2.62 / size.y, 2.62 / size.y);
      geometry.computeVertexNormals();
      const surface = new THREE.Mesh(geometry);
      const sampler = new MeshSurfaceSampler(surface).build();
      const particleCount = 42000;
      const particlePositions = new Float32Array(particleCount * 3);
      const particleNormals = new Float32Array(particleCount * 3);
      const point = new THREE.Vector3();
      const normal = new THREE.Vector3();
      for (let i = 0; i < particleCount; i++) {
        sampler.sample(point, normal);
        point.toArray(particlePositions, i * 3);
        normal.toArray(particleNormals, i * 3);
      }
      const particles = new THREE.BufferGeometry();
      particles.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
      particles.setAttribute("normal", new THREE.BufferAttribute(particleNormals, 3));
      const seeds = new Float32Array(particleCount);
      for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
      particles.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
      faceGeometry = geometry;
      particleGeometry = particles;
      faceGroup.add(new THREE.Mesh(geometry, wireMaterial), new THREE.Points(particles, pointMaterial));
    });


    const sparkCount = 2400;
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
      color: new THREE.Color(0.55, 0.85, 1), size: 0.013, transparent: true,
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
    const head = { yaw: 0, pitch: 0, roll: 0 };
    let nextGlance = 2.5;
    const glance = { yaw: 0, pitch: 0 };

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

      // olhadas aleatórias — cabeça vira de verdade
      if (t > nextGlance) {
        nextGlance = t + 2.2 + Math.random() * 3.4;
        glance.yaw = (Math.random() - 0.5) * (0.42 + cur.amp * 0.3);
        glance.pitch = (Math.random() - 0.5) * 0.18;
      }
      const yawTarget = glance.yaw + Math.sin(t * 0.32) * 0.10 + Math.sin(t * 1.9) * cur.amp * 0.05;
      const pitchTarget = glance.pitch + Math.sin(t * 0.23) * 0.05 - cur.amp * 0.04;
      const rollTarget = Math.sin(t * 0.41) * 0.045 + glance.yaw * 0.18;
      head.yaw += (yawTarget - head.yaw) * 0.035;
      head.pitch += (pitchTarget - head.pitch) * 0.035;
      head.roll += (rollTarget - head.roll) * 0.03;

      faceGroup.rotation.y = head.yaw;
      faceGroup.rotation.x = head.pitch;
      faceGroup.rotation.z = head.roll;
      faceGroup.position.y = Math.sin(t * 0.75) * 0.018;

      sparks.rotation.z = t * (0.018 + cur.think * 0.07);
      sparks.rotation.y = -t * 0.025;
      sparkMaterial.opacity = 0.30 + cur.listen * 0.18 + cur.amp * 0.38 + cur.think * 0.18;
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      faceGeometry?.dispose();
      particleGeometry?.dispose();
      pointMaterial.dispose();
      wireMaterial.dispose();
      sparkGeometry.dispose();
      sparkMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />;
}

export default ParticleFace;
