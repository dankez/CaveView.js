import React, { useRef } from 'react';
import { Upload, Eye, EyeOff, Layers } from 'lucide-react';

interface UIProps {
  onFileLoad: (buffer: ArrayBuffer) => void;
  options: {
    showSplays: boolean;
    showSurface: boolean;
    showStations: boolean;
    showScraps: boolean;
  };
  onOptionsChange: (options: any) => void;
  fileName: string | null;
}

export const UI = ({ onFileLoad, options, onOptionsChange, fileName }: UIProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        onFileLoad(buffer);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const toggleOption = (key: keyof typeof options) => {
    onOptionsChange({ ...options, [key]: !options[key] });
  };

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      left: 20,
      background: 'rgba(20, 20, 20, 0.85)',
      padding: '20px',
      borderRadius: '12px',
      color: 'white',
      fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.1)',
      width: '280px'
    }}>
      <h2 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Layers size={20} />
        3D Cave Viewer
      </h2>

      <input
        type="file"
        accept=".lox"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        style={{
          width: '100%',
          padding: '10px',
          background: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontWeight: '500',
          marginBottom: '15px'
        }}
      >
        <Upload size={18} />
        Otvoriť .lox súbor
      </button>

      {fileName && (
        <div style={{ marginBottom: '20px', fontSize: '0.9rem', color: '#9ca3af', wordBreak: 'break-all' }}>
          Načítané: <strong>{fileName}</strong>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Toggle label="Zobraziť splays" active={options.showSplays} onClick={() => toggleOption('showSplays')} />
        <Toggle label="Zobraziť povrch" active={options.showSurface} onClick={() => toggleOption('showSurface')} />
        <Toggle label="Zobraziť stanice" active={options.showStations} onClick={() => toggleOption('showStations')} />
        <Toggle label="Zobraziť steny (scraps)" active={options.showScraps} onClick={() => toggleOption('showScraps')} />
      </div>
    </div>
  );
};

const Toggle = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer',
      padding: '8px',
      borderRadius: '6px',
      background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
      transition: 'background 0.2s'
    }}
  >
    <span style={{ fontSize: '0.95rem' }}>{label}</span>
    {active ? <Eye size={18} color="#60a5fa" /> : <EyeOff size={18} color="#6b7280" />}
  </div>
);
