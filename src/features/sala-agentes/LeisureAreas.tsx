import { Html } from '@react-three/drei';
import { ROOM_PALETTE } from './colors';

/**
 * Áreas de lazer/serviço: copa com vending machine, mini academia, porta de banheiro.
 * Posicionadas nas laterais para dar a sensação de empresa real.
 */
export function LeisureAreas({ isNight }: { isNight: boolean }) {
  return (
    <group>
      {/* COPA — canto direito frontal */}
      <group position={[10, 0, 7]}>
        {/* Tapete */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <planeGeometry args={[3.5, 3.5]} />
          <meshStandardMaterial color={isNight ? '#1f2937' : '#fde68a'} transparent opacity={0.4} />
        </mesh>
        {/* Vending machine refri */}
        <group position={[-1, 0, -1.2]}>
          <mesh castShadow position={[0, 1, 0]}>
            <boxGeometry args={[0.9, 2, 0.7]} />
            <meshStandardMaterial color="#dc2626" metalness={0.4} roughness={0.4} />
          </mesh>
          <mesh position={[0, 1.2, 0.36]}>
            <planeGeometry args={[0.6, 1.2]} />
            <meshStandardMaterial color="#0f172a" emissive="#3b82f6" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 1.85, 0.36]}>
            <planeGeometry args={[0.7, 0.15]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.6} />
          </mesh>
        </group>
        {/* Vending machine snacks */}
        <group position={[0.1, 0, -1.2]}>
          <mesh castShadow position={[0, 1, 0]}>
            <boxGeometry args={[0.9, 2, 0.7]} />
            <meshStandardMaterial color="#1d4ed8" metalness={0.4} roughness={0.4} />
          </mesh>
          <mesh position={[0, 1.2, 0.36]}>
            <planeGeometry args={[0.6, 1.2]} />
            <meshStandardMaterial color="#0f172a" emissive="#10b981" emissiveIntensity={0.3} />
          </mesh>
        </group>
        {/* Mesinha */}
        <mesh castShadow position={[1, 0.5, 0.5]}>
          <cylinderGeometry args={[0.5, 0.5, 0.08, 16]} />
          <meshStandardMaterial color="#fafaf9" />
        </mesh>
        <mesh position={[1, 0.25, 0.5]}>
          <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        {/* Cafeteira */}
        <mesh castShadow position={[1, 0.65, 0.4]}>
          <boxGeometry args={[0.2, 0.25, 0.18]} />
          <meshStandardMaterial color="#374151" metalness={0.6} />
        </mesh>
        <Html position={[0, 2.6, 0]} center distanceFactor={14}>
          <div className="rounded bg-amber-600/80 px-2 py-0.5 text-[10px] font-bold text-white whitespace-nowrap">
            ☕ COPA
          </div>
        </Html>
      </group>

      {/* ACADEMIA — canto esquerdo frontal */}
      <group position={[-10, 0, 7]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <planeGeometry args={[3.5, 3.5]} />
          <meshStandardMaterial color={isNight ? '#1f2937' : '#cffafe'} transparent opacity={0.4} />
        </mesh>
        {/* Esteira */}
        <group position={[0.5, 0, -0.8]}>
          <mesh castShadow position={[0, 0.15, 0]}>
            <boxGeometry args={[0.7, 0.1, 1.6]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <boxGeometry args={[0.55, 0.02, 1.4]} />
            <meshStandardMaterial color="#0a0a0a" />
          </mesh>
          <mesh castShadow position={[0, 0.7, -0.7]}>
            <boxGeometry args={[0.7, 1.1, 0.08]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0, 1.2, -0.66]}>
            <planeGeometry args={[0.45, 0.25]} />
            <meshStandardMaterial color="#0a0a0a" emissive="#10b981" emissiveIntensity={0.6} />
          </mesh>
        </group>
        {/* Halteres */}
        {[-0.7, -0.3, 0.1].map((z, i) => (
          <group key={i} position={[-1, 0.15, z]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.15, 0.15, 0.1, 12]} rotation={[0, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#374151" metalness={0.7} />
            </mesh>
          </group>
        ))}
        {/* Espelho */}
        <mesh position={[1.6, 1.2, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[2, 1.8]} />
          <meshStandardMaterial color="#bae6fd" metalness={0.9} roughness={0.1} transparent opacity={0.5} />
        </mesh>
        <Html position={[0, 2.6, 0]} center distanceFactor={14}>
          <div className="rounded bg-cyan-600/80 px-2 py-0.5 text-[10px] font-bold text-white whitespace-nowrap">
            💪 ACADEMIA
          </div>
        </Html>
      </group>

      {/* BANHEIRO — canto direito do fundo */}
      <group position={[11.5, 0, -8]}>
        {/* Porta */}
        <mesh castShadow position={[0, 1.2, 0]}>
          <boxGeometry args={[0.1, 2.4, 1]} />
          <meshStandardMaterial color="#0f766e" />
        </mesh>
        <mesh position={[-0.06, 1.2, 0]}>
          <planeGeometry args={[0.6, 0.6]} rotation={[0, Math.PI / 2, 0]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
        <Html position={[0.2, 2.7, 0]} center distanceFactor={12}>
          <div className="rounded bg-teal-700/80 px-2 py-0.5 text-[10px] font-bold text-white whitespace-nowrap">
            🚻 WC
          </div>
        </Html>
      </group>
    </group>
  );
}
