import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ReactNode } from 'react';

interface CaveViewerProps {
  children?: ReactNode;
}

export const CaveViewer = ({ children }: CaveViewerProps) => {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#111' }}>
      <Canvas camera={{ position: [0, 0, 500], fov: 45 }}>
        <color attach="background" args={['#111']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} />
        {children}
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};
