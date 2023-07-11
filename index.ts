import { name as isValidIdentifierName } from 'estree-util-is-identifier-name';
import { valueToEstree } from 'estree-util-value-to-estree';
import { Literal, Root } from 'mdast';
import { MdxjsEsm } from 'mdast-util-mdx';
import { parse as parseToml } from 'toml';
import { Plugin } from 'unified';
import { parse as parseYaml } from 'yaml';

type FrontmatterParsers = Record<string, (value: string) => unknown>;

/**
 * - `mdx-export`: export the data using mdxjsEsm node.
 * - `vfile-data`: export the data in the data[name || 'frontmatter'] of compiled result.
 * - `skip`: do nothing.
 */
type Action = 'mdx-export' | 'vfile-data' | 'skip';

/**
 * @param name the frontmatter name
 * @param data the frontmatter data
 *
 * @returns [action, new frontmatterData]
 * */
export type Traveler = (
  name: string,
  frontmatterData: any,
) => [action: Action, newFrontmatterData: any];

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
   * - `mdx-export`: export the data using mdxjsEsm node.
   * - `vfile-data`: export the data in the data[name || 'frontmatter'] of compiled result.
   * - `skip`: do nothing.
   */
  action?: Traveler | Action;
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

const defaultName = 'frontmatter';

/**
 * A remark plugin to expose frontmatter data as named exports.
 *
 * @param options Optional options to configure the output.
 * @returns A unified transformer.
 */
const remarkMdxFrontmatter: Plugin<[RemarkMdxFrontmatterOptions?], Root> = ({
  name,
  parsers,
  action = 'mdx-export',
} = {}) => {
  const allParsers: FrontmatterParsers = {
    yaml: parseYaml,
    toml: parseToml,
    ...parsers,
  };
  const traveler: Traveler =
    typeof action === 'string'
      ? (_n, fd) => [action, fd]
      : action || ((_n, data) => ['mdx-export', data]);

  return (ast, file) => {
    let dataGather: any = undefined;

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

    const [action, newData] = traveler(name || defaultName, dataGather);
    dataGather = newData;

    switch (action) {
      case 'mdx-export':
        dataGather = name ? { [name]: dataGather } : dataGather;
        if (dataGather) {
          ast.children.unshift(createExport(dataGather));
        }
        break;
      case 'vfile-data':
        file.data[name || defaultName] = dataGather;
        break;
      case 'skip':
      default:
      //
    }
  };
};

export default remarkMdxFrontmatter;
