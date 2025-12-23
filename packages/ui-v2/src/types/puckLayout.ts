export type LayoutRegionId = 'header' | 'sidebar' | 'canvas' | 'inspector';

export interface PuckBlockDescriptor {
  name: string;
  type?: string;
  props?: Record<string, unknown>;
  slot?: string;
  order?: number;
}

export interface LayoutRegion {
  id: LayoutRegionId;
  label?: string;
  blocks: PuckBlockDescriptor[];
}

export interface PuckLayout {
  version: number;
  regions?: LayoutRegion[]; // legacy single-page layout
  pages?: PuckPage[];
}

export interface PuckPage {
  id: string;
  label?: string;
  regions: LayoutRegion[];
}

export interface SidebarBlockProps {
  /**
   * Sidebar panels should render a compact, scroll-friendly section.
   * Use the plugin API to read flows or selection rather than assuming store shape.
   */
  role: 'sidebar';
}

export interface InspectorBlockProps {
  /**
   * Inspector sections render under the canvas and should focus on the selected node.
   * Only rely on the provided selection id and fetch more details through the plugin API.
   */
  role: 'inspector';
  selectedNodeId: string | null;
}

export interface CanvasOverlayProps {
  /**
   * Canvas overlays sit above the graph surface (e.g., minimaps or adorners).
   * Avoid mutating canvas internals directly; use plugin actions instead.
   */
  role: 'canvas';
  activeFlowName: string;
}
