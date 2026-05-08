export const ASCII_EXAMPLES = [
  { label: 'Integral gaussiana',  src: 'int_0^oo e^(-x^2) dx = sqrt(pi)/2' },
  { label: 'Identidad de Euler',  src: 'e^(i pi) + 1 = 0' },
  { label: 'Fracción',            src: '(x^2 + 1)/(2x - 3)' },
  { label: 'Sumatorio',           src: 'sum_(k=0)^n k = (n(n+1))/2' },
  { label: 'Serie de Taylor',     src: 'f(x) = sum_(n=0)^oo (f^((n))(a))/(n!)(x-a)^n' },
  { label: 'Binomio de Newton',   src: '(x+y)^n = sum_(k=0)^n ((n),(k)) x^(n-k) y^k' },
  { label: 'Límite',              src: 'lim_(x->0) (sin x)/x = 1' },
  { label: 'Raíz n-ésima',       src: 'root(3)(x^2 + 1)' },
  { label: 'Matriz',              src: '[[a, b],[c, d]]' },
];

export const EXAMPLES = [
  { label: 'Integral gaussiana',  src: '\\int_0^\\infty e^{-x^2}\\,dx = \\dfrac{\\sqrt{\\pi}}{2}' },
  { label: 'Identidad de Euler',  src: 'e^{i\\pi} + 1 = 0' },
  { label: 'Maxwell',             src: '\\nabla \\times \\mathbf{B} = \\mu_0\\!\\left(\\mathbf{J} + \\varepsilon_0\\frac{\\partial \\mathbf{E}}{\\partial t}\\right)' },
  { label: 'Schrödinger',         src: 'i\\hbar\\frac{\\partial}{\\partial t}\\Psi = -\\frac{\\hbar^2}{2m}\\nabla^2\\Psi + V\\Psi' },
  { label: 'Fourier',             src: '\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\,e^{-2\\pi i x\\xi}\\,dx' },
  { label: 'COP bomba de calor',  src: 'COP_{HP} = \\frac{Q_H}{W_{comp}} = \\frac{T_H}{T_H - T_L}' },
  { label: 'Transferencia calor', src: 'Q = U A\\,\\Delta T_{lm} = U A\\,\\frac{\\Delta T_1 - \\Delta T_2}{\\ln(\\Delta T_1/\\Delta T_2)}' },
  { label: 'Serie de Taylor',     src: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n' },
  { label: 'Binomio de Newton',   src: '(x+y)^n = \\sum_{k=0}^{n}\\binom{n}{k}x^{n-k}y^k' },
];
