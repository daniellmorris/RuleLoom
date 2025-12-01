import { NodeKind } from "../types";

export const getNodeColor = (kind: NodeKind): string => {
  switch (kind) {
    case "start":
      return "#7dd3fc";
    case "input":
      return "var(--input-node)";
    case "branch":
      return "var(--branch-node)";
    case "closure":
      return "var(--closure-node)";
    default:
      return "var(--accent)";
  }
};
