import React from "react";

export function Hero() {
  return (
    <section className="h-screen flex flex-col justify-center px-6 md:px-12 lg:px-24">
      <div className="max-w-5xl animate-in fade-in slide-in-from-bottom-3 duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]">
        <h1 className="font-serif text-[3rem] md:text-[5rem] lg:text-[7.5rem] leading-[1.1] tracking-tighter mb-8 group">
          <span className="block transition-colors duration-200 hover:text-accent cursor-default">I build</span>
          <span className="block transition-colors duration-200 hover:text-accent cursor-default">structured</span>
          <span className="block transition-colors duration-200 hover:text-accent cursor-default">digital systems.</span>
        </h1>
        <div className="flex items-center gap-4 text-secondary-foreground font-mono text-sm tracking-wide">
          <p>Fullstack Developer</p>
          <span className="w-4 h-[1px] bg-border"></span>
          <p>Dortmund — 2026</p>
        </div>
      </div>

      <div className="absolute bottom-10 left-6 md:left-12 lg:left-24 font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-4">
        <span>Scroll to explore</span>
        <div className="w-12 h-[1px] bg-border relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-full bg-foreground animate-[slide-right_2s_ease-in-out_infinite]" style={{
            animation: 'slideRight 2s ease-in-out infinite'
          }}></div>
        </div>
      </div>
      <style>{`
        @keyframes slideRight {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </section>
  );
}

export default Hero;
