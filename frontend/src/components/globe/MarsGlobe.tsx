
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";


function Mars() {
  const marsRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (marsRef.current) {
      marsRef.current.rotation.y += delta * 0.055;
    }
  });

  return (
    <mesh ref={marsRef}>
      <sphereGeometry args={[2, 96, 96]} />
      <meshStandardMaterial
        color="#b95732"
        roughness={0.95}
        metalness={0.02}
      />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[5, 3, 5]}
        intensity={3}
        color="#fff0d9"
      />
      <pointLight position={[-5, -2, -4]} intensity={1.2} color="#e46b38" />

      <Mars />

      <Stars
        radius={80}
        depth={45}
        count={2200}
        factor={3}
        saturation={0}
        fade
        speed={0.3}
      />

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={2.8}
        maxDistance={8}
        rotateSpeed={0.55}
      />
    </>
  );
}

export default function MarsGlobe() {
  return (
    <div className="mars-canvas">
      <Canvas camera={{ position: [0, 0, 6.5], fov: 42 }}>
        <Scene />
      </Canvas>
    </div>
  );
}
