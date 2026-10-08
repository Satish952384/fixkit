import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  Code,
  FileDown,
  FileText,
  Image as ImageIcon,
  Maximize2,
  Merge,
  RefreshCw,
  Sparkles,
  Split,
  Terminal,
  Type,
  type LucideIcon,
} from "lucide-react";
import FixKitFileFlow from "@/components/FixKitFileFlow";
import AuthNav from "@/components/AuthNav";

type NavLink = { label: string; href: string };
type Tool = { name: string; description: string; category: string; icon: LucideIcon; href?: string };
type Category = { name: string; description: string; tasks: string[]; icon: LucideIcon };
type Step = { number: string; title: string; description: string };

const navLinks: NavLink[] = [
  { label: "Tools", href: "#tools" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "About", href: "#about" },
];

// `href` is only set for tools that have a working route. Tools without it render as "Coming soon".
const tools: Tool[] = [
  {
    name: "Compress PDF",
    description: "Shrink large PDFs to a size you can actually send.",
    category: "PDF",
    icon: FileDown,
    href: "/tools/pdf-compressor",
  },
  {
    name: "Merge PDF",
    description: "Combine several PDFs into one clean document.",
    category: "PDF",
    icon: Merge,
    href: "/tools/pdf-merger",
  },
  {
    name: "Split PDF",
    description: "Pull out the pages you need from any PDF.",
    category: "PDF",
    icon: Split,
  },
  {
    name: "Compress Image",
    description: "Reduce image file size while keeping it sharp.",
    category: "Image",
    icon: ImageIcon,
    href: "/tools/image-compressor",
  },
  {
    name: "Resize Image",
    description: "Set exact dimensions for any upload or profile.",
    category: "Image",
    icon: Maximize2,
    href: "/tools/image-resizer",
  },
  {
    name: "Convert Image",
    description: "Switch between JPG, PNG, WebP and more.",
    category: "Image",
    icon: RefreshCw,
    href: "/tools/image-converter",
  },
  {
    name: "Word Counter",
    description: "Count words, characters and reading time instantly.",
    category: "Text",
    icon: Type,
    href: "/tools/word-counter",
  },
  {
    name: "JSON Formatter",
    description: "Format, validate and clean up messy JSON.",
    category: "Text",
    icon: Braces,
  },
  {
    name: "Developer Tools",
    description: "Small utilities that save developers time.",
    category: "Developer",
    icon: Terminal,
  },
];

const categories: Category[] = [
  {
    name: "Documents",
    description: "Everything you need to handle PDFs without installing anything.",
    tasks: ["Compress and merge PDFs", "Split pages apart", "Convert JPG and PDF"],
    icon: FileText,
  },
  {
    name: "Images",
    description: "Prepare images for email, forms, websites and social profiles.",
    tasks: ["Compress to a target size", "Resize to exact dimensions", "Convert between formats"],
    icon: ImageIcon,
  },
  {
    name: "Text",
    description: "Quick checks and cleanups for the words and data you work with.",
    tasks: ["Count words and characters", "Format and validate JSON", "Clean up pasted content"],
    icon: Type,
  },
  {
    name: "Developer",
    description: "Lightweight utilities for the small jobs that interrupt your flow.",
    tasks: ["Inspect and format data", "Encode and decode strings", "More tools coming soon"],
    icon: Code,
  },
];

const steps: Step[] = [
  { number: "01", title: "Tell us what you need", description: "Describe your task in plain language, just like you would to a colleague." },
  { number: "02", title: "FixKit finds the right tool", description: "Your request is matched to the correct utility with the settings already filled in." },
  { number: "03", title: "Get your result", description: "Run the tool, download the output, and get back to what you were doing." },
];

const footerLinks: NavLink[] = [
  { label: "Tools", href: "#tools" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "About", href: "#about" },
  { label: "Privacy", href: "#" },
  { label: "Terms", href: "#" },
];

