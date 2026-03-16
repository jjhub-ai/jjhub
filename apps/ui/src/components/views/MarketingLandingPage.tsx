import { TerminalSquare, GitMerge, Layers, Bot, Code2, ArrowRight, BookOpen, Star, Zap, Shield, Globe, Laptop, CheckCircle, Banknote } from "lucide-solid";
import WaitlistForm from "./WaitlistForm";
import "./MarketingLandingPage.css";

export default function MarketingLandingPage() {
    return (
        <div class="marketing-page-wrapper">
            {/* Ambient Base Layer */}
            <div class="ambient-layer">
                <div class="ambient-orb purple-glow"></div>
                <div class="ambient-orb blue-glow"></div>
                <div class="ambient-orb cyan-glow"></div>
                <div class="grid-overlay"></div>
            </div>

            <main class="marketing-content-wrapper">
                {/* ---------- HERO SECTION ---------- */}
                <section class="hero-section">
                    <div class="hero-badge animate-fade-in stagger-1">
                        <span class="badge-dot"></span>
                        Closed Alpha Available Now
                    </div>

                    <h1 class="hero-title animate-slide-up stagger-2">
                        The code platform for <br />
                        <span class="gradient-text">Agentic Engineering</span> teams.
                    </h1>

                    <p class="hero-subtitle animate-slide-up stagger-3">
                        JJHub unifies version control, AI agents, cloud sandboxes, and CI/CD into a single platform, transforming your existing developers into a modern, AI-powered engineering force.
                    </p>

                    <div class="hero-actions animate-slide-up stagger-4">
                        <a href="/login" class="btn-primary-large group">
                            Get Early Access
                            <ArrowRight size={18} class="group-hover:translate-x-1 transition-transform" />
                        </a>
                        <a href="https://docs.jjhub.tech" target="_blank" rel="noopener noreferrer" class="btn-secondary-large">
                            <BookOpen size={18} />
                            Read the Docs
                        </a>
                    </div>

                    {/* App Window Mockup */}
                    <div class="hero-mockup-wrapper animate-float stagger-5">
                        <div class="mockup-window mockup-window-shell glass-panel">
                            <div class="mockup-header">
                                <div class="mac-controls">
                                    <span class="mac-btn close"></span>
                                    <span class="mac-btn minimize"></span>
                                    <span class="mac-btn expand"></span>
                                </div>
                                <div class="mockup-title flex items-center gap-2">
                                    <TerminalSquare size={14} class="text-primary" />
                                    Workspace Terminal (libghostty powered)
                                </div>
                            </div>
                            <div class="mockup-body mockup-body-flush">
                                <img src="/ui/ui_terminal.png" alt="JJHub Workspace Terminal" class="w-full h-auto block" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* ---------- LOGO CLOUD (Optional concept) ---------- */}
                <section class="social-proof-section animate-fade-in stagger-5">
                    <p class="text-muted text-sm uppercase tracking-wider text-center mb-6">Built for the next generation of engineering teams</p>
                    {/* Add logos here if available */}
                </section>

                {/* ---------- FEATURES SECTION ---------- */}
                <section class="features-section">
                    <div class="section-header">
                        <h2 class="section-title">Reimagine version control.</h2>
                        <p class="section-subtitle">Git wasn't built for AI. JJHub brings Jujutsu to the enterprise, solving the rebase hell and conflict nightmare.</p>
                    </div>

                    <div class="features-grid">
                        <div class="feature-card glass-panel group">
                            <div class="feature-icon-wrapper bg-gradient-purple">
                                <GitMerge size={24} class="text-white" />
                            </div>
                            <h3>Landing Requests</h3>
                            <p class="text-muted">
                                Say goodbye to PRs. Landing Requests are built for jj's stacked changes model with stable Change IDs and programmable landing queues.
                            </p>
                        </div>

                        <div class="feature-card glass-panel group">
                            <div class="feature-icon-wrapper bg-gradient-blue">
                                <Layers size={24} class="text-white" />
                            </div>
                            <h3>Native Stacking</h3>
                            <p class="text-muted">
                                First-class support for incremental, dependent changes. Complete a stack with jj, land the whole stack with one command. No rebases.
                            </p>
                        </div>

                        <div class="feature-card glass-panel group">
                            <div class="feature-icon-wrapper bg-gradient-cyan">
                                <Bot size={24} class="text-white" />
                            </div>
                            <h3>AI Agents</h3>
                            <p class="text-muted">
                                Claude-powered agents in sandboxed runners triage issues, review code, and ship features. Bring your own keys, with zero markup.
                            </p>
                        </div>

                        <div class="feature-card glass-panel group md:col-span-2 lg:col-span-1">
                            <div class="feature-icon-wrapper bg-gradient-green">
                                <Code2 size={24} class="text-white" />
                            </div>
                            <h3>TypeScript Workflows</h3>
                            <p class="text-muted mb-4">
                                Unified AI + CI workflows defined in TypeScript, not YAML. Agents and CI steps are just code running seamlessly in your repo.
                            </p>
                            <div class="bg-root rounded-md p-3 font-mono text-xs border border-color overflow-hidden">
                                <div class="text-purple">import</div> <div class="inline text-blue">{' { '}Workflow, Task, on{' } '}</div> <div class="inline text-purple">from</div> <div class="inline text-green">'@jjhub-ai/workflow'</div>;
                                <br /><br />
                                <div class="text-purple">export default</div> (<div class="inline text-cyan">ctx</div>) <div class="inline text-purple">{'=>'}</div> (<br />
                                &nbsp;&nbsp;<div class="inline text-blue">{'<Workflow'}</div> <div class="inline text-cyan">name</div>=<div class="inline text-green">"Code Review"</div><br />
                                &nbsp;&nbsp;&nbsp;&nbsp;<div class="inline text-cyan">triggers</div>={'{'}[on.landingRequest.<div class="inline text-yellow">opened</div>()]{'}'}<div class="inline text-blue">{'>'}</div><br />
                                &nbsp;&nbsp;&nbsp;&nbsp;<div class="inline text-blue">{'<Task'}</div> <div class="inline text-cyan">id</div>=<div class="inline text-green">"review"</div> <div class="inline text-cyan">agent</div>={'{'}reviewer{'}'}<div class="inline text-blue">{'>'}</div><br />
                                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<div class="inline text-green">Review this landing request for bugs.</div><br />
                                &nbsp;&nbsp;&nbsp;&nbsp;<div class="inline text-blue">{'</Task>'}</div><br />
                                &nbsp;&nbsp;<div class="inline text-blue">{'</Workflow>'}</div><br />
                                );
                            </div>
                        </div>
                    </div>
                </section>

                {/* ---------- COMPARISON SECTION ---------- */}
                <section class="comparison-section glass-panel">
                    <div class="comparison-header">
                        <h2>Why Jujutsu over Git?</h2>
                        <p class="text-muted text-center max-w-2xl mx-auto mt-4">
                            Git was designed for human-speed collaboration. It breaks down when agents produce code at machine speed.
                        </p>
                    </div>

                    <div class="comparison-grid">
                        <div class="comparison-item">
                            <div class="icon-box"><Shield size={20} /></div>
                            <div class="comparison-content">
                                <strong>Stable Change IDs</strong>
                                <span>IDs survive rebases, amends, and rewrites. Agents never lose context.</span>
                            </div>
                        </div>
                        <div class="comparison-item">
                            <div class="icon-box"><Zap size={20} /></div>
                            <div class="comparison-content">
                                <strong>Automatic Rebase</strong>
                                <span>Edit any change in a stack and descendants intelligently rebase themselves.</span>
                            </div>
                        </div>
                        <div class="comparison-item">
                            <div class="icon-box"><Globe size={20} /></div>
                            <div class="comparison-content">
                                <strong>First-class Conflicts</strong>
                                <span>Conflicts are recorded, not blocking. Continue working while they are resolved asynchronously.</span>
                            </div>
                        </div>
                        <div class="comparison-item">
                            <div class="icon-box"><Star size={20} /></div>
                            <div class="comparison-content">
                                <strong>First-class Working Copy</strong>
                                <span>The working copy is just another revision. Never lose uncommitted work again.</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ---------- ROADMAP SECTION ---------- */}
                <section class="features-section mt-16">
                    <div class="section-header">
                        <h2 class="section-title">Coming Soon to JJHub</h2>
                        <p class="section-subtitle">We are shipping at the speed of thought. Here's a look at what is on our near-term roadmap.</p>
                    </div>

                    <div class="features-grid">
                        <div class="feature-card glass-panel group">
                            <div class="feature-icon-wrapper bg-gradient-blue">
                                <Layers size={24} class="text-white" />
                            </div>
                            <h3>Facade Monorepos</h3>
                            <p class="text-muted">
                                Combine distinct polyrepos into a facade monorepo to grant AI agents and CI environments singular unified context, while keeping individual projects approachable for external contributors.
                            </p>
                        </div>
                        <div class="feature-card glass-panel group">
                            <div class="feature-icon-wrapper bg-gradient-green">
                                <Laptop size={24} class="text-white" />
                            </div>
                            <h3>Local Workflows</h3>
                            <p class="text-muted">
                                Test, evaluate, and execute your TypeScript-defined `.jjhub/workflows` pipelines and AI interactions locally on your machine for the fastest possible development loop.
                            </p>
                        </div>
                        <div class="feature-card glass-panel group">
                            <div class="feature-icon-wrapper bg-gradient-purple">
                                <CheckCircle size={24} class="text-white" />
                            </div>
                            <h3>Programmable Gates</h3>
                            <p class="text-muted">
                                Create strict logic for repo contributions. E.g., instantly reject issues if an LLM verifies that a proper minimum reproduction wasn't provided.
                            </p>
                        </div>
                        <div class="feature-card glass-panel group">
                            <div class="feature-icon-wrapper bg-gradient-cyan">
                                <Bot size={24} class="text-white" />
                            </div>
                            <h3>24/7 Agents (Smithers)</h3>
                            <p class="text-muted">
                                First-class support for <a href="https://smithers.sh" target="_blank" rel="noopener noreferrer" class="text-blue hover:text-light transition-colors">Smithers</a>. Native integration for deploying autonomous, 24/7 running agents over your codebase.
                            </p>
                        </div>
                        <div class="feature-card glass-panel group md:col-span-2 lg:col-span-1">
                            <div class="feature-icon-wrapper bg-gradient-emerald">
                                <Banknote size={24} class="text-white" />
                            </div>
                            <h3>OSS Support Payments</h3>
                            <p class="text-muted">
                                Empower maintainers to gate feature requests and issues by direct payments, supporting the open-source project and covering AI inference costs.
                            </p>
                        </div>
                    </div>
                </section>

                {/* ---------- INTEGRATIONS SHOWCASE ---------- */}
                <section class="comparison-section glass-panel mt-16 mb-16 relative overflow-hidden">
                    <div class="comparison-header mb-8">
                        <h2>An Operating System for your Agents.</h2>
                        <p class="text-muted text-center max-w-2xl mx-auto mt-4">
                            Extend your workspace with an App Store for MCP Integrations and Agent Skills. Connect your existing tools instantly.
                        </p>
                    </div>

                    <div class="max-w-5xl mx-auto w-full px-6">
                        <div class="glass-panel integrations-window overflow-hidden rounded-xl border border-color">
                            <div class="mockup-header mockup-header-subtle">
                                <div class="mac-controls">
                                    <span class="mac-btn close"></span>
                                    <span class="mac-btn minimize"></span>
                                    <span class="mac-btn expand"></span>
                                </div>
                                <div class="mockup-title text-muted text-xs">jjhub.tech/integrations</div>
                            </div>
                            <img src="/ui/ui_internal_integrations_1772749798201.png" alt="JJHub Integrations & Skills Store" class="w-full h-auto block" />
                        </div>
                    </div>
                </section>

                {/* ---------- CTA SECTION ---------- */}
                <section class="cta-section relative overflow-hidden glass-panel">
                    <div class="cta-glow"></div>
                    <div class="cta-content z-10 relative">
                        <TerminalSquare size={48} class="mx-auto mb-6 text-primary drop-shadow-glow" />
                        <h2 class="text-4xl font-bold mb-4">Ready for the alpha?</h2>
                        <p class="text-muted text-lg mb-8 max-w-xl mx-auto">
                            We're onboarding early teams and open source projects. Join the waitlist to secure your spot.
                        </p>
                        <div class="cta-form-container mx-auto">
                            <WaitlistForm source="marketing" />
                        </div>
                    </div>
                </section>

                {/* ---------- FOOTER ---------- */}
                <footer class="marketing-footer">
                    <div class="footer-content">
                        <div class="footer-brand">
                            <TerminalSquare size={24} class="text-primary mr-2" />
                            <span class="font-bold text-lg">JJHub</span>
                        </div>
                        <div class="footer-links">
                            <a href="https://docs.jjhub.tech" target="_blank" rel="noopener noreferrer">Documentation</a>
                            <a href="/login">Sign In</a>
                            <a href="https://github.com/martinvonz/jj" target="_blank" rel="noopener noreferrer">About Jujutsu</a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
