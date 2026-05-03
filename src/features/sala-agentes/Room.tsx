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
      {/* Chão Principal */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={isNight ? '#1a1c2c' : '#e6d8be'} roughness={0.9} />
      </mesh>

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

      {/* Tapetes das Salas */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[-8, 0.01, -2]}>
        <planeGeometry args={[7, 10]} />
        <meshStandardMaterial color="#dbeafe" roughness={0.9} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -2]}>
        <planeGeometry args={[7, 10]} />
        <meshStandardMaterial color="#f3e8ff" roughness={0.9} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[8, 0.01, -2]}>
        <planeGeometry args={[7, 10]} />
        <meshStandardMaterial color="#ecfdf5" roughness={0.9} />
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

      {/* Servidor Central (HUB de Integração) */}
      <group position={[0, 0, -2]}>
        <mesh castShadow position={[0, 0.6, 0]}>
          <boxGeometry args={[1.2, 1.2, 1.2]} />
          <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.8} />
        </mesh>
        {[...Array(8)].map((_, i) => (
          <mesh key={i} position={[0.61, 1 - i * 0.12, 0]}>
            <boxGeometry args={[0.02, 0.05, 0.4]} />
            <meshStandardMaterial 
              color={i % 2 === 0 ? '#22c55e' : '#3b82f6'} 
              emissive={i % 2 === 0 ? '#22c55e' : '#3b82f6'} 
              emissiveIntensity={1.5} 
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
