import Canvas from "./components/Canvas";
import Inspector from "./components/Inspector";
import Palette from "./components/Palette";
import ImportExport from "./components/ImportExport";
import { useFlowStore } from "./state/flowStore";
import { useAppStore } from "./state/appStore";
import "./styles/global.css";

const App = () => {
  const app = useAppStore((s) => s.app);
  const activeIdx = useFlowStore((s) => s.activeFlowId);
  const setActiveFlow = useFlowStore((s) => s.setActiveFlow);

  return (
    <div className="app-shell">
      <header style={{ gridArea: "header", padding: "12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <div className="pill" style={{ fontWeight: 600 }}>Orchestrator UI v3 (WIP)</div>
        <select className="input" style={{ width: 220 }} value={activeIdx} onChange={(e) => setActiveFlow(Number(e.target.value))}>
          {app.flows.map((f, idx) => (
            <option key={idx} value={idx}>{f.name}</option>
          ))}
        </select>
      </header>

      <aside style={{ gridArea: "sidebar", padding: 12 }}>
        <div className="stack">
          <Palette />
          <ImportExport />
        </div>
      </aside>

      <main style={{ gridArea: "canvas", padding: 12 }}>
        <Canvas />
      </main>

      <aside style={{ gridArea: "inspector", padding: 12 }}>
        <Inspector />
      </aside>
    </div>
  );
};

export default App;
