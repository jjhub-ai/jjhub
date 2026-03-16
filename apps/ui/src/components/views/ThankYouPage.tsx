import { TerminalSquare, BookOpen, Send, Github, Twitter, MessageCircle, ArrowRight, Bot, Sparkles, Plus } from "lucide-solid";
import { A } from "@solidjs/router";
import "./MarketingLandingPage.css"; // Reuse marketing styles for consistency

export default function ThankYouPage() {
    return (
        <div class="marketing-page-wrapper min-h-screen relative overflow-x-hidden bg-[#03040b] flex flex-col">
            {/* Ambient Lighting */}
            <div class="ambient-layer absolute inset-0 pointer-events-none z-0">
                <div class="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] rounded-full bg-radial from-yellow-500/15 to-transparent blur-3xl opacity-50 animate-pulse"></div>
                <div class="absolute bottom-[-10%] left-[-5%] w-[900px] h-[900px] rounded-full bg-radial from-green-500/15 to-transparent blur-3xl opacity-50 animate-pulse delay-1000"></div>
                <div class="absolute top-[40%] left-[40%] w-[600px] h-[600px] rounded-full bg-radial from-emerald-500/10 to-transparent blur-3xl opacity-50 animate-pulse delay-2000"></div>
                <div class="grid-overlay opacity-30"></div>
            </div>

            <main class="relative z-10 w-full max-w-5xl px-6 py-20 md:py-32 flex flex-col items-center mx-auto my-auto">

                {/* Status Badge */}
                <div class="hero-badge animate-slide-up bg-white/5 border border-white/10 text-gray-300 mb-12 px-5 py-2 flex items-center gap-2.5 rounded-full backdrop-blur-md shadow-lg shadow-black/50">
                    <Sparkles size={16} class="text-yellow-400" />
                    <span class="text-sm font-semibold tracking-wide relative top-px">Access Request Received</span>
                </div>

                {/* Celebration Icon */}
                <div class="relative w-28 h-28 mb-10 perspective-1000 group animate-slide-up stagger-1 z-30">
                    <div class="absolute inset-0 bg-linear-to-tr from-yellow-500/30 to-green-500/30 rounded-3xl blur-2xl animate-pulse group-hover:blur-3xl transition-all duration-500"></div>
                    <div class="relative w-full h-full bg-[#111520] border border-white/20 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.8)] overflow-hidden animate-[bounce_4s_infinite] group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300">
                        <div class="absolute inset-0 bg-linear-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <TerminalSquare size={52} stroke-width={1.5} class="text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]" />
                    </div>
                </div>

                {/* Hero Typography */}
                <div class="text-center max-w-3xl mb-16 animate-slide-up stagger-2 z-20">
                    <h1 class="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-linear-to-b from-white to-white/70 mb-6 tracking-tight drop-shadow-sm pb-2">
                        You're on the list!
                    </h1>
                    <p class="text-xl md:text-2xl text-gray-400 leading-relaxed font-light mt-4">
                        Thank you for your interest in JJHub. We'll be in touch soon with access to the closed alpha. In the meantime, explore below.
                    </p>
                </div>

                {/* Cards Grid */}
                <div class="w-full flex flex-col gap-8 animate-slide-up stagger-3 z-20">

                    {/* Top Row: 2 Cards */}
                    <div class="grid md:grid-cols-2 gap-8 w-full">
                        {/* Docs Card */}
                        <a href="https://docs.jjhub.tech" target="_blank" rel="noopener noreferrer" class="group relative bg-[#111520]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-10 hover:bg-white/5 hover:border-yellow-500/50 hover:-translate-y-2 hover:shadow-[0_20px_60px_-15px_rgba(234,179,8,0.2)] transition-all duration-500 overflow-hidden text-decoration-none focus:outline-none focus:ring-2 focus:ring-yellow-500/50 flex flex-col h-full">
                            <div class="absolute top-0 right-0 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-yellow-500/30 group-hover:scale-150 transition-all duration-700 pointer-events-none"></div>

                            <div class="flex items-start justify-between mb-8 relative z-10 w-full">
                                <div class="w-16 h-16 shrink-0 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 flex items-center justify-center group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-yellow-500/20 transition-all duration-500 shadow-[0_0_20px_rgba(234,179,8,0.15)]">
                                    <BookOpen size={28} />
                                </div>
                                <div class="w-10 h-10 shrink-0 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-yellow-400 group-hover:bg-yellow-500/20 group-hover:rotate-45 transition-all duration-500">
                                    <ArrowRight size={20} class="-rotate-45" />
                                </div>
                            </div>

                            <div class="relative z-10 flex flex-col grow">
                                <h3 class="text-2xl font-bold text-white mb-3 group-hover:text-yellow-50 transition-colors duration-300">Documentation</h3>
                                <p class="text-lg text-gray-400 leading-relaxed font-light group-hover:text-gray-300 transition-colors duration-300">Master stacked changes, LRs, and programmable gates.</p>
                            </div>
                        </a>

                        {/* Smithers Card */}
                        <a href="https://smithers.sh" target="_blank" rel="noopener noreferrer" class="group relative bg-[#111520]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-10 hover:bg-white/5 hover:border-green-500/50 hover:-translate-y-2 hover:shadow-[0_20px_60px_-15px_rgba(34,197,94,0.3)] transition-all duration-500 overflow-hidden text-decoration-none focus:outline-none focus:ring-2 focus:ring-green-500/50 flex flex-col h-full">
                            <div class="absolute top-0 right-0 w-48 h-48 bg-green-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-green-500/30 group-hover:scale-150 transition-all duration-700 pointer-events-none"></div>

                            <div class="flex items-start justify-between mb-8 relative z-10 w-full">
                                <div class="w-16 h-16 shrink-0 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-500 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 group-hover:bg-green-500/20 transition-all duration-500 shadow-[0_0_20px_rgba(34,197,94,0.15)]">
                                    <Bot size={30} />
                                </div>
                                <div class="w-10 h-10 shrink-0 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-green-400 group-hover:bg-green-500/20 group-hover:rotate-45 transition-all duration-500">
                                    <ArrowRight size={20} class="-rotate-45" />
                                </div>
                            </div>

                            <div class="relative z-10 flex flex-col grow">
                                <h3 class="text-2xl font-bold text-white mb-3 group-hover:text-green-50 transition-colors duration-300">Try Smithers</h3>
                                <p class="text-lg text-gray-400 leading-relaxed font-light group-hover:text-gray-300 transition-colors duration-300">Try our JSX-based orchestration framework.</p>
                            </div>
                        </a>
                    </div>

                    {/* Contact Section - Full Width Card Below */}
                    <div class="w-full relative overflow-hidden rounded-3xl bg-[#111520]/80 backdrop-blur-2xl border border-white/10 p-8 md:p-12 text-left group hover:bg-white/5 hover:border-emerald-500/40 transition-all duration-500 hover:shadow-[0_20px_60px_-15px_rgba(16,185,129,0.2)]">
                        <div class="absolute bottom-0 left-0 w-full h-px bg-linear-to-r from-transparent via-emerald-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                        <div class="absolute top-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -ml-20 -mt-20 group-hover:bg-emerald-500/20 transition-all duration-700 pointer-events-none"></div>

                        <div class="relative z-10">
                            <div class="flex items-center gap-4 mb-4">
                                <div class="w-12 h-12 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.15)] group-hover:scale-110 transition-transform duration-500">
                                    <MessageCircle size={22} />
                                </div>
                                <h3 class="text-2xl font-bold text-white tracking-wide">Connect with the Founder</h3>
                            </div>

                            <p class="text-lg text-gray-400 font-light leading-relaxed mb-10 max-w-3xl">
                                I mean it. I would love to talk to you and learn more about what you are building and how I can help you.
                            </p>

                            <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                                <a href="mailto:willcory10@gmail.com" class="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-emerald-500/30 transition-all duration-300 group/link">
                                    <Send size={20} class="shrink-0 text-gray-500 group-hover/link:text-emerald-400 transition-colors duration-300" />
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Email</span>
                                        <span class="text-gray-300 text-sm font-medium group-hover/link:text-white transition-colors truncate w-full" title="willcory10@gmail.com">willcory10@gmail.com</span>
                                    </div>
                                </a>
                                <a href="https://x.com/fucory" target="_blank" rel="noopener noreferrer" class="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-blue-400/30 transition-all duration-300 group/link">
                                    <Twitter size={20} class="shrink-0 text-gray-500 group-hover/link:text-blue-400 transition-colors duration-300" />
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">X (Twitter)</span>
                                        <span class="text-gray-300 text-sm font-medium group-hover/link:text-white transition-colors truncate w-full" title="@fucory">@fucory</span>
                                    </div>
                                </a>
                                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-blue-500/30 transition-all duration-300 group/link cursor-default">
                                    <Plus size={20} class="shrink-0 text-gray-500 group-hover/link:text-blue-400 transition-colors duration-300 rotate-45" />
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Telegram</span>
                                        <span class="text-gray-300 text-sm font-medium group-hover/link:text-white transition-colors truncate w-full" title="@fucory">@fucory</span>
                                    </div>
                                </div>
                                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-indigo-500/30 transition-all duration-300 group/link cursor-default">
                                    <Plus size={20} class="shrink-0 text-gray-500 group-hover/link:text-indigo-400 transition-colors duration-300 rotate-45" />
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Discord</span>
                                        <span class="text-gray-300 text-sm font-medium group-hover/link:text-white transition-colors truncate w-full" title="@fucory">@fucory</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Link */}
                <div class="mt-16 animate-slide-up stagger-4 z-20">
                    <A href="/" class="group flex items-center gap-3 px-8 py-4 rounded-full bg-[#111520]/80 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/30 backdrop-blur-md">
                        <ArrowRight size={20} class="rotate-180 group-hover:-translate-x-1.5 transition-transform duration-300" />
                        <span class="text-base font-medium tracking-wide">Back to JJHub</span>
                    </A>
                </div>
            </main>
        </div>
    );
}
