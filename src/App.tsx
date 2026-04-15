import { useState } from 'react';
import { CaveViewer } from './components/CaveViewer';
import { UI } from './components/UI';
import { SurveyLines } from './components/SurveyLines';
import { Stations } from './components/Stations';
import { Scraps } from './components/Scraps';
import { LoxParser } from './loaders/LoxParser';
import { SurveyData } from './types';
import { Center } from '@react-three/drei';

function App() {
  const [data, setData] = useState<SurveyData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const [options, setOptions] = useState({
    showSplays: true,
    showSurface: true,
    showStations: true,
    showScraps: true,
  });

  const handleFileLoad = (buffer: ArrayBuffer) => {
    try {
      const parsedData = LoxParser.parse(buffer);
      setData(parsedData);
      setFileName("Súbor načítaný");
    } catch (err) {
      console.error("Error parsing lox file:", err);
      alert("Chyba pri načítaní súboru.");
    }
  };

  return (
    <>
      <CaveViewer>
        {data && (
          <Center>
            <SurveyLines
              shots={data.shots}
              showSplays={options.showSplays}
              showSurface={options.showSurface}
            />
            <Stations
              stations={data.stations}
              visible={options.showStations}
            />
            <Scraps
              scraps={data.scraps}
              visible={options.showScraps}
            />
          </Center>
        )}
      </CaveViewer>
      <UI
        onFileLoad={handleFileLoad}
        options={options}
        onOptionsChange={setOptions}
        fileName={fileName}
      />
    </>
  );
}

export default App;
