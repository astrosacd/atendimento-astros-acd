import { ROOM_PALETTE } from './colors';

/**
 * Sala — chão, paredes, vigas e detalhes (plantas, janelas).
 * Tudo estático. Dimensões: 22 (x) x 18 (z), centro em 0,0.
 */
export function Room({ isNight }: { isNight?: boolean }) {
  const W = 22;
  const D = 18;

  return (
    <group>
      {/* Chão */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={isNight ? '#2c3340' : ROOM_PALETTE.floor} roughness={0.85} />
      </mesh>

      {/* Tapete azul central */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[10, 6]} />
        <meshStandardMaterial color="#cfd9eb" roughness={0.95} />
      </mesh>

      {/* Parede fundo (norte) */}
      <mesh position={[0, 3, -D / 2]}>
        <boxGeometry args={[W, 6, 0.2]} />
        <meshStandardMaterial color={isNight ? '#1e2430' : ROOM_PALETTE.wall} roughness={0.95} />
      </mesh>
      {/* Parede esquerda */}
      <mesh position={[-W / 2, 3, 0]}>
        <boxGeometry args={[0.2, 6, D]} />
        <meshStandardMaterial color={isNight ? '#1e2430' : ROOM_PALETTE.wall} roughness={0.95} />
      </mesh>
      {/* Parede direita */}
      <mesh position={[W / 2, 3, 0]}>
        <boxGeometry args={[0.2, 6, D]} />
        <meshStandardMaterial color={isNight ? '#1e2430' : ROOM_PALETTE.wall} roughness={0.95} />
      </mesh>

      {/* Janelas no fundo (3) */}
      {[-6, 0, 6].map((x) => (
        <mesh key={`win-${x}`} position={[x, 4, -D / 2 + 0.15]}>
          <boxGeometry args={[3, 1.6, 0.05]} />
          <meshStandardMaterial 
            color={isNight ? '#0a192f' : '#bae0ff'} 
            emissive={isNight ? '#1a2c4e' : '#bae0ff'} 
            emissiveIntensity={isNight ? 0.8 : 0.3} 
          />
        </mesh>
      ))}

      {/* Vigas de teto (visual) */}
      {[-7, -3, 1, 5, 9].map((x) => (
        <mesh key={`viga-${x}`} position={[x, 5.6, 0]}>
          <boxGeometry args={[0.15, 0.15, D - 1]} />
          <meshStandardMaterial color={ROOM_PALETTE.wallTrim} />
        </mesh>
      ))}

      {/* Plantas nos cantos */}
      {[
        [-W / 2 + 1, 7],
        [W / 2 - 1, 7],
        [-W / 2 + 1, -7],
        [W / 2 - 1, -7],
      ].map(([x, z], i) => (
        <group key={`plant-${i}`} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.25, 0.3, 0.5, 12]} />
            <meshStandardMaterial color={ROOM_PALETTE.plantPot} />
          </mesh>
          <mesh castShadow position={[0, 0.85, 0]}>
            <sphereGeometry args={[0.5, 12, 10]} />
            <meshStandardMaterial color={ROOM_PALETTE.plantLeaf} roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0.2, 1.2, 0]}>
            <sphereGeometry args={[0.32, 12, 10]} />
            <meshStandardMaterial color={ROOM_PALETTE.plantLeaf} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Mesa de centro com "servidor" decorativo */}
      <group position={[0, 0, 0]}>
        <mesh castShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[1.4, 1, 0.8]} />
          <meshStandardMaterial color="#23304a" />
        </mesh>
        {/* Luzinhas piscantes do servidor */}
        {[-0.4, -0.2, 0, 0.2, 0.4].map((x, i) => (
          <mesh key={`led-${i}`} position={[x, 0.85, 0.42]}>
            <boxGeometry args={[0.07, 0.07, 0.02]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#22c55e' : '#3b82f6'} emissive={i % 2 === 0 ? '#22c55e' : '#3b82f6'} emissiveIntensity={0.8} />
          </mesh>
        ))}
        {/* Texto flutuante */}
      </group>
    </group>
  );
}
