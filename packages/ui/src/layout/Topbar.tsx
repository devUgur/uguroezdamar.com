export function Topbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 p-6 md:p-10 flex justify-between items-center mix-blend-difference text-primary-foreground">
      <div className="font-serif text-lg tracking-tight">SDS.</div>
      <div className="flex gap-6 font-mono text-xs uppercase tracking-widest">
        <a href="#about" className="link-underline">About</a>
        <a href="#work" className="link-underline">Work</a>
        <a href="#contact" className="link-underline">Contact</a>
      </div>
    </nav>
  );
}

export default Topbar;
