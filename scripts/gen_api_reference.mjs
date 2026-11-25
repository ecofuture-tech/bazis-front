// Copyright 2026 EcoFuture Technology Services LLC and contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// The API reference of the guide (bazis/contrib/front/AGENTS.md): the exports of the client,
// the hooks, the components and the helpers of the end-to-end tests, read from their
// TypeScript with the compiler, each with its signature or members and the first sentence of
// its documentation. It is the end of the guide, from its first heading `## API: `, so that an
// agent reads the props of a component in the guide instead of the copies of a product.
//
//   node scripts/gen_api_reference.mjs           write it again
//   node scripts/gen_api_reference.mjs --check   exit 1 if the guide differs (npm test)

import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSETS = path.join(ROOT, 'bazis', 'contrib', 'front', 'assets');
const GUIDE = path.join(ROOT, 'bazis', 'contrib', 'front', 'AGENTS.md');
/** The generated part of the guide: from the first line that starts so to its end. */
const START = '## API: ';
/**
 * The most bytes of a generated section in a JSON string: bazis-mcp serves a section of up to
 * 30,000 whole, so that one is read with one call.
 */
const BUDGET = 24_000;
/**
 * The most bytes of a generated section, under the 30,000 of bazis-mcp by more than the note
 * of the first one: a module whose section alone is over it is split by the files of its index.
 */
const LIMIT = 29_000;
/** The longest type written out; a longer one ends with `…`. */
const TYPE_MAX = 240;
/** The directories of `assets/ui` that are no components. */
const NOT_COMPONENTS = new Set(['node_modules', 'shadcn', 'test', 'testing']);

const components = fs
  .readdirSync(path.join(ASSETS, 'ui'), { withFileTypes: true })
  .filter((it) => it.isDirectory() && !NOT_COMPONENTS.has(it.name))
  .map((it) => it.name)
  .filter((name) => fs.existsSync(path.join(ASSETS, 'ui', name, 'index.ts')))
  .sort();

/** The sections: their modules (the import of a product, the index file, the tsconfig). */
const GROUPS = [
  {
    title: 'the client',
    intro: 'The exports of the protocol client, `frontend/src/bazis/client/` (see "The client").',
    modules: [['@/bazis/client', 'client/src/index.ts']],
  },
  {
    title: 'the hooks',
    intro: 'The exports of the React hooks, `frontend/src/bazis/react/` (see "The hooks").',
    modules: [['@/bazis/react', 'react/src/index.ts']],
  },
  {
    title: 'the hooks of the packages and the language',
    intro:
      'The hooks copied with a package (`frontend/src/bazis/react/<package>/`), and the ' +
      'translations and the formats, `frontend/src/bazis/i18n/` (see "The language").',
    modules: [
      ...['statusy', 'uploadable', 'ws', 'notify', 'bg', 'async'].map((name) => [
        `@/bazis/react/${name}`,
        `react/src/${name}/index.ts`,
      ]),
      ['@/bazis/i18n', 'react/src/i18n/index.ts'],
    ],
  },
  {
    title: 'the components',
    intro:
      'The exports of the components, `frontend/src/bazis/ui/<component>/` (see "The ' +
      'components" for their `data-bz` and what they require).',
    modules: components.map((name) => [`@/bazis/ui/${name}`, `ui/${name}/index.ts`]),
    named: true,
  },
  {
    title: 'the helpers of the end-to-end tests',
    intro:
      'The exports of `frontend/e2e/bazis/`, imported as `../bazis` by the tests of ' +
      '`e2e/custom/` (see "The end-to-end tests").',
    modules: [['../bazis', 'playwright/bazis/index.ts']],
    tsconfig: 'playwright/tsconfig.json',
  },
];

function program(tsconfig, entries) {
  const config = ts.getParsedCommandLineOfConfigFile(path.join(ASSETS, tsconfig), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
  });
  return ts.createProgram({
    rootNames: [...config.fileNames, ...entries],
    options: config.options,
  });
}

