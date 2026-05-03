import { Html } from '@react-three/drei';
import { ROOM_PALETTE } from './colors';

/**
 * Sala — chão, paredes, vigas e detalhes (plantas, janelas).
 * Tudo estático. Dimensões: 22 (x) x 18 (z), centro em 0,0.
 */
export function Room({ isNight }: { isNight?: boolean }) {
  const W = 24;
  const D = 18;

  return (
    <group>
      {/* Chão Principal com Grid Tech */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={isNight ? '#0f172a' : '#f8fafc'} roughness={0.8} />
      </mesh>
      <gridHelper args={[W, 20, isNight ? '#1e293b' : '#e2e8f0', isNight ? '#0f172a' : '#f1f5f9']} position={[0, 0.01, 0]} />

      {/* Divisórias de Vidro (Salas) */}
      <group>
        {/* Comercial vs Smart */}
        <mesh position={[-4, 1.5, -2]}>
          <boxGeometry args={[0.1, 3, 12]} />
          <meshStandardMaterial color="#bae0ff" transparent opacity={0.2} />
        </mesh>
        {/* Smart vs Administrativo */}
        <mesh position={[4, 1.5, -2]}>
          <boxGeometry args={[0.1, 3, 12]} />
          <meshStandardMaterial color="#bae0ff" transparent opacity={0.2} />
        </mesh>
        {/* Fundo (Operacional) */}
        <mesh position={[0, 1.5, 4]}>
          <boxGeometry args={[W, 3, 0.1]} />
          <meshStandardMaterial color="#bae0ff" transparent opacity={0.2} />
        </mesh>
      </group>

      {/* Rótulos das Salas */}
      <Html position={[-8, 3.5, -7]} center distanceFactor={12}>
        <div className="rounded bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
          COMERCIAL
        </div>
      </Html>
      <Html position={[0, 3.5, -7]} center distanceFactor={12}>
        <div className="rounded bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
          SMART IA
        </div>
      </Html>
      <Html position={[8, 3.5, -7]} center distanceFactor={12}>
        <div className="rounded bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
          FINANCEIRO
        </div>
      </Html>
      <Html position={[0, 3.5, 6]} center distanceFactor={12}>
        <div className="rounded bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
          OPERACIONAL
        </div>
      </Html>

      {/* Tapetes das Salas com bordas brilhantes */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[-8, 0.02, -2]}>
        <planeGeometry args={[7.2, 10.2]} />
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.1} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -2]}>
        <planeGeometry args={[7.2, 10.2]} />
        <meshStandardMaterial color="#8b5cf6" transparent opacity={0.1} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[8, 0.02, -2]}>
        <planeGeometry args={[7.2, 10.2]} />
        <meshStandardMaterial color="#10b981" transparent opacity={0.1} />
      </mesh>

      {/* Janelas com Céu Dinâmico */}
      {[-8, 0, 8].map((x) => (
        <group key={`win-group-${x}`} position={[x, 4, -D / 2 + 0.1]}>
          <mesh>
            <boxGeometry args={[4, 2.5, 0.1]} />
            <meshStandardMaterial 
              color={isNight ? '#0a192f' : '#87ceeb'} 
              emissive={isNight ? '#1a2c4e' : '#bae0ff'} 
              emissiveIntensity={isNight ? 1.2 : 0.4} 
            />
          </mesh>
          {/* Sol ou Lua na Janela */}
          <mesh position={[isNight ? -1 : 1, 0.5, 0.1]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshBasicMaterial color={isNight ? '#fdfcf0' : '#ffcf33'} />
          </mesh>
          {isNight && (
            <group>
              {[...Array(5)].map((_, i) => (
                <mesh key={i} position={[Math.random() * 3 - 1.5, Math.random() * 1.5 - 0.75, 0.15]}>
                  <sphereGeometry args={[0.02, 8, 8]} />
                  <meshBasicMaterial color="white" />
                </mesh>
              ))}
            </group>
          )}
        </group>
      ))}

      {/* Servidor Central (HUB de Integração) — Mais Tech */}
      <group position={[0, 0, -2]}>
        <mesh castShadow position={[0, 0.8, 0]}>
          <boxGeometry args={[1.5, 1.6, 1.5]} />
          <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.9} />
        </mesh>
        {/* Luzes pulsantes no servidor */}
        {[...Array(12)].map((_, i) => (
          <mesh key={i} position={[0.76, 1.4 - i * 0.12, 0]}>
            <boxGeometry args={[0.02, 0.05, 0.6]} />
            <meshStandardMaterial 
              color={i % 3 === 0 ? '#3b82f6' : i % 3 === 1 ? '#10b981' : '#f59e0b'} 
              emissive={i % 3 === 0 ? '#3b82f6' : i % 3 === 1 ? '#10b981' : '#f59e0b'} 
              emissiveIntensity={2} 
            />
          </mesh>
        ))}
        {/* Holograma em cima do servidor */}
        <mesh position={[0, 2, 0]} rotation={[0, Date.now() / 1000, 0]}>
          <octahedronGeometry args={[0.4]} />
          <meshStandardMaterial color="#60a5fa" transparent opacity={0.6} emissive="#60a5fa" emissiveIntensity={2} wireframe />
        </mesh>
      </group>
    </group>
  );
}
