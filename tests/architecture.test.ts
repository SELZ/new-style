import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

type Files = Map<string, string>
type Violation = { file: string; code: string; message: string }
type Dependency = { specifier: string | null; kind: 'module' | 'css' }

const layers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'] as const
type Layer = typeof layers[number]
const sourceExtensions = /\.(?:tsx?|css)$/
const projectRoot = fileURLToPath(new URL('..', import.meta.url))

function sourceFiles(directory: string, prefix = ''): Files {
  const files: Files = new Map()
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name)
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      for (const [name, content] of sourceFiles(absolute, relative)) files.set(name, content)
    } else if (entry.isFile()) {
      files.set(relative, sourceExtensions.test(relative) ? readFileSync(absolute, 'utf8') : '')
    }
  }
  return files
}

function dependencies(file: string, content: string): Dependency[] {
  if (file.endsWith('.css')) {
    const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '')
    return [...withoutComments.matchAll(/@import\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^\s;)]+))/g)]
      .map((match) => ({ specifier: match[1] ?? match[2] ?? match[3], kind: 'css' }))
  }

  const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const found: Dependency[] = []
  const add = (node: ts.Node | undefined) => {
    found.push({ specifier: node && ts.isStringLiteralLike(node) ? node.text : null, kind: 'module' })
  }
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) add(node.moduleSpecifier)
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node.argument.literal)
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node.moduleReference.expression)
    } else if (ts.isCallExpression(node) && (
      node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === 'require')
    )) {
      add(node.arguments[0])
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return found
}

function locate(file: string, files: Files): { layer: Layer; scope: string } | null {
  const [layer, segment] = file.split('/')
  if (!layers.includes(layer as Layer)) return null
  if (layer === 'app') return { layer, scope: 'app' }
  if (!segment || segment.includes('.')) return null
  if (layer !== 'shared') return { layer: layer as Layer, scope: `${layer}/${segment}` }

  // Shared has segments, not domain slices. A UI module can expose its own index.
  let directory = path.posix.dirname(file)
  while (directory.startsWith('shared/')) {
    if (files.has(`${directory}/index.ts`)) return { layer, scope: directory }
    directory = path.posix.dirname(directory)
  }
  return { layer, scope: `shared/${segment}` }
}

