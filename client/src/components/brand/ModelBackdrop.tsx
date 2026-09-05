import { useGLTF } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * Machined objects turning slowly behind the interface.
 *
 * The rules that keep this decoration rather than distraction:
 *
 *   - Very low opacity, and depth writing off, so nothing ever competes with
 *     text or hides a control.
 *   - The whole canvas is pointer-events-none and aria-hidden.
 *   - Rotation is tied to elapsed time, not frame count, so it turns at the
 *     same speed on a fast machine and a slow one.
 *   - It respects prefers-reduced-motion by holding still.
 *
 * The models keep no colour of their own. They are re-materialised in the
 * palette's steel so the backdrop cannot introduce a hue the design system
 * does not have.
 */

/**
 * Each object has a home, a size, a spin rate per axis, and a drift.
 *
 * The drift is an ellipse rather than a straight line: an object that wanders
 * off in one direction either has to be teleported back, which is visible, or
 * it leaves the frame for good. Travelling a slow closed loop means it is
 * always moving and always on screen.
 *
 * Rates are deliberately unrelated to one another, so the four never fall into
 * a repeating pattern that the eye can latch onto.
 */
const MODELS = [
  {
    url: '/models/stacked-rings.glb',
    position: [-3.1, 0.9, 0],
    scale: 2.8,
    spin: [0.021, 0.045, 0.013],
    drift: { x: 1.5, y: 0.9, rate: 0.052, phase: 0 },
  },
  {
    url: '/models/twisted-prism.glb',
    position: [3.2, -0.5, -1],
    scale: 3.1,
    spin: [-0.017, -0.035, 0.023],
    drift: { x: 1.2, y: 1.3, rate: 0.041, phase: 1.9 },
  },
  {
    url: '/models/abstract-geometric.glb',
    position: [1.1, 1.9, -2],
    scale: 2.4,
    spin: [0.029, 0.026, -0.019],
    drift: { x: 1.7, y: 0.7, rate: 0.063, phase: 3.4 },
  },
  {
    url: '/models/chip-badge.glb',
    position: [-1.7, -1.8, -1.2],
    scale: 2.6,
    spin: [-0.024, 0.051, 0.016],
    drift: { x: 1.0, y: 1.1, rate: 0.047, phase: 5.1 },
  },
] as const;

type ModelSpec = (typeof MODELS)[number];
type Vec = [number, number, number];

/** How close two objects may get before they start pushing each other away. */
const MIN_SEPARATION = 3.4;

/** Where an object would be on its own, before its neighbours are considered. */
function basePosition(model: ModelSpec, t: number): Vec {
  const angle = t * model.drift.rate + model.drift.phase;
  return [
    model.position[0] + Math.cos(angle) * model.drift.x,
    model.position[1] + Math.sin(angle * 0.8) * model.drift.y,
    model.position[2] + Math.sin(angle * 0.5) * 0.6,
  ];
}

/**
 * Drift positions with a separation force applied.
 *
 * Left to their own ellipses the paths eventually cross, and two faint objects
 * overlapping read as one muddy shape. Any pair closer than MIN_SEPARATION is
 * pushed apart along the line between them, so they stay legible as distinct
 * objects while still wandering.
 *
 * Resolved for every object at once from the current time, so the result does
 * not depend on which component renders first, and two objects can never
 * disagree about how far apart they are.
 */
function resolvePositions(models: readonly ModelSpec[], t: number): Vec[] {
  const positions = models.map((model) => basePosition(model, t));

  // A couple of relaxation passes: one resolves most overlaps, a second
  // settles the case where pushing A off B moves it into C.
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const a = positions[i];
        const b = positions[j];
        if (a === undefined || b === undefined) {
          continue;
        }

        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        const distance = Math.hypot(dx, dy, dz);

        if (distance >= MIN_SEPARATION) {
          continue;
        }

        // Exactly coincident: nudge along x rather than divide by zero.
        const nx = distance === 0 ? 1 : dx / distance;
        const ny = distance === 0 ? 0 : dy / distance;
        const nz = distance === 0 ? 0 : dz / distance;
        const push = (MIN_SEPARATION - distance) / 2;

        a[0] -= nx * push;
        a[1] -= ny * push;
        a[2] -= nz * push;
        b[0] += nx * push;
        b[1] += ny * push;
        b[2] += nz * push;
      }
    }
  }

  return positions;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Drifting({
  url,
  scale,
  spin,
  models,
  index,
}: {
  url: string;
  scale: number;
  spin: readonly [number, number, number];
  models: readonly ModelSpec[];
  index: number;
}): React.JSX.Element {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  const still = prefersReducedMotion();

  /**
   * A private copy with the palette's material.
   *
   * useGLTF caches by URL, so mutating the loaded scene would change every
   * other instance too. Cloning keeps each object independent, and replacing
   * the material is what stops an imported model dragging its own colours
   * into a four-colour system.
   */
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#9fb6bd'),
      metalness: 0.9,
      roughness: 0.35,
      transparent: true,
      opacity: 0.13,
      // Off, so overlapping objects never punch holes in one another and the
      // whole thing reads as one faint wash rather than stacked cut-outs.
      depthWrite: false,
    });

    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = material;
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });

    return clone;
  }, [scene]);

  useFrame(({ clock }) => {
    if (group.current === null || still) {
      return;
    }
    const t = clock.getElapsedTime();

    // Turning on all three axes, each at its own rate, so the object never
    // presents the same face twice in a row.
    group.current.rotation.x = t * spin[0];
    group.current.rotation.y = t * spin[1];
    group.current.rotation.z = t * spin[2];

    // A slow ellipse around home, then pushed clear of any close neighbour.
    const resolved = resolvePositions(models, t)[index];
    if (resolved !== undefined) {
      group.current.position.set(resolved[0], resolved[1], resolved[2]);
    }
  });

  return (
    <group ref={group} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

/**
 * Which objects appear.
 *
 * A sparse page shows the backdrop far more than a dense one does, so the
 * landing and sign-in screens take two objects where a table-heavy screen can
 * carry four without reading as clutter.
 */
export type BackdropDensity = 'minimal' | 'full';

const MINIMAL = new Set([
  '/models/chip-badge.glb',
  '/models/stacked-rings.glb',
]);

export function ModelBackdrop({
  density = 'full',
}: {
  density?: BackdropDensity;
}): React.JSX.Element {
  const models =
    density === 'minimal' ? MODELS.filter((m) => MINIMAL.has(m.url)) : MODELS;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <Canvas
        camera={{ position: [0, 0, 9], fov: 42 }}
        // No alpha clearing colour: the page ground shows through.
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        // Capped, because this is wallpaper and has no business spending a
        // retina display's full pixel budget.
        dpr={[1, 1.5]}
        frameloop={prefersReducedMotion() ? 'demand' : 'always'}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[4, 6, 5]} intensity={1.1} />
        <directionalLight position={[-5, -3, 2]} intensity={0.4} />

        {models.map((model, index) => (
          <Drifting
            key={model.url}
            url={model.url}
            scale={model.scale}
            spin={model.spin}
            models={models}
            index={index}
          />
        ))}
      </Canvas>
    </div>
  );
}

for (const model of MODELS) {
  useGLTF.preload(model.url);
}