function ToolCardBody({ tool, available }: { tool: Tool; available: boolean }) {
  const Icon = tool.icon;

  return (
    <>
      <div className="flex items-start justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {available ? (
          <ArrowUpRight
            className="h-5 w-5 text-white/30 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
            aria-hidden="true"
          />
        ) : (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-white/50">
            Coming soon
          </span>
        )}
      </div>
      <p className="mt-6 text-xs font-medium uppercase tracking-widest text-white/40">{tool.category}</p>
      <h3 className="mt-1 text-lg font-semibold">{tool.name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{tool.description}</p>
    </>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink text-white">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink/70 backdrop-blur-xl">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-lg font-bold tracking-[0.2em]">
            FIX<span className="text-accent">KIT</span>
          </Link>

          <ul className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="text-sm text-white/60 transition-colors hover:text-white">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 sm:gap-3">
            <AuthNav />
            <Link
              href="#tools"
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:brightness-110"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* HERO */}
        <section className="bg-grid relative isolate px-5 pb-24 pt-20 sm:px-8 sm:pt-28">
          <div className="hero-glow" aria-hidden="true" />
          <FixKitFileFlow />

          <div className="relative z-10 mx-auto max-w-4xl text-center">
            <p className="glass mx-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-white/70">
              <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              AI-powered digital utilities
            </p>

            <h1 className="mt-7 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              Fix your digital <span className="text-gradient">problems.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg">
              FixKit brings everyday digital tools into one simple place, so a small task never turns into a
              long search.
            </p>

            <div role="search" className="glass command-box mx-auto mt-10 flex max-w-2xl flex-col gap-3 rounded-3xl p-3 sm:flex-row sm:items-center sm:rounded-full sm:p-2">
              <label htmlFor="fixkit-command" className="sr-only">
                Tell FixKit what you need
              </label>
              <input
                id="fixkit-command"
                type="text"
                placeholder="Tell FixKit what you need..."
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-white placeholder:text-white/40 focus:outline-none sm:px-5 sm:py-3.5 sm:text-lg"
              />
              {/* AI routing is not implemented in V1, so this action is intentionally unavailable. */}
              <button
                type="button"
                disabled
                title="AI command routing is coming soon"
                className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-accent px-7 py-3.5 text-base font-semibold text-ink opacity-60 sm:rounded-full"
              >
                Fix it
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only"> (AI command routing is coming soon)</span>
              </button>
            </div>

            <p className="mt-4 text-sm text-white/40">
              Try: <span className="text-white/60">Make my PDF smaller than 1MB</span>
            </p>
            <p className="mt-10 text-sm text-white/40">Fast tools. Simple workflow. Built for everyday digital tasks.</p>
          </div>
        </section>

        {/* POPULAR TOOLS */}
        <section id="tools" className="scroll-mt-20 px-5 py-24 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Popular tools</h2>
              <p className="mt-3 text-white/60">
                Common digital tasks, completed in seconds. Pick a tool or just tell FixKit what you need.
              </p>
            </div>

            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <li key={tool.name}>
                  {tool.href ? (
                    <Link
                      href={tool.href}
                      className="glass card group flex h-full w-full flex-col rounded-2xl p-6 text-left"
                    >
                      <ToolCardBody tool={tool} available />
                    </Link>
                  ) : (
                    <div className="glass flex h-full w-full cursor-default flex-col rounded-2xl p-6 text-left opacity-60">
                      <ToolCardBody tool={tool} available={false} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CATEGORIES */}
        <section aria-labelledby="categories-heading" className="px-5 pb-24 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 id="categories-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Browse by category
            </h2>
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {categories.map(({ name, description, tasks, icon: Icon }) => (
                <article key={name} className="glass card rounded-2xl p-7">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                    <h3 className="text-xl font-semibold">{name}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-white/60">{description}</p>
                  <ul className="mt-5 space-y-2 border-t border-white/[0.06] pt-5 text-sm text-white/70">
                    {tasks.map((task) => (
                      <li key={task} className="flex items-center gap-2.5">
                        <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
                        {task}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="scroll-mt-20 border-y border-white/[0.06] bg-white/[0.015] px-5 py-24 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
              <p className="mt-3 text-white/60">From a sentence to a finished result in three steps.</p>
            </div>
            <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
              {steps.map(({ number, title, description }) => (
                <li key={number} className="relative md:pr-6">
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 font-mono text-sm text-accent">
                      {number}
                    </span>
                    <span className="h-px flex-1 bg-gradient-to-r from-accent/30 to-transparent" aria-hidden="true" />
                  </div>
                  <h3 className="mt-6 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FEATURE HIGHLIGHT */}
        <section id="about" className="scroll-mt-20 px-5 py-24 sm:px-8">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-accent">The AI experience</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Stop searching for the right tool.
              </h2>
              <p className="mt-5 max-w-xl leading-relaxed text-white/60">
                Describe your problem the way you would say it out loud. FixKit will understand what you are
                trying to do and guide you to the correct utility, with the right settings ready to go.
              </p>
            </div>

            <div className="glass rounded-3xl p-5 sm:p-7" aria-label="Example of the FixKit AI workflow">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.08] px-5 py-4">
                <p className="text-xs uppercase tracking-widest text-white/40">User</p>
                <p className="mt-1.5 text-white/90">I need this image under 200KB.</p>
              </div>
              <div className="mt-4 max-w-[92%] rounded-2xl rounded-bl-md border border-accent/25 bg-accent/[0.07] px-5 py-4">
                <p className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-accent">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  FixKit
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 font-medium text-white">
                  Image Compressor
                  <ArrowRight className="h-4 w-4 text-accent" aria-hidden="true" />
                  <span className="font-mono text-sm text-accent">Target: 200KB</span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.06] px-5 py-14 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-lg font-bold tracking-[0.2em]">
              FIX<span className="text-accent">KIT</span>
            </p>
            <p className="mt-2 text-sm text-white/50">Your digital problem solver.</p>
          </div>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-8 gap-y-3">
              {footerLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-white/55 transition-colors hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mx-auto mt-12 max-w-6xl text-xs text-white/35">© 2026 FixKit. All rights reserved.</p>
      </footer>
    </div>
  );
}