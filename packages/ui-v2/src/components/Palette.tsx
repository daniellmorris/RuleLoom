import React from "react";
import { useCatalogStore } from "../state/catalogStore";
import { useAppStore } from "../state/appStore";
import { useFlowStore } from "../state/flowStore";

const Palette: React.FC = () => {
  const availableClosures = useCatalogStore((s) => s.availableClosures);
  const availableInputs = useCatalogStore((s) => s.availableInputs);
  const addTriggerToStore = useAppStore((s) => s.addTrigger);
  const addClosureStepToStore = useAppStore((s) => s.addClosureStep);
  const flowIdx = useFlowStore((s) => s.activeFlowId);
  const flowName = useAppStore((s) => s.app.flows[flowIdx]?.name ?? "Flow 1");

  const addTrigger = (type: string) => {
    addTriggerToStore(type, flowName);
  };

  const addClosure = (name: string) => {
    addClosureStepToStore(flowIdx, name);
  };

  return (
    <div className="panel stack">
      <h3>Palette</h3>
      <div className="stack">
        {availableInputs.map((inp) => (
          <button key={inp} className="button" onClick={() => addTrigger(inp)}>
            Add {inp} trigger
          </button>
        ))}
        {availableClosures.map((c) => (
          <button key={c} className="button secondary" onClick={() => addClosure(c)}>
            Add {c}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Palette;
