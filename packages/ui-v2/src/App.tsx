import Canvas from "./components/Canvas";
import Inspector from "./components/Inspector";
import ImportExport from "./components/ImportExport";
import Palette from "./components/Palette";
import { useFlowStore } from "./state/flowStore";
import "./styles/global.css";

const App = () => {
  const flow = useFlowStore((s) => {
    const mode = s.activeMode;
    if (mode === "closure") {
      return s.closures.find((f) => f.id === s.activeClosureId) ?? s.closures[0];
    }
    return s.flows.find((f) => f.id === s.activeFlowId) ?? s.flows[0];
  });
  const layout = useFlowStore((s) => s.layout);
  const flows = useFlowStore((s) => s.activeMode === "flow" ? s.flows : s.closures);
  const activeFlowId = useFlowStore((s) => s.activeMode === "flow" ? s.activeFlowId : s.activeClosureId);
  const setActiveFlow = useFlowStore((s) => s.activeMode === "flow" ? s.setActiveFlow : s.setActiveClosure);
  const addFlow = useFlowStore((s) => s.activeMode === "flow" ? s.addFlow : s.addClosureFlow);
  const setMode = useFlowStore((s) => s.setActiveMode);
  const mode = useFlowStore((s) => s.activeMode);
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
        <div className="pill" style={{ fontWeight: 600 }}>Orchestrator UI v2</div>
        <div className="row" style={{ gap: 6 }}>
          <button className={`button ${mode === "flow" ? "" : "secondary"}`} onClick={() => setMode("flow")}>
            Flows
          </button>
          <button className={`button ${mode === "closure" ? "" : "secondary"}`} onClick={() => setMode("closure")}>
            Closures
          </button>
        </div>
        {flow && (
          <>
            <select
              className="input"
              style={{ width: 200 }}
              value={activeFlowId ?? ""}
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
              value={flow.name ?? ""}
              onChange={(e) => setFlowName(e.target.value)}
            />
          </>
        )}
        <button className="button secondary" onClick={() => addFlow(`${mode === "flow" ? "Flow" : "Closure"} ${flows.length + 1}`)}>
          Add {mode === "flow" ? "flow" : "closure"}
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
