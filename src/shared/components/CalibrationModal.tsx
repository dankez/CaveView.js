import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { ParsedCave, StationLabel } from '@shared/types';

interface CalibrationPoint {
  svg: { x: number; y: number };
  stationName: string;
}

interface Props {
  svgText: string;
  cave: ParsedCave;
  onCalibrate: (matches: { src: { x: number; y: number }; dst: { x: number; y: number } }[]) => void;
  onClose: () => void;
}

export const CalibrationModal: React.FC<Props> = ({ svgText, cave, onCalibrate, onClose }) => {
  const [points, setPoints] = useState<CalibrationPoint[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showLoupe, setShowLoupe] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const stationNames = Array.from(new Set(cave.stationLabels.map((l: StationLabel) => l.name))).sort();

  useEffect(() => {
    if (!showLoupe || !imgRef.current || !loupeCanvasRef.current) return;
    const ctx = loupeCanvasRef.current.getContext('2d');
    if (!ctx) return;
    const zoom = 10;
    const size = 150;
    loupeCanvasRef.current.width = size;
    loupeCanvasRef.current.height = size;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((mousePos.x - rect.left) / rect.width) * imgRef.current.naturalWidth;
    const y = ((mousePos.y - rect.top) / rect.height) * imgRef.current.naturalHeight;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(imgRef.current, x - (size/zoom)/2, y - (size/zoom)/2, size/zoom, size/zoom, 0, 0, size, size);
    ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(size/2, 0); ctx.lineTo(size/2, size); ctx.moveTo(0, size/2); ctx.lineTo(size, size/2); ctx.stroke();
  }, [mousePos, showLoupe]);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const vbMatch = svgText.match(/viewBox=["']([^"']+)["']/);
    let svgX, svgY;
    if (vbMatch) {
      const [vx, vy, vw, vh] = vbMatch[1].split(/[\s,]+/).map(parseFloat);
      svgX = vx + (clickX / rect.width) * vw;
      svgY = vy + (clickY / rect.height) * vh;
    } else {
      svgX = (clickX / rect.width) * imgRef.current.naturalWidth;
      svgY = (clickY / rect.height) * imgRef.current.naturalHeight;
    }
    if (selectedStation) {
      setPoints(prev => [...prev, { svg: { x: svgX, y: svgY }, stationName: selectedStation }]);
      setSelectedStation('');
    } else {
      alert('Najskôr vyberte stanicu zo zoznamu.');
    }
  };

  const submit = () => {
    if (points.length < 2) { alert('Potrebujete aspoň 2 body.'); return; }
    const matches = points.map(p => {
      const caveS = cave.stationLabels.find((l: StationLabel) => l.name === p.stationName);
      return { src: { x: caveS!.pos.x, y: -caveS!.pos.z }, dst: p.svg };
    });
    onCalibrate(matches);
    onClose();
  };

  const svgUrl = useMemo(() => {
    return svgText.startsWith('data:image')
      ? svgText
      : URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  }, [svgText]);

  useEffect(() => {
    return () => {
      if (!svgText.startsWith('data:image')) URL.revokeObjectURL(svgUrl);
    };
  }, [svgText, svgUrl]);

  return (
    <div className="calibration-overlay">
      <div className="calibration-content">
        <header>
          <h3>Manuálna kalibrácia mapy</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </header>
        <div className="calibration-body">
          <div className="svg-container" onMouseMove={(e) => { setMousePos({ x: e.clientX, y: e.clientY }); setShowLoupe(true); }} onMouseLeave={() => setShowLoupe(false)}>
            <p className="instruction">1. Vyberte stanicu. 2. Kliknite na mapu. Lupa (10x) pomáha zacieliť.</p>
            <div style={{ position: 'relative', flex: 1, overflow: 'auto' }}>
              <img ref={imgRef} src={svgUrl} alt="Map" onClick={handleImageClick} style={{ cursor: 'crosshair', border: '1px solid #444', display: 'block' }} />
              {showLoupe && (
                <canvas ref={loupeCanvasRef} style={{ position: 'fixed', left: mousePos.x+20, top: mousePos.y-160, border: '3px solid #2196f3', borderRadius: '50%', pointerEvents: 'none', zIndex: 10001, background: 'white', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }} />
              )}
            </div>
          </div>
          <div className="controls">
            <div className="station-picker">
              <label>Vybrať stanicu:</label>
              <select value={selectedStation} onChange={e => setSelectedStation(e.target.value)}>
                <option value="">-- vyberte stanicu --</option>
                {stationNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div className="points-list">
              <h4>Vybrané body ({points.length}):</h4>
              <ul>{points.map((p, i) => (<li key={i}>{p.stationName} <button onClick={() => setPoints(prev => prev.filter((_, idx) => idx !== i))}>×</button></li>))}</ul>
            </div>
            <button className="btn-primary" onClick={submit} disabled={points.length < 2}>Použiť kalibráciu</button>
          </div>
        </div>
      </div>
      <style>{`
        .calibration-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; color: white; font-family: sans-serif; }
        .calibration-content { background: #1a1a1a; width: 95vw; height: 95vh; border-radius: 12px; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.5); border: 1px solid #333; overflow: hidden; }
        header { padding: 1rem 1.5rem; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
        .btn-close { background: none; border: none; color: #888; font-size: 2rem; cursor: pointer; }
        .calibration-body { flex: 1; display: flex; overflow: hidden; padding: 1rem; gap: 1rem; }
        .svg-container { flex: 3; overflow: auto; background: #eee; border-radius: 8px; display: flex; flex-direction: column; position: relative; }
        .instruction { background: rgba(0,0,0,0.7); color: #4fc3f7; padding: 0.5rem 1rem; margin: 0; border-bottom: 1px solid #333; font-size: 0.9rem; }
        .controls { flex: 1; display: flex; flex-direction: column; gap: 1rem; min-width: 250px; }
        .station-picker select { width: 100%; padding: 0.6rem; background: #2a2a2a; color: white; border: 1px solid #444; border-radius: 6px; margin-top: 0.5rem; }
        .points-list { flex: 1; overflow-y: auto; background: #222; border-radius: 8px; padding: 1rem; }
        .points-list ul { list-style: none; padding: 0; margin: 0; }
        .points-list li { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #333; font-size: 0.85rem; }
        .btn-primary { background: #2196f3; color: white; border: none; padding: 1rem; border-radius: 8px; font-weight: bold; cursor: pointer; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
};
