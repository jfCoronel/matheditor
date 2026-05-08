export function Header() {
  return (
    <header>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="24" height="24" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#185fa5"/>
        <text x="16" y="24" fontSize="22" textAnchor="middle" fill="white" fontFamily="Georgia, serif">∑</text>
      </svg>
      <h1>Editor de ecuaciones → SVG</h1>
      <span className="badge">LaTeX · ASCIIMath · SVG</span>
    </header>
  );
}
