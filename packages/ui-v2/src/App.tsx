import Canvas from "./components/Canvas";
import Inspector from "./components/Inspector";
import ImportExport from "./components/ImportExport";
import Palette from "./components/Palette";
import { useFlowStore } from "./state/flowStore";
import "./styles/global.css";

const App = () => {
  const flow = useFlowStore((s) => s.flows.find((f) => f.id === s.activeFlowId)!);
  const layout = useFlowStore((s) => s.layout);
  const flows = useFlowStore((s) => s.flows);
  const activeFlowId = useFlowStore((s) => s.activeFlowId);
  const setActiveFlow = useFlowStore((s) => s.setActiveFlow);
  const addFlow = useFlowStore((s) => s.addFlow);
  const setFlowName = useFlowStore((s) => s.setFlowName);

  return (
    <div className="app-shell">
      <header
        style={{
          gridArea: "header",
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12
        }}
      >
        <div className="pill" style={{ fontWeight: 600 }}>
          Orchestrator UI v2
        </div>
        <select
          className="input"
          style={{ width: 200 }}
          value={activeFlowId}
          onChange={(e) => setActiveFlow(e.target.value)}
        >
          {flows.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <input
          className="input"
          style={{ width: 180 }}
          value={flow.name}
          onChange={(e) => setFlowName(e.target.value)}
        />
        <button className="button secondary" onClick={() => addFlow(`Flow ${flows.length + 1}`)}>
          Add flow
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="button secondary" onClick={layout}>
            Auto layout
          </button>
          <button className="button secondary">Draft</button>
          <button className="button">Publish</button>
        </div>
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
