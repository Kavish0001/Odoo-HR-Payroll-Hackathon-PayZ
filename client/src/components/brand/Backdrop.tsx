import { Component, lazy, Suspense, type ReactNode } from 'react';

import { MachinedBackdrop } from './MachinedBackdrop.js';

/**
 * The page backdrop: line drawings always, turning objects when they can be
 * afforded.
 *
 * The SVG layer is cheap and paints immediately. The 3D layer pulls in three.js,
 * which is large, so it is code-split and arrives afterwards without holding up
 * first paint. If WebGL is unavailable, the device is small, or the models fail
 * to load, the drawings simply stay on their own and nothing looks broken.
 */

const ModelBackdrop = lazy(() =>
  import('./ModelBackdrop.js').then((m) => ({ default: m.ModelBackdrop })),
);

/**
 * A canvas failure must never take a payroll screen with it, and there is
 * nothing to retry: the page is complete without this layer.
 */
class QuietBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

function canRender3d(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  // Not worth the battery or the bandwidth on a phone.
  if (window.matchMedia('(max-width: 900px)').matches) {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    return (
      canvas.getContext('webgl2') !== null ||
      canvas.getContext('webgl') !== null
    );
  } catch {
    return false;
  }
}

export function Backdrop({
  density = 'full',
}: {
  /** 'minimal' shows two objects, for pages with little content of their own. */
  density?: 'minimal' | 'full';
}): React.JSX.Element {
  return (
    <>
      <MachinedBackdrop />
      {canRender3d() && (
        <QuietBoundary>
          <Suspense fallback={null}>
            <ModelBackdrop density={density} />
          </Suspense>
        </QuietBoundary>
      )}
    </>
  );
}
