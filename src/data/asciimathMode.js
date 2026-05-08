import { StreamLanguage } from '@codemirror/language';

const BIG_OPS = new Set([
  'int', 'oint', 'sum', 'prod', 'lim', 'del', 'grad', 'sqrt', 'root',
]);

const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan',
  'sinh', 'cosh', 'tanh', 'exp', 'log', 'ln',
  'det', 'max', 'min', 'inf', 'sup', 'gcd',
]);

const GREEK = new Set([
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
  'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma',
  'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma',
  'Upsilon', 'Phi', 'Psi', 'Omega',
]);

const CONSTANTS = new Set(['oo', 'infty', 'hbar', 'ell', 'Re', 'Im']);

const DECORATORS = new Set([
  'hat', 'bar', 'vec', 'dot', 'ddot', 'tilde', 'ul',
  'bb', 'bbb', 'cc', 'tt', 'fr', 'sf', 'text',
  'abs', 'norm', 'floor', 'ceil',
]);

const WORD_OPS = new Set([
  'in', 'notin', 'sub', 'sube', 'cup', 'cap',
  'AA', 'EE', 'prop', 'uarr', 'darr', 'xx', 'nn', 'uu',
]);

export const asciimathLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;

    // Numbers
    if (stream.match(/^[0-9]+(\.[0-9]+)?/)) return 'number';

    // Multi-char symbolic operators — longer patterns first
    if (stream.match('<=>')) return 'operator';
    if (stream.match('|->')) return 'operator';
    if (stream.match('->'))  return 'operator';
    if (stream.match('=>'))  return 'operator';
    if (stream.match('<-'))  return 'operator';
    if (stream.match('<='))  return 'operator';
    if (stream.match('>='))  return 'operator';
    if (stream.match('!='))  return 'operator';
    if (stream.match('~='))  return 'operator';
    if (stream.match('-='))  return 'operator';
    if (stream.match('<<'))  return 'operator';
    if (stream.match('>>'))  return 'operator';
    if (stream.match('**'))  return 'operator';
    if (stream.match('+-'))  return 'operator';
    if (stream.match('O/'))  return 'atom';   // ∅ antes de que 'O' se lea como palabra

    // Words
    if (stream.match(/^[a-zA-Z][a-zA-Z0-9]*/)) {
      const word = stream.current();
      if (BIG_OPS.has(word))    return 'keyword';
      if (FUNCTIONS.has(word))  return 'builtin';
      if (GREEK.has(word))      return 'atom';
      if (CONSTANTS.has(word))  return 'atom';
      if (DECORATORS.has(word)) return 'variable-2';
      if (WORD_OPS.has(word))   return 'operator';
      return null;
    }

    // Brackets
    if (stream.eat(/[()[\]{}|]/)) return 'bracket';

    // Single-char operators
    if (stream.eat(/[+\-*/=<>^_@~!,.'/\\]/)) return 'operator';

    stream.next();
    return null;
  },
});
