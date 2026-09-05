import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Font } from '@react-pdf/renderer';

import { logger } from '../config/logger.js';

/**
 * Brand fonts for the payslip PDF.
 *
 * The client self-hosts Space Grotesk and Inter as woff2, which is right for a
 * browser and useless here: `@react-pdf/renderer` embeds TrueType, not woff2.
 * So the PDF keeps its own copy of the same families as .ttf under
 * `server/assets/fonts`, and a payslip prints in the typefaces the rest of
 * PayZ uses rather than in a generic system face.
 *
 * If the files are ever missing — a partial deploy, a build that forgot to
 * copy assets — registration is skipped and the document falls back to the
 * built-in Helvetica. A payslip that prints in the wrong font is a cosmetic
 * problem; a payslip that fails to download is a payroll problem.
 */

export const DISPLAY_FONT = 'PayZ Display';
export const BODY_FONT = 'PayZ Body';

// The built-in families, which resolve their own bold face from fontWeight,
// so the styles below need no fallback-specific branch.
const FALLBACK_DISPLAY = 'Helvetica';
const FALLBACK_BODY = 'Helvetica';

interface FaceFile {
  file: string;
  weight: 400 | 600 | 700;
}

interface FontFamily {
  family: string;
  faces: readonly FaceFile[];
}

const FAMILIES: readonly FontFamily[] = [
  {
    family: DISPLAY_FONT,
    faces: [
      { file: 'SpaceGrotesk-400.ttf', weight: 400 },
      { file: 'SpaceGrotesk-700.ttf', weight: 700 },
    ],
  },
  {
    family: BODY_FONT,
    faces: [
      { file: 'Inter-400.ttf', weight: 400 },
      { file: 'Inter-600.ttf', weight: 600 },
    ],
  },
];

/**
 * Locates `server/assets/fonts` from wherever this module ended up.
 *
 * Under `tsx` it runs from `src/pdf`; after `tsc` it runs from `dist/src/pdf`.
 * Rather than hard-coding either depth, walk up until the directory appears.
 * `fileURLToPath` rather than `new URL().pathname`, which yields `/C:/...` on
 * Windows and then fails every `existsSync`.
 */
function findFontDirectory(): string | null {
  let directory = dirname(fileURLToPath(import.meta.url));

  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(directory, 'assets', 'fonts');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }

  return null;
}

let resolved: { display: string; body: string } | null = null;

/**
 * Registers the brand faces once and reports which family names to use.
 *
 * `Font.register` mutates a module-level registry inside the renderer, so
 * calling it per document would re-register the same family on every payslip
 * in a payrun. The result is cached instead.
 */
export function payslipFonts(): { display: string; body: string } {
  if (resolved !== null) {
    return resolved;
  }

  const directory = findFontDirectory();
  const missing =
    directory === null
      ? ['assets/fonts']
      : FAMILIES.flatMap((family) =>
          family.faces
            .map((face) => join(directory, face.file))
            .filter((path) => !existsSync(path)),
        );

  if (directory === null || missing.length > 0) {
    logger.warn(
      { missing },
      'Payslip brand fonts unavailable; falling back to Helvetica',
    );
    resolved = { display: FALLBACK_DISPLAY, body: FALLBACK_BODY };
    return resolved;
  }

  for (const family of FAMILIES) {
    Font.register({
      family: family.family,
      fonts: family.faces.map((face) => ({
        src: join(directory, face.file),
        fontWeight: face.weight,
      })),
    });
  }

  // Space Grotesk has no hyphenation dictionary and a payslip has no prose
  // worth breaking; leaving it on splits rule names mid-word in the table.
  Font.registerHyphenationCallback((word) => [word]);

  resolved = { display: DISPLAY_FONT, body: BODY_FONT };
  return resolved;
}
