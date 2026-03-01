import { useEffect, useState } from "react";
import { ArrowUpRight, Terminal, Globe, Smartphone, Monitor, Layers } from "lucide-react";

export default function Home() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden font-sans">
      <div 
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.02] mix-blend-multiply"
        style={{ backgroundImage: 'url("https://upload.wikimedia.org/wikipedia/commons/7/76/1k_Dissolve_Noise_Texture.png")' }}
      ></div>

      <div 
        className="pointer-events-none fixed inset-0 z-0 opacity-5 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle 600px at ${mousePosition.x}px ${mousePosition.y}px, rgba(107, 78, 61, 0.4), transparent 80%)`
        }}
      />

      <div className="relative z-10">
        <Navigation />
        <Hero />
        <About />
        <Work />
        <Education />
        <Contact />
      </div>
    </div>
  );
}

function Navigation() {
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

function Hero() {
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
          <p>Berlin — 2026</p>
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

function About() {
  return (
    <section id="about" className="py-24 md:py-32 lg:py-40 px-6 md:px-12 lg:px-24 hairline-t">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-8">
        <div className="lg:col-span-7">
          <p className="font-sans text-xl md:text-2xl leading-[1.6] md:leading-[1.8] text-foreground max-w-[680px]">
            My approach to software engineering is rooted in architectural principles. 
            I believe that digital products should be built with intention, where every 
            line of code serves a structural purpose. By stripping away the unnecessary, 
            I create resilient, highly performant systems that scale gracefully. 
            Currently focusing on the intersection of design engineering and backend infrastructure.
          </p>
        </div>
        
        <div className="lg:col-span-4 lg:col-start-9 relative">
          <div className="absolute left-[5px] top-2 bottom-2 w-[1px] bg-border"></div>
          <div className="space-y-12">
            {[
              { year: "2026", title: "Senior Design Engineer", desc: "Leading architectural frontend systems at Studio N." },
              { year: "2024", title: "Fullstack Developer", desc: "Built resilient microservices for fintech scaleups." },
              { year: "2022", title: "Frontend Architect", desc: "Established core UI foundations for global e-commerce." }
            ].map((item, i) => (
              <div key={i} className="relative pl-8 group">
                <div className="absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full bg-background border border-foreground group-hover:bg-foreground transition-colors duration-300"></div>
                <div className="font-mono text-sm text-muted-foreground mb-1">{item.year}</div>
                <h3 className="font-serif text-xl mb-2">{item.title}</h3>
                <p className="text-secondary-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

type DeviceType = 'web' | 'mobile' | 'cli';

interface ProjectProps {
  name: string;
  year: string;
  role: string;
  stack: string;
  types: DeviceType[];
  image: string;
}

function MockupFrame({ type, image, name, zIndex = 0, scale = 1, xOffset = 0, yOffset = 0, opacity = 1 }: { type: DeviceType, image: string, name: string, zIndex?: number, scale?: number, xOffset?: number, yOffset?: number, opacity?: number }) {
  const style = {
    zIndex,
    transform: `scale(${scale}) translate(${xOffset}px, ${yOffset}px)`,
    opacity,
  };

  if (type === 'cli') {
    return (
      <div className="w-full h-full bg-[#1e1e1e] rounded-md border border-[#333] flex flex-col overflow-hidden shadow-2xl transition-all duration-500" style={style}>
        <div className="bg-[#2d2d2d] px-3 py-1.5 flex items-center gap-2 border-b border-[#333]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <div className="text-[10px] font-mono text-gray-400 ml-2 flex items-center gap-1">
            <Terminal size={10} /> {name.toLowerCase().replace(' ', '-')}.sh
          </div>
        </div>
        <div className="p-4 font-mono text-xs text-green-400 leading-relaxed overflow-hidden">
          <div className="flex gap-2 mb-1">
            <span className="text-blue-400">➜</span>
            <span className="text-white">~/{name.toLowerCase().replace(' ', '-')}</span>
            <span className="text-gray-500">git:(main)</span>
          </div>
          <div className="mb-2">Developing high-performance CLI utilities...</div>
          <div className="animate-pulse">_</div>
          <img src={image} className="mt-4 opacity-20 grayscale filter blur-[1px] object-cover h-32 w-full rounded" alt="" />
        </div>
      </div>
    );
  }

  if (type === 'mobile') {
    return (
      <div className="relative border-gray-800 dark:border-gray-800 bg-gray-800 border-[8px] rounded-[2.5rem] h-[400px] w-[200px] shadow-2xl overflow-hidden transition-all duration-500" style={style}>
        <div className="h-[18px] w-[2px] bg-gray-800 dark:bg-gray-800 absolute -start-[10px] top-[40px] rounded-s-lg"></div>
        <div className="h-[32px] w-[2px] bg-gray-800 dark:bg-gray-800 absolute -start-[10px] top-[72px] rounded-s-lg"></div>
        <div className="h-[32px] w-[2px] bg-gray-800 dark:bg-gray-800 absolute -start-[10px] top-[112px] rounded-s-lg"></div>
        <div className="h-[48px] w-[2px] bg-gray-800 dark:bg-gray-800 absolute -end-[10px] top-[72px] rounded-e-lg"></div>
        <div className="rounded-[2rem] overflow-hidden w-full h-full bg-white dark:bg-gray-900">
          <img src={image} className="w-full h-full object-cover grayscale opacity-80" alt={name} />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-gray-800 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white dark:bg-[#1a1a1a] rounded-lg border border-border flex flex-col overflow-hidden shadow-2xl transition-all duration-500" style={style}>
      <div className="bg-surface px-4 py-2 flex items-center justify-between border-b border-border">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
        </div>
        <div className="bg-background px-3 py-0.5 rounded text-[10px] font-mono text-muted-foreground border border-border flex items-center gap-1.5 truncate max-w-[150px]">
          <Globe size={10} /> {name.toLowerCase().replace(' ', '-')}.app
        </div>
        <div className="w-10" />
      </div>
      <div className="flex-1 overflow-hidden">
        <img src={image} className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-[40%] transition-all duration-700" alt={name} />
      </div>
    </div>
  );
}

function ProjectDisplay({ project }: { project: ProjectProps }) {
  const { types, image, name } = project;
  
  // If only one type, use the standard display
  if (types.length === 1) {
    return <MockupFrame type={types[0]} image={image} name={name} />;
  }

  // For multi-device projects, we create a layered stack
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {types.map((type, index) => {
        // Calculate stacking order and offsets
        const isLast = index === types.length - 1;
        const zIndex = 10 + index;
        const scale = 0.85 + (index * 0.05);
        const xOffset = -40 + (index * 40);
        const yOffset = -20 + (index * 20);
        const opacity = 0.6 + (index * 0.2);

        return (
          <div key={type} className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:pointer-events-auto">
            <div className="w-full h-full max-w-[400px] max-h-[300px]">
               <MockupFrame 
                type={type} 
                image={image} 
                name={name} 
                zIndex={zIndex}
                scale={scale}
                xOffset={xOffset}
                yOffset={yOffset}
                opacity={opacity}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Work() {
  const projects: ProjectProps[] = [
    { name: "Aura Core", year: "2025", role: "Architecture", stack: "React, Node, Go", types: ['web', 'mobile'], image: "/src/assets/images/project-1.jpg" },
    { name: "Lumina Data", year: "2024", role: "Fullstack", stack: "TypeScript, PostgreSQL", types: ['cli', 'web'], image: "/src/assets/images/project-2.jpg" },
    { name: "Vanguard Platform", year: "2023", role: "Frontend", stack: "Next.js, WebGL", types: ['web', 'mobile', 'cli'], image: "/src/assets/images/project-3.jpg" },
  ];

  return (
    <section id="work" className="py-24 md:py-32 lg:py-40 px-6 md:px-12 lg:px-24 hairline-t">
      <div className="mb-16 md:mb-24">
        <h2 className="font-mono text-sm uppercase tracking-widest text-muted-foreground">02 — Selected Work</h2>
      </div>

      <div className="flex flex-col">
        {projects.map((project, i) => (
          <div key={i} className="group project-container relative py-12 md:py-24 lg:py-32 hairline-b first:hairline-t flex flex-col md:flex-row md:items-center justify-between cursor-pointer">
            <div className="absolute bottom-[-1px] left-0 w-full h-[1px] bg-foreground project-hover-line z-10"></div>
            
            <div className="z-20 relative md:max-w-xl pr-8">
              <div className="flex items-center gap-3 mb-4">
                <Layers size={14} className="text-accent" />
                <div className="flex gap-2">
                  {project.types.map(t => (
                    <span key={t} className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground border border-border px-1.5 py-0.5 rounded-sm">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <h3 className="font-serif text-4xl md:text-6xl lg:text-7xl mb-4 group-hover:text-accent transition-colors duration-300">{project.name}</h3>
              <div className="font-mono text-sm text-secondary-foreground flex flex-wrap items-center gap-3">
                <span>{project.year}</span>
                <span className="w-3 h-[1px] bg-border"></span>
                <span>{project.role}</span>
                <span className="w-3 h-[1px] bg-border"></span>
                <span>{project.stack}</span>
              </div>
            </div>

            <div className="mt-16 md:mt-0 md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2 w-full md:w-[450px] lg:w-[600px] h-[350px] md:h-[450px] opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] z-10 pointer-events-none md:translate-x-12 group-hover:translate-x-0">
              <ProjectDisplay project={project} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Education() {
  const education = [
    { year: "2022", title: "MSc Computer Science", institution: "Technical University of Munich" },
    { year: "2020", title: "BSc Software Engineering", institution: "University of Stuttgart" },
    { year: "2019", title: "Design Systems Certificate", institution: "Nielsen Norman Group" },
  ];

  return (
    <section className="py-24 md:py-32 lg:py-40 px-6 md:px-12 lg:px-24 hairline-t">
      <div className="mb-16 md:mb-24">
        <h2 className="font-mono text-sm uppercase tracking-widest text-muted-foreground">03 — Education</h2>
      </div>

      <div className="max-w-4xl">
        {education.map((item, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 py-8 hairline-b first:hairline-t hover:bg-surface/50 transition-colors duration-300 -mx-6 px-6 md:mx-0 md:px-0 rounded-sm">
            <div className="font-mono text-sm text-secondary-foreground md:pt-1">{item.year}</div>
            <div className="md:col-span-3 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
              <h3 className="font-serif text-xl md:text-2xl">{item.title}</h3>
              <p className="font-sans text-muted-foreground text-sm">{item.institution}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="py-32 md:py-48 lg:py-64 px-6 md:px-12 lg:px-24 hairline-t flex flex-col items-center justify-center text-center">
      <h2 className="font-serif text-4xl md:text-6xl lg:text-7xl mb-16 tracking-tight">Let’s build something meaningful.</h2>
      
      <div className="flex flex-col md:flex-row gap-8 md:gap-16 font-mono text-sm uppercase tracking-widest">
        <a href="mailto:hello@example.com" className="link-underline inline-flex items-center gap-2 group hover:-translate-y-0.5 transition-transform duration-300">
          Email <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
        </a>
        <a href="#" className="link-underline inline-flex items-center gap-2 group hover:-translate-y-0.5 transition-transform duration-300">
          LinkedIn <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
        </a>
        <a href="#" className="link-underline inline-flex items-center gap-2 group hover:-translate-y-0.5 transition-transform duration-300">
          GitHub <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
        </a>
      </div>

      <footer className="w-full mt-32 md:mt-48 pt-8 hairline-t flex flex-col md:flex-row justify-between items-center gap-4 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
        <p>© 2026 Structured Digital Systems</p>
        <p>Berlin, Germany</p>
        <p>All rights reserved</p>
      </footer>
    </section>
  );
}