const printer = ts.createPrinter({ removeComments: true });

/** The text of a node on one line, without its comments. */
function oneLine(node) {
  return printer
    .printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
    .replace(/\s+/g, ' ')
    .replace(/^\| /, '')
    .trim();
}

function unparenthesized(node) {
  return ts.isParenthesizedTypeNode(node) ? unparenthesized(node.type) : node;
}

function shorten(text) {
  return text.length > TYPE_MAX ? `${text.slice(0, TYPE_MAX)}…` : text;
}

/** Inline code, with a longer fence when the text has a backtick. */
function code(text) {
  return text.includes('`') ? `\`\` ${text} \`\`` : `\`${text}\``;
}

/** The first sentence of a documentation comment, on one line. */
function sentence(text) {
  const paragraph = (text.split(/\n\s*\n/)[0] ?? '').replace(/\s+/g, ' ').trim();
  let fenced = false;
  for (let i = 0; i < paragraph.length; i++) {
    const char = paragraph[i];
    if (char === '`') fenced = !fenced;
    else if (!fenced && char === '.' && (i + 1 === paragraph.length || paragraph[i + 1] === ' ')) {
      if (!/(^|[\s(])(e\.g|i\.e|etc)$/.test(paragraph.slice(0, i))) {
        return paragraph.slice(0, i + 1);
      }
    }
  }
  return paragraph;
}

function docOf(node) {
  const docs = ts.getJSDocCommentsAndTags(node).filter((it) => ts.isJSDoc(it));
  const last = docs.at(-1);
  return last ? sentence(ts.getTextOfJSDocComment(last.comment) ?? '') : '';
}

function described(text, doc) {
  return doc ? `${code(text)}: ${doc}` : code(text);
}

function isPrivate(member) {
  const flags = ts.getCombinedModifierFlags(member);
  return (
    (flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) !== 0 ||
    (member.name !== undefined && ts.isPrivateIdentifier(member.name))
  );
}

function render(checker) {
  const typeText = (node, fallback) =>
    shorten(node ? oneLine(node) : checker.typeToString(fallback()));

  function parameters(declaration, owner) {
    return declaration.parameters
      .map((parameter) => {
        let name = ts.isIdentifier(parameter.name)
          ? parameter.name.text
          : /^[A-Z]/.test(owner)
            ? 'props'
            : 'options';
        if (parameter.dotDotDotToken) name = `...${name}`;
        const optional = parameter.questionToken || parameter.initializer ? '?' : '';
        const type = typeText(parameter.type, () => checker.getTypeAtLocation(parameter));
        return `${name}${optional}: ${type}`;
      })
      .join(', ');
  }

  function signature(declaration, name) {
    const generics = declaration.typeParameters
      ? `<${declaration.typeParameters.map(oneLine).join(', ')}>`
      : '';
    const returns = typeText(declaration.type, () =>
      checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(declaration)),
    );
    return `${name}${generics}(${parameters(declaration, name)}): ${returns}`;
  }

  function member(node) {
    const name = node.name ? node.name.getText() : '';
    const readonly =
      ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Readonly ? 'readonly ' : '';
    const isStatic = ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Static ? 'static ' : '';
    if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) {
      const optional = node.questionToken ? '?' : '';
      const type = typeText(node.type, () => checker.getTypeAtLocation(node));
      return described(`${isStatic}${readonly}${name}${optional}: ${type}`, docOf(node));
    }
    if (ts.isMethodSignature(node) || ts.isMethodDeclaration(node)) {
      return described(`${isStatic}${signature(node, name)}`, docOf(node));
    }
    if (ts.isGetAccessorDeclaration(node)) {
      const type = typeText(node.type, () => checker.getTypeAtLocation(node));
      return described(`${isStatic}get ${name}: ${type}`, docOf(node));
    }
    if (ts.isConstructorDeclaration(node)) {
      return described(`constructor(${parameters(node, 'constructor')})`, docOf(node));
    }
    return described(oneLine(node), docOf(node));
  }

  function shown(nodes) {
    return nodes
      .filter((node) => !isPrivate(node) && !ts.isSemicolonClassElement(node))
      .filter((node) => !(ts.isConstructorDeclaration(node) && node.parameters.length === 0));
  }

  /** The members of an interface, a type literal or a class, as a list. */
  function members(nodes) {
    return shown(nodes)
      .map((node) => `- ${member(node)}\n`)
      .join('');
  }

  /**
   * The items of the list of a type made of object types: the members of a type literal, of
   * each object of an intersection (another part as a line of its own), and the alternatives
   * of a union of type literals; null for another type.
   */
  function typeItems(node) {
    node = unparenthesized(node);
    if (ts.isTypeLiteralNode(node)) return shown(node.members).map(member);
    if (ts.isIntersectionTypeNode(node)) {
      const parts = node.types.map((part) => typeItems(part));
      if (parts.every((part) => part === null)) return null;
      return parts.flatMap((part, index) =>
        part ?? [`and the members of ${code(oneLine(node.types[index]))}`],
      );
    }
    if (ts.isUnionTypeNode(node)) {
      const literals = node.types.map(unparenthesized);
      if (!literals.every((it) => ts.isTypeLiteralNode(it))) return null;
      return literals.map(
        (literal, index) =>
          `${index === 0 ? 'either' : 'or'}: ${shown(literal.members).map(member).join('; ')}`,
      );
    }
    return null;
  }

  function heritage(node) {
    return (node.heritageClauses ?? []).map((it) => ` ${oneLine(it)}`).join('');
  }

  /**
   * The props of a component, `<Name>Props` of the assets (not of a library), whose members
   * are listed with the component: the declaration, or null.
   */
  function propsOf(declaration) {
    const parameter = declaration.parameters[0];
    const type = parameter?.type;
    if (!type || !ts.isTypeReferenceNode(type) || !/Props$/.test(type.typeName.getText())) {
      return null;
    }
    let symbol = checker.getSymbolAtLocation(type.typeName);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const found = symbol?.declarations?.[0];
    if (!found || found.getSourceFile().fileName.includes('node_modules')) return null;
    return ts.isInterfaceDeclaration(found) || ts.isTypeAliasDeclaration(found) ? found : null;
  }

  /** The members of the props of a component, as the lines of a list. */
  function propsText(found) {
    if (ts.isInterfaceDeclaration(found)) {
      const base = heritage(found);
      return `${base ? `- ${code(base.trim())}\n` : ''}${members(found.members)}`;
    }
    const items = typeItems(found.type) ?? [code(`= ${shorten(oneLine(found.type))}`)];
    return items.map((it) => `- ${it}\n`).join('');
  }

  /** The entry of an export: a heading with its text, or a line of the small ones. */
  function entry(name, symbol, inlined) {
    const declarations = symbol.declarations ?? [];
    const first = declarations[0];
    if (!first) return null;
    if (inlined.has(name)) {
      return { line: `${code(name)}: the props of ${code(inlined.get(name))}, listed with it` };
    }
    if (ts.isFunctionDeclaration(first)) {
      const overloads = declarations.filter((it) => ts.isFunctionDeclaration(it) && !it.body);
      const shown = overloads.length ? overloads : [first];
      const lines = shown.map((it) => `${described(signature(it, name), docOf(it))}\n`);
      const props = shown.length === 1 ? propsOf(first) : null;
      if (props) {
        const title = props.name.text;
        lines.push(`\nIts props, ${code(title)}:\n\n${propsText(props)}`);
      }
      return { heading: name, text: lines.join('\n') };
    }
    if (ts.isVariableDeclaration(first)) {
      const init = first.initializer;
      if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
        return { heading: name, text: `${described(signature(init, name), docOf(first))}\n` };
      }
      const type = typeText(first.type, () => checker.getTypeAtLocation(first));
      return { line: described(`${name}: ${type}`, docOf(first)) };
    }
    if (ts.isInterfaceDeclaration(first)) {
      const generics = first.typeParameters
        ? `<${first.typeParameters.map(oneLine).join(', ')}>`
        : '';
      const head = described(`interface ${name}${generics}${heritage(first)}`, docOf(first));
      return { heading: name, text: `${head}\n\n${members(first.members)}` };
    }
    if (ts.isClassDeclaration(first)) {
      const head = described(`class ${name}${heritage(first)}`, docOf(first));
      return { heading: name, text: `${head}\n\n${members(first.members)}` };
    }
    if (ts.isTypeAliasDeclaration(first)) {
      const generics = first.typeParameters
        ? `<${first.typeParameters.map(oneLine).join(', ')}>`
        : '';
      const items = typeItems(first.type);
      if (items?.length) {
        const head = described(`type ${name}${generics}`, docOf(first));
        return { heading: name, text: `${head}\n\n${items.map((it) => `- ${it}\n`).join('')}` };
      }
      return {
        line: described(`type ${name}${generics} = ${shorten(oneLine(first.type))}`, docOf(first)),
      };
    }
    return { line: described(name, docOf(first)) };
  }

  /**
   * The text of a module (`text`), that of some of its exports (`render(names)`), and `split()`:
   * its exports in parts, one per file that its index re-exports (`export … from`), in the order
   * of the index, named by the file.
   */
  return function module(specifier, file) {
    const source = checker.getSymbolAtLocation(file);
    if (!source) throw new Error(`${file.fileName}: no module`);
    const exports = checker.getExportsOfModule(source).map((exported) => ({
      name: exported.name,
      symbol: exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported,
    }));
    // the props listed with their component: the name of the props, the component
    const inlined = new Map();
    for (const { name, symbol } of exports) {
      const first = symbol.declarations?.[0];
      const overloads = (symbol.declarations ?? []).filter(
        (it) => ts.isFunctionDeclaration(it) && !it.body,
      );
      if (first && ts.isFunctionDeclaration(first) && overloads.length === 0) {
        const props = propsOf(first);
        if (props) inlined.set(props.name.text, name);
      }
    }
    const text = (names) => {
      const parts = [];
      const lines = [];
      for (const { name, symbol } of exports) {
        if (names && !names.has(name)) continue;
        const found = entry(name, symbol, inlined);
        if (!found) continue;
        if (found.line) lines.push(`- ${found.line}\n`);
        else parts.push(`#### ${found.heading}\n\n${found.text}`);
      }
      if (lines.length) {
        parts.push(`#### The types and the constants of ${code(specifier)}\n\n${lines.join('')}`);
      }
      return `### ${code(specifier)}\n\n${parts.join('\n')}`;
    };
    const split = () => {
      const files = new Map();
      for (const statement of file.statements) {
        const exported =
          ts.isExportDeclaration(statement) ||
          ts.isExportAssignment(statement) ||
          (ts.canHaveModifiers(statement) &&
            (ts.getModifiers(statement) ?? []).some((it) => it.kind === ts.SyntaxKind.ExportKeyword));
        if (!exported) continue;
        if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) {
          throw new Error(`${specifier} has an export without \`from\`: its exports cannot be split by file`);
        }
        const clause = statement.exportClause;
        const names = !clause
          ? checker.getExportsOfModule(checker.getSymbolAtLocation(statement.moduleSpecifier)).map((it) => it.name)
          : ts.isNamedExports(clause)
            ? clause.elements.map((it) => it.name.text)
            : [clause.name.text];
        const from = statement.moduleSpecifier.text;
        files.set(from, [...(files.get(from) ?? []), ...names]);
      }
      return [...files].map(([from, names]) => ({
        name: from.replace(/^\.\//, '').replace(/\.js$/, ''),
        from,
        names,
        text: text(new Set(names)),
      }));
    };
    return { text: text(), render: text, split };
  };
}

