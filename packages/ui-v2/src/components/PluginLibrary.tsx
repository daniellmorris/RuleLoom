import React, { useMemo, useState } from "react";
import { useCatalogStore } from "../state/catalogStore";

import slackManifest from "../../../../plugins/rule-loom-plugin-slack/ruleloom.manifest.yaml?raw";
import s3Manifest from "../../../../plugins/rule-loom-plugin-s3/ruleloom.manifest.yaml?raw";
import postgresManifest from "../../../../plugins/rule-loom-plugin-postgres/ruleloom.manifest.yaml?raw";
import mysqlManifest from "../../../../plugins/rule-loom-plugin-mysql/ruleloom.manifest.yaml?raw";
import googleManifest from "../../../../plugins/rule-loom-plugin-google/ruleloom.manifest.yaml?raw";
import notionManifest from "../../../../plugins/rule-loom-plugin-notion/ruleloom.manifest.yaml?raw";
import mqttManifest from "../../../../plugins/rule-loom-plugin-mqtt/ruleloom.manifest.yaml?raw";
import openaiManifest from "../../../../plugins/rule-loom-plugin-openai/ruleloom.manifest.yaml?raw";

const plugins = [
  { name: "Slack", path: "plugins/rule-loom-plugin-slack/ruleloom.manifest.yaml", raw: slackManifest },
  { name: "S3", path: "plugins/rule-loom-plugin-s3/ruleloom.manifest.yaml", raw: s3Manifest },
  { name: "Postgres", path: "plugins/rule-loom-plugin-postgres/ruleloom.manifest.yaml", raw: postgresManifest },
  { name: "MySQL", path: "plugins/rule-loom-plugin-mysql/ruleloom.manifest.yaml", raw: mysqlManifest },
  { name: "Google", path: "plugins/rule-loom-plugin-google/ruleloom.manifest.yaml", raw: googleManifest },
  { name: "Notion", path: "plugins/rule-loom-plugin-notion/ruleloom.manifest.yaml", raw: notionManifest },
  { name: "MQTT", path: "plugins/rule-loom-plugin-mqtt/ruleloom.manifest.yaml", raw: mqttManifest },
  { name: "OpenAI", path: "plugins/rule-loom-plugin-openai/ruleloom.manifest.yaml", raw: openaiManifest }
];

const PluginLibrary: React.FC = () => {
  const addManifest = useCatalogStore((s) => s.addManifest);
  const [selected, setSelected] = useState(plugins[0]?.path ?? "");
  const selectedLabel = useMemo(() => plugins.find((p) => p.path === selected)?.name ?? "", [selected]);

  const load = () => {
    const item = plugins.find((p) => p.path === selected);
    if (!item) return;
    addManifest(item.raw as string);
  };

  return (
    <div className="panel stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Plugins</h3>
        <span className="badge" title="Manifest path">{selectedLabel || "Select"}</span>
      </div>
      <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
        {plugins.map((p) => (
          <option key={p.path} value={p.path}>
            {p.name}
          </option>
        ))}
      </select>
      <button className="button" onClick={load}>Load plugin manifest</button>
      <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
        Adds closures and inputs from the selected plugin manifest into the palette.
      </p>
    </div>
  );
};

export default PluginLibrary;