function localBase(file: string, dependency: Dependency): string | null {
  const specifier = dependency.specifier!
  if (/^(?:https?:|data:|node:|\/\/)/.test(specifier)) return null
  const clean = specifier.replace(/[?#].*$/, '')
  if (clean.startsWith('.')) return path.posix.normalize(path.posix.join(path.posix.dirname(file), clean))
  if (clean.startsWith('/src/')) return clean.slice('/src/'.length)
  if (clean.startsWith('@/') || clean.startsWith('~/')) return clean.slice(2)
  if (clean.startsWith('src/')) return clean.slice(4)
  if (layers.some((layer) => clean.startsWith(`${layer}/`))) return clean
  if (clean.startsWith('/')) return clean
  if (dependency.kind === 'css') return path.posix.join(path.posix.dirname(file), clean)
  return null // Package imports (React, etc.) are outside this dependency graph.
}

function resolveTarget(base: string, files: Files): string | null {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.css`, `${base}/index.ts`, `${base}/index.tsx`]
  if (/\.jsx?$/.test(base)) candidates.push(base.replace(/\.jsx?$/, '.ts'), base.replace(/\.jsx?$/, '.tsx'))
  return candidates.find((candidate) => files.has(candidate)) ?? null
}

function validateArchitecture(files: Files): Violation[] {
  const violations: Violation[] = []
  const report = (file: string, code: string, message: string) => violations.push({ file, code, message })
  for (const [file, content] of files) {
    if (!sourceExtensions.test(file)) continue
    if (file.endsWith('.d.ts') && !file.includes('/')) continue
    const source = locate(file, files)
    const bootstrap = file === 'main.tsx'
    if (!source && !bootstrap) {
      report(file, 'placement', 'Source must belong to an FSD layer; only main.tsx is a root bootstrap.')
    } else if (source && !files.has(`${source.scope}/index.ts`)) {
      report(file, 'missing-public-api', `Missing public API: ${source.scope}/index.ts`)
    }

    for (const dependency of dependencies(file, content)) {
      if (dependency.specifier === null) {
        report(file, 'dynamic-import', 'Use a literal module path so dependency boundaries can be verified.')
        continue
      }
      const base = localBase(file, dependency)
      if (base === null) continue
      const targetFile = resolveTarget(base, files)
      if (!targetFile) {
        report(file, 'unresolved', `Cannot resolve local dependency ${dependency.specifier}.`)
        continue
      }
      if (bootstrap) {
        if (targetFile !== 'app/index.ts') report(file, 'bootstrap', 'main.tsx may only import app/index.ts locally.')
        continue
      }
      const target = locate(targetFile, files)
      if (!source || !target) {
        report(file, 'placement', `Dependency ${dependency.specifier} bypasses the FSD layers.`)
        continue
      }
      if (source.scope === target.scope) continue
      const sourceRank = layers.indexOf(source.layer)
      const targetRank = layers.indexOf(target.layer)
      if (targetRank < sourceRank) {
        report(file, 'upward', `${source.layer} cannot import the higher layer ${target.layer}: ${dependency.specifier}.`)
      } else if (sourceRank === targetRank && source.layer !== 'shared') {
        report(file, 'sibling-slice', `Sibling slices cannot import each other: ${dependency.specifier}.`)
      }
      if (targetFile !== `${target.scope}/index.ts`) {
        report(file, 'deep-import', `Import ${target.scope}/index.ts instead of ${dependency.specifier}.`)
      }
    }
  }
  return violations
}

function fixture(entries: Record<string, string>): Files {
  return new Map(Object.entries(entries))
}

test('FSD migration has public entry points and no legacy source roots', () => {
  const files = sourceFiles(path.join(projectRoot, 'src'))
  const required = [
    'main.tsx', 'app/index.ts',
    'pages/login/index.ts', 'pages/catalog/index.ts',
    'widgets/cart-drawer/index.ts', 'widgets/product-details/index.ts',
    'widgets/site-header/index.ts', 'widgets/site-footer/index.ts',
    'features/auth-login/index.ts', 'features/manage-cart/index.ts',
    'entities/product/index.ts', 'entities/cart/index.ts', 'entities/session/index.ts',
    'shared/api/index.ts', 'shared/config/index.ts',
    'shared/ui/icon/index.ts', 'shared/ui/brand/index.ts',
  ]
  assert.deepEqual(required.filter((file) => !files.has(file)), [], 'Missing FSD public entry points')
  const legacy = [...files.keys()].filter((file) =>
    /^(?:components|hooks|api|data)\//.test(file) || /^(?:App|Shop|index|fonts)\.(?:tsx?|css)$/.test(file))
  assert.deepEqual(legacy, [], 'Legacy source paths must be removed after migration')
})

test('all source imports follow FSD layers, slice isolation and public APIs', () => {
  const violations = validateArchitecture(sourceFiles(path.join(projectRoot, 'src')))
  assert.equal(violations.length, 0, violations.map(({ file, code, message }) => `${file}: [${code}] ${message}`).join('\n'))
})

test('validator accepts lower layers, internal files and public Shared modules', () => {
  const files = fixture({
    'main.tsx': 'import { bootstrap } from "./app/index.ts";',
    'app/index.ts': 'export { bootstrap } from "./entrypoint.tsx";',
    'app/entrypoint.tsx': 'import "./styles/global.css"; import "../pages/catalog/index.ts";',
    'app/styles/global.css': '@import "./fonts.css";',
    'app/styles/fonts.css': '',
    'pages/catalog/index.ts': 'export { Catalog } from "./ui/Catalog.tsx";',
    'pages/catalog/ui/Catalog.tsx': 'import "../../../entities/product/index.ts"; const x = import("../../../shared/ui/icon/index.ts");',
    'entities/product/index.ts': 'export type { Product } from "./model/types.ts";',
    'entities/product/model/types.ts': 'import type { Transport } from "../../../shared/api/index.ts";',
    'shared/api/index.ts': 'export type Transport = string;',
    'shared/ui/icon/index.ts': 'export { Icon } from "./Icon.tsx";',
    'shared/ui/icon/Icon.tsx': 'import "../brand/index.ts";',
    'shared/ui/brand/index.ts': '',
  })
  assert.deepEqual(validateArchitecture(files), [])
})

test('validator rejects upward imports, sibling slices and deep imports for every module syntax', () => {
  const scenarios = [
    { code: 'upward', file: 'entities/product/index.ts', source: 'import "../../features/manage-cart/index.ts";', target: 'features/manage-cart/index.ts' },
    { code: 'sibling-slice', file: 'features/manage-cart/index.ts', source: 'export * from "../auth-login/index.ts";', target: 'features/auth-login/index.ts' },
    { code: 'deep-import', file: 'pages/catalog/index.ts', source: 'const dialog = import("../../entities/product/model/types.ts");', target: 'entities/product/model/types.ts' },
    { code: 'deep-import', file: 'pages/catalog/index.ts', source: 'type Product = import("../../entities/product/model/types.ts").Product;', target: 'entities/product/model/types.ts' },
    { code: 'deep-import', file: 'pages/catalog/index.ts', source: 'import "../../shared/ui/icon/Icon.tsx";', target: 'shared/ui/icon/Icon.tsx' },
    { code: 'deep-import', file: 'shared/api/index.ts', source: 'import "../config/internal.ts";', target: 'shared/config/internal.ts' },
    { code: 'upward', file: 'shared/api/index.ts', source: 'import "../../entities/product/index.ts";', target: 'entities/product/index.ts' },
  ]
  for (const scenario of scenarios) {
    const files = fixture({
      [scenario.file]: scenario.source,
      [scenario.target]: '',
      'entities/product/index.ts': scenario.file === 'entities/product/index.ts' ? scenario.source : '',
      'shared/ui/icon/index.ts': '',
      'shared/config/index.ts': '',
    })
    assert.ok(validateArchitecture(files).some((violation) => violation.code === scenario.code),
      `Expected ${scenario.code} for ${scenario.file}: ${scenario.source}`)
  }
})

test('validator rejects unresolved paths, opaque dynamic imports and bootstrap bypasses', () => {
  const files = fixture({
    'main.tsx': 'import "./pages/catalog/index.ts";',
    'app/index.ts': '',
    'pages/catalog/index.ts': 'import "./missing.ts"; const page = import(moduleName);',
  })
  const codes = new Set(validateArchitecture(files).map((violation) => violation.code))
  for (const code of ['bootstrap', 'unresolved', 'dynamic-import']) assert.ok(codes.has(code), `Missing ${code}`)
})

test('CSS imports also reject upward dependencies and sibling slices', () => {
  const files = fixture({
    'entities/product/index.ts': '',
    'entities/product/ui/product.css': '@import url("../../../pages/catalog/ui/catalog.css");',
    'pages/catalog/index.ts': '',
    'pages/catalog/ui/catalog.css': '@import "../../login/ui/login.css";',
    'pages/login/index.ts': '',
    'pages/login/ui/login.css': '',
  })
  const violations = validateArchitecture(files)
  assert.ok(violations.some(({ code, file }) => code === 'upward' && file.endsWith('product.css')))
  assert.ok(violations.some(({ code, file }) => code === 'sibling-slice' && file.endsWith('catalog.css')))
})
