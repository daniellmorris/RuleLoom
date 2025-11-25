import { NodeKind } from "../types";

export const getNodeColor = (kind: NodeKind): string => {
  switch (kind) {
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
