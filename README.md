# @allen/remark-mdx-frontmatter

A [remark](https://remark.js.org) plugin for converting frontmatter metadata into MDX exports

## Installation

**Not available yet**

This package depends on the AST output by
[remark-frontmatter](https://github.com/remarkjs/remark-frontmatter)

```sh
npm install remark-frontmatter @allen/remark-mdx-frontmatter
```

## Usage

This remark plugin takes frontmatter content, and outputs it as JavaScript exports. Both YAML and
TOML frontmatter data are supported.

For example, given a file named `example.mdx` with the following contents:

```mdx
---
hello: frontmatter
---

Rest of document
```

The following script:

```js
import { readFile } from 'node:fs/promises';

import { compile } from '@mdx-js/mdx';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from '@allen/remark-mdx-frontmatter';

const { contents } = await compile(await readFile('example.mdx'), {
  jsx: true,
  remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
});
console.log(contents);
```

Roughly yields:

```jsx
export const hello = 'frontmatter';

export default function MDXContent() {
  return <p>Rest of document</p>;
}
```

### Options

#### `name`

By default, every frontmatter object key is turned into a JavaScript export. If `name` is specified,
the YAML content is exported as one single export using this name. This is useful if you wish to use
top-level frontmatter nodes other than objects, or if the frontmatter content contains keys which
aren’t valid JavaScript identifiers.

#### `parsers`

A mapping A mapping of node types to parsers. Each key represents a frontmatter node type. The value
is a function that accepts the frontmatter data as a string, and returns the parsed data. By default
`yaml` nodes will be parsed using [`yaml`](https://github.com/eemeli/yaml) and `toml` nodes using
[`toml`](https://github.com/BinaryMuse/toml-node).

### `nodeTravel`

Allows you to manipulate the corresponding frontmatter directly, instead of injecting it into the generated js

### License

[MIT](LICENSE.md) @ [Allen Lee](https://github.com/cangSDARM)
