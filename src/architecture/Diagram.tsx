import { ReactLikeC4, isLikeC4ViewId } from './likec4.generated';
export default function Diagram({ view, navigate, selectNode, selectFlow }: { view: string; navigate: (id: string) => void; selectNode: (id: string) => void; selectFlow: (source: string, target: string) => void }) {
  if (!isLikeC4ViewId(view)) return <p>Unknown architecture view.</p>;
  return <ReactLikeC4 viewId={view} colorScheme="dark" injectFontCss={false} pannable zoomable fitView showNavigationButtons enableDynamicViewWalkthrough onNavigateTo={navigate} onNodeClick={node => selectNode(node.modelRef || node.id)} onEdgeClick={edge => selectFlow(edge.source, edge.target)} />;
}
