import { snippet } from '@codemirror/autocomplete';

// [label, template, detail_es, detail_en]
const COMMANDS = [
  // Raíces y fracciones
  ['sqrt',     'sqrt(${x})',              'raíz cuadrada',             'square root'],
  ['root',     'root(${n})(${x})',        'raíz n-ésima',              'nth root'],
  // Integrales
  ['int',      'int',                     'integral',                  'integral'],
  ['int_^',    'int_${a}^${b}',           'integral con límites',      'integral with limits'],
  ['oint',     'oint',                    'integral de línea',         'line integral'],
  // Sumatorios y productos
  ['sum',      'sum',                     'sumatorio',                 'sum'],
  ['sum_^',    'sum_(${k=0})^${n}',       'sumatorio con límites',     'sum with limits'],
  ['prod',     'prod',                    'productorio',               'product'],
  ['lim',      'lim_(${x->0})',           'límite',                    'limit'],
  // Operadores
  ['del',      'del',                     '∂ derivada parcial',        '∂ partial derivative'],
  ['grad',     'grad',                    '∇ gradiente',               '∇ gradient'],
  ['xx',       'xx',                      '× producto vectorial',      '× cross product'],
  ['**',       '**',                      '· producto escalar',        '· dot product'],
  ['+-',       '+-',                      '± más-menos',               '± plus-minus'],
  ['@',        '@',                       '∘ composición',             '∘ composition'],
  // Relaciones
  ['<=',       '<=',                      '≤',                         '≤'],
  ['>=',       '>=',                      '≥',                         '≥'],
  ['!=',       '!=',                      '≠',                         '≠'],
  ['~=',       '~=',                      '≈ aproximado',              '≈ approximate'],
  ['-=',       '-=',                      '≡ equivalente',             '≡ equivalent'],
  ['prop',     'prop',                    '∝ proporcional',            '∝ proportional'],
  ['<<',       '<<',                      '≪',                         '≪'],
  ['>>',       '>>',                      '≫',                         '≫'],
  // Conjuntos
  ['in',       'in',                      '∈',                         '∈'],
  ['notin',    'notin',                   '∉',                         '∉'],
  ['sub',      'sub',                     '⊂',                         '⊂'],
  ['sube',     'sube',                    '⊆',                         '⊆'],
  ['cup',      'cup',                     '∪',                         '∪'],
  ['cap',      'cap',                     '∩',                         '∩'],
  ['O/',       'O/',                      '∅ vacío',                   '∅ empty set'],
  ['AA',       'AA',                      '∀ para todo',               '∀ for all'],
  ['EE',       'EE',                      '∃ existe',                  '∃ exists'],
  // Flechas
  ['->',       '->',                      '→',                         '→'],
  ['=>',       '=>',                      '⇒',                         '⇒'],
  ['<-',       '<-',                      '←',                         '←'],
  ['<=>',      '<=>',                     '⟺',                        '⟺'],
  ['|->',      '|->',                     '↦',                         '↦'],
  ['uarr',     'uarr',                    '↑',                         '↑'],
  ['darr',     'darr',                    '↓',                         '↓'],
  // Letras griegas (minúsculas)
  ['alpha',    'alpha',    'α',           'α'],
  ['beta',     'beta',     'β',           'β'],
  ['gamma',    'gamma',    'γ',           'γ'],
  ['delta',    'delta',    'δ',           'δ'],
  ['epsilon',  'epsilon',  'ε',           'ε'],
  ['zeta',     'zeta',     'ζ',           'ζ'],
  ['eta',      'eta',      'η',           'η'],
  ['theta',    'theta',    'θ',           'θ'],
  ['iota',     'iota',     'ι',           'ι'],
  ['kappa',    'kappa',    'κ',           'κ'],
  ['lambda',   'lambda',   'λ',           'λ'],
  ['mu',       'mu',       'μ',           'μ'],
  ['nu',       'nu',       'ν',           'ν'],
  ['xi',       'xi',       'ξ',           'ξ'],
  ['pi',       'pi',       'π',           'π'],
  ['rho',      'rho',      'ρ',           'ρ'],
  ['sigma',    'sigma',    'σ',           'σ'],
  ['tau',      'tau',      'τ',           'τ'],
  ['upsilon',  'upsilon',  'υ',           'υ'],
  ['phi',      'phi',      'φ',           'φ'],
  ['chi',      'chi',      'χ',           'χ'],
  ['psi',      'psi',      'ψ',           'ψ'],
  ['omega',    'omega',    'ω',           'ω'],
  // Letras griegas (mayúsculas)
  ['Gamma',    'Gamma',    'Γ',           'Γ'],
  ['Delta',    'Delta',    'Δ',           'Δ'],
  ['Theta',    'Theta',    'Θ',           'Θ'],
  ['Lambda',   'Lambda',   'Λ',           'Λ'],
  ['Xi',       'Xi',       'Ξ',           'Ξ'],
  ['Pi',       'Pi',       'Π',           'Π'],
  ['Sigma',    'Sigma',    'Σ',           'Σ'],
  ['Upsilon',  'Upsilon',  'Υ',           'Υ'],
  ['Phi',      'Phi',      'Φ',           'Φ'],
  ['Psi',      'Psi',      'Ψ',           'Ψ'],
  ['Omega',    'Omega',    'Ω',           'Ω'],
  // Funciones
  ['sin',      'sin',      'seno',                   'sine'],
  ['cos',      'cos',      'coseno',                 'cosine'],
  ['tan',      'tan',      'tangente',               'tangent'],
  ['arcsin',   'arcsin',   'arcoseno',               'arcsine'],
  ['arccos',   'arccos',   'arcocoseno',             'arccosine'],
  ['arctan',   'arctan',   'arcotangente',           'arctangent'],
  ['sinh',     'sinh',     'seno hiperbólico',       'hyperbolic sine'],
  ['cosh',     'cosh',     'coseno hiperbólico',     'hyperbolic cosine'],
  ['tanh',     'tanh',     'tangente hiperbólica',   'hyperbolic tangent'],
  ['exp',      'exp',      'exponencial',            'exponential'],
  ['log',      'log',      'logaritmo',              'logarithm'],
  ['ln',       'ln',       'logaritmo natural',      'natural logarithm'],
  ['det',      'det',      'determinante',           'determinant'],
  ['max',      'max',      'máximo',                 'maximum'],
  ['min',      'min',      'mínimo',                 'minimum'],
  ['inf',      'inf',      'ínfimo',                 'infimum'],
  ['sup',      'sup',      'supremo',                'supremum'],
  ['gcd',      'gcd',      'máximo común divisor',   'greatest common divisor'],
  // Constantes
  ['oo',       'oo',       '∞ infinito',             '∞ infinity'],
  ['infty',    'infty',    '∞ infinito (alt)',        '∞ infinity (alt)'],
  ['hbar',     'hbar',     'ℏ',                      'ℏ'],
  ['ell',      'ell',      'ℓ',                      'ℓ'],
  ['Re',       'Re',       'parte real',             'real part'],
  ['Im',       'Im',       'parte imaginaria',       'imaginary part'],
  // Decoradores
  ['hat',      'hat(${x})',      'sombrero ^',        'hat ^'],
  ['bar',      'bar(${x})',      'barra encima',      'overbar'],
  ['vec',      'vec(${x})',      'vector →',          'vector →'],
  ['dot',      'dot(${x})',      'punto encima',      'dot above'],
  ['ddot',     'ddot(${x})',     'doble punto',       'double dot'],
  ['tilde',    'tilde(${x})',    'tilde ~',           'tilde ~'],
  ['ul',       'ul(${x})',       'subrayado',         'underline'],
  // Fuentes
  ['bb',       'bb(${x})',       'negrita',                   'bold'],
  ['bbb',      'bbb(${x})',      'negrita doble (ℝ, ℕ…)',     'blackboard bold (ℝ, ℕ…)'],
  ['cc',       'cc(${x})',       'caligráfica',               'calligraphic'],
  ['tt',       'tt(${x})',       'monoespaciada',             'monospace'],
  ['fr',       'fr(${x})',       'fraktur',                   'fraktur'],
  ['sf',       'sf(${x})',       'sans-serif',                'sans-serif'],
  ['text',     'text(${texto})', 'texto en ecuación',         'text in equation'],
  // Estructuras
  ['abs',      '|${x}|',                       'valor absoluto',      'absolute value'],
  ['norm',     '||${x}||',                     'norma',               'norm'],
  ['floor',    'lfloor ${x} rfloor',           'suelo',               'floor'],
  ['ceil',     'lceil ${x} rceil',             'techo',               'ceiling'],
  ['binom',    '((${n}),(${k}))',              'coeficiente binomial', 'binomial coefficient'],
  ['matrix',   '[[${a}, ${b}],[${c}, ${d}]]', 'matriz 2×2',           '2×2 matrix'],
];

export function makeAsciimathCompletionSource(lang = 'es') {
  const detailIdx = lang === 'en' ? 1 : 0;
  return function asciimathCompletionSource(context) {
    const match = context.matchBefore(/[a-zA-Z|][a-zA-Z0-9_]*/);
    if (!match || (match.from === match.to && !context.explicit)) return null;
    return {
      from: match.from,
      options: COMMANDS.map(([label, template, detail_es, detail_en]) => ({
        label,
        apply: template.includes('${') ? snippet(template) : template,
        detail: detailIdx === 0 ? detail_es : detail_en,
        type: 'keyword',
      })),
      validFor: /^[a-zA-Z0-9_|]*$/,
    };
  };
}
