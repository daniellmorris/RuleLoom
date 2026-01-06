import React, { useEffect, useState } from "react";

type TableData = { columns: string[]; rows: any[] };

const TableWidget: React.FC<{
  title?: string;
  data?: any;
  endpoint?: string;
  columns?: string;
}> = ({ title, data, endpoint, columns }) => {
  const [resolved, setResolved] = useState<TableData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fromConfig = toTableData(data, columns);
    if (!endpoint) {
      setResolved(fromConfig);
      setError(null);
      return;
    }
    setLoading(true);
    fetch(endpoint)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const fromFetch = toTableData(json, columns);
        setResolved(fromFetch);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? "Failed to fetch");
        setResolved(fromConfig);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, data, columns]);

  const parsed = resolved;
  const hasTable =
    parsed && Array.isArray(parsed?.rows) && Array.isArray(parsed?.columns);

  return (
    <div className="panel" style={{ minHeight: 140 }}>
      <div
        style={{
          fontWeight: 700,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{title ?? "Table"}</span>
        {loading && (
          <span style={{ color: "var(--muted)", fontSize: 11 }}>Loading…</span>
        )}
      </div>
      {error && (
        <div style={{ color: "#b00020", fontSize: 12, marginTop: 4 }}>
          Error: {error}
        </div>
      )}
      {hasTable ? (
        <table style={{ width: "100%", fontSize: 12, marginTop: 6 }}>
          <thead>
            <tr>
              {parsed!.columns.map((c: string) => (
                <th
                  key={c}
                  style={{
                    textAlign: "left",
                    paddingBottom: 4,
                    color: "var(--muted)",
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed!.rows.map((row: any, rIdx: number) => (
              <tr key={rIdx}>
                {parsed!.columns.map((c: string) => (
                  <td
                    key={c}
                    style={{
                      padding: "2px 0",
                      borderBottom: "1px solid var(--panel-border)",
                    }}
                  >
                    {row?.[c] !== undefined ? String(row[c]) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
          No data yet.
        </div>
      )}
    </div>
  );
};

export default TableWidget;

function toTableData(value: any, columnsCsv?: string): TableData | null {
  const parsed = parseJsonSafe(value);
  if (parsed && Array.isArray(parsed?.rows)) {
    const explicitCols =
      columnsCsv && columnsCsv.trim().length
        ? columnsCsv
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
        : null;
    const cols =
      explicitCols ??
      (Array.isArray(parsed.columns) && parsed.columns.length
        ? parsed.columns
        : Object.keys(parsed.rows[0] ?? {}));
    return { columns: cols, rows: parsed.rows };
  }

  if (Array.isArray(parsed)) {
    const cols = columnsCsv
      ? columnsCsv
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : Object.keys(parsed[0] ?? {});
    return { columns: cols, rows: parsed };
  }

  return null;
}

function parseJsonSafe(value: any) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (value && typeof value === "object") return value;
  return undefined;
}
