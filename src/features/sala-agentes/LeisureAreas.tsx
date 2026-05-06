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
      <group position={[17, 0, 11]}>
        {/* Tapete de borracha high-tech */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <planeGeometry args={[4, 4]} />
          <meshStandardMaterial color="#111827" roughness={0.9} />
        </mesh>
        {/* Vending machine refri premium */}
        <group position={[-1.2, 0, -1]}>
          <mesh castShadow position={[0, 1, 0]}>
            <boxGeometry args={[1, 2.1, 0.8]} />
            <meshPhysicalMaterial color="#991b1b" metalness={0.7} roughness={0.1} />
          </mesh>
          <mesh position={[0, 1.2, 0.41]}>
            <planeGeometry args={[0.7, 1.3]} />
            <meshStandardMaterial color="#020617" emissive="#ef4444" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0, 1.95, 0.41]}>
            <planeGeometry args={[0.8, 0.2]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.8} />
          </mesh>
        </group>
        {/* Vending machine snacks */}
        <group position={[0.1, 0, -1]}>
          <mesh castShadow position={[0, 1, 0]}>
            <boxGeometry args={[1, 2.1, 0.8]} />
            <meshPhysicalMaterial color="#1e3a8a" metalness={0.7} roughness={0.1} />
          </mesh>
          <mesh position={[0, 1.2, 0.41]}>
            <planeGeometry args={[0.7, 1.3]} />
            <meshStandardMaterial color="#020617" emissive="#3b82f6" emissiveIntensity={0.2} />
          </mesh>
        </group>
        {/* Balcão de Café Moderno */}
        <mesh castShadow position={[1.4, 0.5, 0.5]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshPhysicalMaterial color="#ffffff" roughness={0.05} metalness={0.1} />
        </mesh>
        {/* Máquina de Café Espresso */}
        <group position={[1.4, 1.1, 0.5]}>
          <mesh castShadow>
            <boxGeometry args={[0.4, 0.5, 0.4]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.8} />
          </mesh>
          <pointLight position={[0, 0, 0.3]} intensity={0.5} color="#3b82f6" distance={1} />
        </group>
        <Html position={[0, 2.8, 0]} center distanceFactor={14}>
          <div className="rounded-full bg-amber-600/90 px-3 py-1 text-[9px] font-bold text-white border border-white/20 shadow-lg">
            LOUNGE & CAFÉ
          </div>
        </Html>
      </group>

      {/* ACADEMIA EXECUTIVA — canto esquerdo frontal */}
      <group position={[-17, 0, 11]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <planeGeometry args={[4, 4]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </mesh>
        {/* Esteira Profissional */}
        <group position={[0.5, 0, -0.8]}>
          <mesh castShadow position={[0, 0.15, 0]}>
            <boxGeometry args={[0.8, 0.15, 1.8]} />
            <meshStandardMaterial color="#111827" metalness={0.5} />
          </mesh>
          <mesh castShadow position={[0, 0.7, -0.8]}>
            <boxGeometry args={[0.8, 1.2, 0.1]} />
            <meshStandardMaterial color="#1f2937" metalness={0.8} />
          </mesh>
          <mesh position={[0, 1.3, -0.74]}>
            <planeGeometry args={[0.6, 0.3]} />
            <meshStandardMaterial color="#000" emissive="#10b981" emissiveIntensity={0.5} />
          </mesh>
        </group>
        {/* Suporte de Halteres */}
        <group position={[-1.2, 0.3, -0.5]}>
          <mesh castShadow>
            <boxGeometry args={[0.4, 0.6, 1.5]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          {[0, 0.4, -0.4].map((z, i) => (
            <mesh key={i} position={[0, 0.35, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.12, 0.12, 0.6]} />
              <meshStandardMaterial color="#000" metalness={0.9} />
            </mesh>
          ))}
        </group>
        {/* Espelho de Parede Realista */}
        <mesh position={[-1.9, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[3, 2.5]} />
          <meshPhysicalMaterial 
            color="#bae6fd" 
            metalness={1} 
            roughness={0} 
            transmission={0} 
            reflectivity={1}
          />
        </mesh>
        <Html position={[0, 2.8, 0]} center distanceFactor={14}>
          <div className="rounded-full bg-cyan-600/90 px-3 py-1 text-[9px] font-bold text-white border border-white/20 shadow-lg">
            WELLNESS CENTER
          </div>
        </Html>
      </group>

      {/* ÁREA PRIVATIVA / WC — fundo */}
      <group position={[12.5, 0, -8]}>
        <mesh castShadow position={[0, 1.25, 0]}>
          <boxGeometry args={[0.15, 2.5, 1.2]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <mesh position={[-0.08, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
        <Html position={[0, 2.8, 0]} center distanceFactor={12}>
          <div className="rounded-full bg-slate-700/90 px-3 py-1 text-[9px] font-bold text-white border border-white/20 shadow-lg">
            ÁREA PRIVATIVA
          </div>
        </Html>
      </group>
    </group>
  );
}
