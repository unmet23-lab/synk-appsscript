'use strict';

// Test harnesses execute complete shipped statements without importing the
// browser entrypoint's DOM, network and top-level-await side effects.
const assert = require('node:assert/strict');
const { parse } = require('acorn');

function dotted(node) {
  if (node?.type === 'Identifier') return node.name;
  if (node?.type !== 'MemberExpression') return null;
  const owner = dotted(node.object), property = node.computed ? node.property.value : node.property.name;
  return owner && typeof property === 'string' ? `${owner}.${property}` : null;
}
function calls(node, callee) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'CallExpression' && dotted(node.callee) === callee) return true;
  return Object.values(node).some(value => Array.isArray(value) ? value.some(item => calls(item, callee)) : calls(value, callee));
}

function sourceStatements(source) {
  const body = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body;
  const one = (predicate, label) => {
    const matches = body.filter(predicate);
    assert.equal(matches.length, 1, `Expected one top-level ${label}, found ${matches.length}`);
    return matches[0];
  };
  const declaration = name => one(node => node.type === 'FunctionDeclaration' ? node.id?.name === name
    : node.type === 'VariableDeclaration' && node.declarations.some(item => item.id.type === 'Identifier' && item.id.name === name), `declaration ${name}`);
  const assignment = name => one(node => node.type === 'ExpressionStatement' && node.expression.type === 'AssignmentExpression'
    && dotted(node.expression.left) === name, `assignment ${name}`);
  const text = node => source.slice(node.start, node.end);
  const resolve = selector => selector.name ? declaration(selector.name) : assignment(selector.assignment);
  return {
    text, declarationNode: declaration,
    declaration: name => text(declaration(name)),
    function(name) {
      const node = declaration(name);
      assert.equal(node.type, 'FunctionDeclaration', `${name} must be a function declaration`);
      return text(node);
    },
    call(callee, literalArguments = {}, { calls: nestedCall } = {}) {
      return text(one(node => node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression'
        && dotted(node.expression.callee) === callee
        && Object.entries(literalArguments).every(([index, value]) => node.expression.arguments[index]?.type === 'Literal'
          && node.expression.arguments[index].value === value)
        && (!nestedCall || calls(node.expression.arguments, nestedCall)), `call ${callee}(${JSON.stringify(literalArguments)})`));
    },
    between(first, until) {
      const start = resolve(first), end = resolve(until);
      assert.ok(start.start < end.start, 'Statement range must be ordered and nonempty');
      return body.filter(node => node.start >= start.start && node.end <= end.start).map(text).join('\n');
    },
  };
}

module.exports = { sourceStatements };
