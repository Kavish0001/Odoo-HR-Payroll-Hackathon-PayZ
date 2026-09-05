/// <reference types="vite/client" />

// Vite's ambient types (import.meta.env, ?url and ?raw imports, asset modules)
// are pulled in here rather than through tsconfig's `types` array. That array
// resolves against typeRoots, so "vite/client" only worked there by a node
// resolution fallback that newer TypeScript no longer applies.
