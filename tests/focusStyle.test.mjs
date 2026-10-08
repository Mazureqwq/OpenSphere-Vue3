import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readProjectFile = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

test('uses the component-provided input focus state without a global focus-visible outline', async () => {
  const [tokens, elementOverrides] = await Promise.all([
    readProjectFile('src/styles/tokens.css'),
    readProjectFile('src/styles/element-plus-overrides.css'),
  ]);

  assert.doesNotMatch(tokens, /:focus-visible/);
  assert.doesNotMatch(elementOverrides, /\.el-input__wrapper\.is-focus/);
  assert.doesNotMatch(elementOverrides, /\.el-select__wrapper\.is-focused/);
  assert.doesNotMatch(elementOverrides, /\.el-textarea__inner:focus/);
  assert.doesNotMatch(elementOverrides, /\.el-input__wrapper,\s*\.el-select__wrapper,\s*\.el-textarea__inner\s*\{[^}]*box-shadow/);
});
