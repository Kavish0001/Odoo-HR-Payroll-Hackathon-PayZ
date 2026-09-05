import { Circle, G, Path, Svg } from '@react-pdf/renderer';

/**
 * The PayZ coin, drawn for print.
 *
 * `payz_coin_icon.svg` is the one mark used everywhere, but it leans on SVG
 * patterns and filters for its brushed metal, and `@react-pdf/renderer`
 * supports neither. Redrawing it in the primitives the renderer does support
 * keeps the same geometry — reeded rim, machined rings, the eight-slot
 * grille, the red mint mark — with the shading flattened into concentric
 * bands instead of a radial gradient. On paper, which is usually greyscale
 * anyway, the two are hard to tell apart.
 *
 * The 0 0 1000 1000 viewBox is the original's, so every coordinate below is
 * the same coordinate as in the source file.
 */

/** Grille slots, left to right, tallest in the middle. */
const SLOTS = [
  'M392 477 Q392 500 392 523 Q392 537 405 542 L405 458 Q392 463 392 477Z',
  'M420 442 Q420 500 420 558 Q420 571 433 577 L433 423 Q420 429 420 442Z',
  'M449 407 Q449 500 449 593 Q449 605 462 612 L462 388 Q449 395 449 407Z',
  'M478 375 Q478 500 478 625 Q478 637 491 642 L491 358 Q478 363 478 375Z',
  'M507 358 Q507 500 507 642 Q520 637 520 625 L520 375 Q520 363 507 358Z',
  'M536 388 Q536 500 536 612 Q549 605 549 593 L549 407 Q549 395 536 388Z',
  'M565 423 Q565 500 565 577 Q578 571 578 558 L578 442 Q578 429 565 423Z',
  'M594 458 Q594 500 594 542 Q607 537 607 523 L607 477 Q607 463 594 458Z',
] as const;

/**
 * The radial gradient of the original, sampled into rings. Outermost first,
 * so each is painted over the one before it.
 */
const FACE_BANDS = [
  { r: 405, fill: '#5C6167' },
  { r: 380, fill: '#9EA3A9' },
  { r: 340, fill: '#C4C8CC' },
  { r: 300, fill: '#D9DCE0' },
] as const;

export function CoinMark({ size }: { size: number }): React.JSX.Element {
  return (
    <Svg viewBox="0 0 1000 1000" style={{ width: size, height: size }}>
      {/* Rim */}
      <Circle cx="500" cy="500" r="470" fill="#8E9399" />
      <Circle cx="500" cy="500" r="456" fill="#5C6167" />
      <Circle cx="500" cy="500" r="433" fill="#D8DADD" />
      <Circle cx="500" cy="500" r="425" fill="#202328" />

      {/* Face, shaded outside-in */}
      {FACE_BANDS.map((band) => (
        <Circle
          key={band.r}
          cx="500"
          cy="500"
          r={String(band.r)}
          fill={band.fill}
        />
      ))}

      {/* Machining rings */}
      <Circle
        cx="500"
        cy="500"
        r="397"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3"
      />
      <Circle
        cx="500"
        cy="500"
        r="382"
        fill="none"
        stroke="#7E848A"
        strokeWidth="3"
      />

      {/* Recessed backing behind the grille */}
      <Path
        d="M365 500 C365 410 425 348 500 348 C575 348 635 410 635 500 C635 590 575 652 500 652 C425 652 365 590 365 500Z"
        fill="#8A9096"
      />

      <G>
        {SLOTS.map((d) => (
          <Path key={d} d={d} fill="#22262B" stroke="#E9EBED" strokeWidth="2" />
        ))}
      </G>

      {/* Mint mark: the single place the brand red appears in the mark */}
      <Path
        d="M445 914 Q500 925 555 914 L551 943 Q500 953 449 943 Z"
        fill="#FF0000"
      />
    </Svg>
  );
}