function size(text) {
  return Buffer.byteLength(JSON.stringify(text));
}

function reference() {
  const programs = new Map();
  const moduleOf = (tsconfig, entry) => {
    const config = tsconfig ?? 'ui/tsconfig.json';
    if (!programs.has(config)) {
      const entries = GROUPS.filter((it) => (it.tsconfig ?? 'ui/tsconfig.json') === config)
        .flatMap((it) => it.modules)
        .map(([, file]) => path.join(ASSETS, file));
      const built = program(config, entries);
      programs.set(config, { program: built, render: render(built.getTypeChecker()) });
    }
    const { program: built, render: module } = programs.get(config);
    const [specifier, file] = entry;
    const source = built.getSourceFile(path.join(ASSETS, file));
    if (!source) throw new Error(`${file}: not in the program of ${config}`);
    return module(specifier, source);
  };

  // the modules of a group in sections within BUDGET, each titled with its modules; a module
  // whose section alone is over LIMIT is split by the files that its index re-exports, in
  // sections of its own titled with them
  const sections = [];
  for (const group of GROUPS) {
    const alone = (name) => (group.named ? `${group.title}: ${name}` : group.title);
    const section = (title, texts) => `${START}${title}\n\n${group.intro}\n\n${texts.join('\n')}`;
    const pack = (items) => {
      const packs = [];
      for (const it of items) {
        const last = packs.at(-1);
        if (!last || size(last.concat(it).map((m) => m.text).join('\n')) > BUDGET) packs.push([it]);
        else last.push(it);
      }
      return packs;
    };
    // the packs of the group in order: of modules (`title` null), or of the parts of a module
    const packs = [];
    let run = [];
    for (const entry of group.modules) {
      const [specifier] = entry;
      const name = specifier.split('/').at(-1);
      const { text, render, split } = moduleOf(group.tsconfig, entry);
      if (size(section(alone(name), [text])) <= LIMIT) {
        run.push({ name, text });
        continue;
      }
      packs.push(...pack(run).map((it) => ({ title: null, it })));
      run = [];
      const parts = split();
      for (const part of parts) {
        if (size(section(`${alone(name)} (${part.name})`, [part.text])) > LIMIT) {
          throw new Error(
            `the exports of \`${part.from}\` of \`${specifier}\` are over ${LIMIT.toLocaleString('en-US')} ` +
              'bytes: split the file',
          );
        }
      }
      // a section of parts is one text of the module: its heading and its list of the types once
      packs.push(
        ...pack(parts).map((it) => ({
          title: `${alone(name)} (${it.map((m) => m.name).join(', ')})`,
          it: [{ text: render(new Set(it.flatMap((m) => m.names))) }],
        })),
      );
    }
    packs.push(...pack(run).map((it) => ({ title: null, it })));
    for (const { title: given, it } of packs) {
      const title =
        given ??
        (group.named || packs.length > 1 ? `${group.title}: ${it.map((m) => m.name).join(', ')}` : group.title);
      const text = section(title, it.map((m) => m.text));
      if (size(text) > LIMIT) {
        throw new Error(`the section "${title}" is over ${LIMIT.toLocaleString('en-US')} bytes: split its module`);
      }
      sections.push(text);
    }
  }
  const note =
    '<!-- Generated by scripts/gen_api_reference.mjs from the TypeScript of the assets: ' +
    'never edit it, run `npm run api-reference`. -->\n\n';
  return sections.map((text, index) => (index === 0 ? text.replace('\n\n', `\n\n${note}`) : text));
}

function main() {
  const check = process.argv.includes('--check');
  const guide = fs.readFileSync(GUIDE, 'utf8');
  const at = guide.search(new RegExp(`^${START}`, 'm'));
  const head = at === -1 ? `${guide.trimEnd()}\n\n` : guide.slice(0, at);
  const written = `${head}${reference().join('\n')}`;
  if (written === guide) return;
  if (check) {
    console.error(
      'The API reference of bazis/contrib/front/AGENTS.md differs from the TypeScript of ' +
        'the assets: run `npm run api-reference` and commit the guide.',
    );
    process.exit(1);
  }
  fs.writeFileSync(GUIDE, written);
}

main();
