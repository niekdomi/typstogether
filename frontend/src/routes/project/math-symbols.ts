// Curated Typst math symbols for the toolbar symbol picker.
//
// `token` is the exact text inserted into math mode (Typst uses bare names, not
// LaTeX backslash commands). `glyph` is the rendered character shown on the
// button, and `name` is the human label used for the tooltip / aria-label.
//
// REF: https://typst.app/docs/reference/symbols/sym/

export interface MathSymbol {
  glyph: string;
  token: string;
  name: string;
}

export interface MathSymbolGroup {
  category: string;
  symbols: MathSymbol[];
}

export const MATH_SYMBOLS: MathSymbolGroup[] = [
  {
    category: "Greek",
    symbols: [
      { glyph: "α", token: "alpha", name: "Alpha" },
      { glyph: "β", token: "beta", name: "Beta" },
      { glyph: "γ", token: "gamma", name: "Gamma" },
      { glyph: "δ", token: "delta", name: "Delta" },
      { glyph: "ε", token: "epsilon", name: "Epsilon" },
      { glyph: "θ", token: "theta", name: "Theta" },
      { glyph: "λ", token: "lambda", name: "Lambda" },
      { glyph: "μ", token: "mu", name: "Mu" },
      { glyph: "π", token: "pi", name: "Pi" },
      { glyph: "ρ", token: "rho", name: "Rho" },
      { glyph: "σ", token: "sigma", name: "Sigma" },
      { glyph: "τ", token: "tau", name: "Tau" },
      { glyph: "φ", token: "phi", name: "Phi" },
      { glyph: "ψ", token: "psi", name: "Psi" },
      { glyph: "ω", token: "omega", name: "Omega" },
      { glyph: "Γ", token: "Gamma", name: "Gamma (uppercase)" },
      { glyph: "Δ", token: "Delta", name: "Delta (uppercase)" },
      { glyph: "Θ", token: "Theta", name: "Theta (uppercase)" },
      { glyph: "Λ", token: "Lambda", name: "Lambda (uppercase)" },
      { glyph: "Π", token: "Pi", name: "Pi (uppercase)" },
      { glyph: "Σ", token: "Sigma", name: "Sigma (uppercase)" },
      { glyph: "Φ", token: "Phi", name: "Phi (uppercase)" },
      { glyph: "Ψ", token: "Psi", name: "Psi (uppercase)" },
      { glyph: "Ω", token: "Omega", name: "Omega (uppercase)" },
    ],
  },
  {
    category: "Operators",
    symbols: [
      { glyph: "±", token: "plus.minus", name: "Plus-minus" },
      { glyph: "∓", token: "minus.plus", name: "Minus-plus" },
      { glyph: "×", token: "times", name: "Times" },
      { glyph: "÷", token: "div", name: "Division" },
      { glyph: "⋅", token: "dot.op", name: "Dot product" },
      { glyph: "∗", token: "ast", name: "Asterisk operator" },
      { glyph: "⋆", token: "star.op", name: "Star operator" },
      { glyph: "∘", token: "compose", name: "Composition" },
      { glyph: "⊕", token: "plus.circle", name: "Circled plus" },
      { glyph: "⊗", token: "times.circle", name: "Circled times" },
    ],
  },
  {
    category: "Relations",
    symbols: [
      { glyph: "≠", token: "eq.not", name: "Not equal" },
      { glyph: "≤", token: "lt.eq", name: "Less than or equal" },
      { glyph: "≥", token: "gt.eq", name: "Greater than or equal" },
      { glyph: "≈", token: "approx", name: "Approximately" },
      { glyph: "≡", token: "equiv", name: "Equivalent" },
      { glyph: "∝", token: "prop", name: "Proportional to" },
      { glyph: "∼", token: "tilde.op", name: "Similar to" },
      { glyph: "≺", token: "prec", name: "Precedes" },
      { glyph: "≻", token: "succ", name: "Succeeds" },
    ],
  },
  {
    category: "Arrows",
    symbols: [
      { glyph: "→", token: "arrow.r", name: "Right arrow" },
      { glyph: "←", token: "arrow.l", name: "Left arrow" },
      { glyph: "↑", token: "arrow.t", name: "Up arrow" },
      { glyph: "↓", token: "arrow.b", name: "Down arrow" },
      { glyph: "↔", token: "arrow.l.r", name: "Left-right arrow" },
      { glyph: "⇒", token: "arrow.r.double", name: "Implies" },
      { glyph: "⇔", token: "arrow.l.r.double", name: "If and only if" },
      { glyph: "↦", token: "arrow.r.bar", name: "Maps to" },
    ],
  },
  {
    category: "Sets & logic",
    symbols: [
      { glyph: "∈", token: "in", name: "Element of" },
      { glyph: "∉", token: "in.not", name: "Not an element of" },
      { glyph: "⊂", token: "subset", name: "Subset" },
      { glyph: "⊆", token: "subset.eq", name: "Subset or equal" },
      { glyph: "⊃", token: "supset", name: "Superset" },
      { glyph: "∪", token: "union", name: "Union" },
      { glyph: "∩", token: "sect", name: "Intersection" },
      { glyph: "∅", token: "emptyset", name: "Empty set" },
      { glyph: "∀", token: "forall", name: "For all" },
      { glyph: "∃", token: "exists", name: "There exists" },
      { glyph: "¬", token: "not", name: "Negation" },
      { glyph: "∧", token: "and", name: "Logical and" },
      { glyph: "∨", token: "or", name: "Logical or" },
    ],
  },
  {
    category: "Calculus & misc",
    symbols: [
      { glyph: "∑", token: "sum", name: "Sum" },
      { glyph: "∏", token: "product", name: "Product" },
      { glyph: "∫", token: "integral", name: "Integral" },
      { glyph: "∬", token: "integral.double", name: "Double integral" },
      { glyph: "∮", token: "integral.cont", name: "Contour integral" },
      { glyph: "∂", token: "partial", name: "Partial derivative" },
      { glyph: "∇", token: "nabla", name: "Nabla" },
      { glyph: "∞", token: "infinity", name: "Infinity" },
      { glyph: "∠", token: "angle", name: "Angle" },
      { glyph: "°", token: "degree", name: "Degree" },
      { glyph: "′", token: "prime", name: "Prime" },
      { glyph: "⋯", token: "dots.h.c", name: "Centered horizontal dots" },
      { glyph: "⋮", token: "dots.v", name: "Vertical dots" },
    ],
  },
];
