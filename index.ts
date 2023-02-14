import { name as isValidIdentifierName } from 'estree-util-is-identifier-name';
import { valueToEstree } from 'estree-util-value-to-estree';
import { Literal, Root } from 'mdast';
import { MdxjsEsm } from 'mdast-util-mdx';
import { parse as parseToml } from 'toml';
import { Plugin } from 'unified';
import { parse as parseYaml } from 'yaml';

type FrontmatterParsers = Record<string, (value: string) => unknown>;

export type Traveler = (frontmatterData: any) => void | false;

export interface RemarkMdxFrontmatterOptions {
  /**
   * If specified, the YAML data is exported using this name. Otherwise, each
   * object key will be used as an export name.
   */
  name?: string;

  /**
   * A mapping of node types to parsers.
   *
   * Each key represents a frontmatter node type. The value is a function that accepts the
   * frontmatter data as a string, and returns the parsed data.
   *
   * By default `yaml` nodes will be parsed using [`yaml`](https://github.com/eemeli/yaml) and
   * `toml` nodes using [`toml`](https://github.com/BinaryMuse/toml-node).
   */
  parsers?: FrontmatterParsers;

  /**
   * Allow you travel all data when parse working
   * @param name the frontmatter name
   * @param data the frontmatter data
   * @returns return false if you want exclude this in exports
   */
  nodeTravel?: Traveler;
}

/**
 * Create an MDX ESM export AST node from an object.
 *
 * Each key of the object will be used as the export name.
 *
 * @param object The object to create an export node for.
 * @returns The MDX ESM node.
 */
function createExport(object: object): MdxjsEsm {
  return {
    type: 'mdxjsEsm',
    value: '',
    data: {
      estree: {
        type: 'Program',
        sourceType: 'module',
        body: [
          {
            type: 'ExportNamedDeclaration',
            specifiers: [],
            declaration: {
              type: 'VariableDeclaration',
              kind: 'const',
              declarations: Object.entries(object).map(([identifier, val]) => {
                if (!isValidIdentifierName(identifier)) {
                  throw new Error(
                    `Frontmatter keys should be valid identifiers, got: ${JSON.stringify(
                      identifier,
                    )}`,
                  );
                }
                return {
                  type: 'VariableDeclarator',
                  id: { type: 'Identifier', name: identifier },
                  init: valueToEstree(val),
                };
              }),
            },
          },
        ],
      },
    },
  };
}

/**
 * A remark plugin to expose frontmatter data as named exports.
 *
 * @param options Optional options to configure the output.
 * @returns A unified transformer.
 */
const remarkMdxFrontmatter: Plugin<[RemarkMdxFrontmatterOptions?], Root> = ({
  name,
  parsers,
  nodeTravel,
} = {}) => {
  const allParsers: FrontmatterParsers = {
    yaml: parseYaml,
    toml: parseToml,
    ...parsers,
  };
  const traveler = nodeTravel || (() => void 0);

  return (ast) => {
    let dataGather: any = undefined;
    let travelResult = false;

    if (name && !isValidIdentifierName(name)) {
      throw new Error(
        `If name is specified, this should be a valid identifier name, got: ${JSON.stringify(
          name,
        )}`,
      );
    }

    for (const node of ast.children) {
      if (!Object.hasOwnProperty.call(allParsers, node.type)) {
        continue;
      }

      const parser = allParsers[node.type];

      const { value } = node as Literal;
      const data = parser(value); //data like: { title: 'xx', date: '1997/01' }
      if (data == null) {
        continue;
      }
      if (!name && typeof data !== 'object') {
        throw new Error(`Expected frontmatter data to be an object, got:\n${value}`);
      }

      dataGather = Object.assign(dataGather || {}, data);
    }

    if (typeof traveler(dataGather) === 'boolean') return;

    const exported: MdxjsEsm[] = [];
    dataGather = name ? { [name]: dataGather } : dataGather;

    if (dataGather) {
      exported.push(createExport(dataGather));
    }

    ast.children.unshift(...exported);
  };
};

export default remarkMdxFrontmatter;
