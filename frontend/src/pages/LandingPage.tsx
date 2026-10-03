import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Zap, ShieldCheck, LineChart, Sparkles, BrainCircuit, Eye, 
  ArrowRight, CheckCircle2, Lock, Cpu, GraduationCap, Users
} from 'lucide-react';
import { Footer } from '../components/common/Footer';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-dark-bg text-slate-100 flex flex-col">
      {/* Hero Section */}
      <section className="relative pt-20 pb-24 px-6 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-600/15 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Generation AI Educational Analytics</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white font-heading leading-tight">
            Learn Smarter.<br />
            <span className="gradient-text">Understand Learning Deeper.</span>
          </h1>

          <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            LearnPulse AI combines privacy-first computer vision, machine learning topic difficulty estimation, and automated generative AI revision kits to revolutionize digital education.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/register" className="gradient-btn px-6 py-3 text-sm font-bold text-white rounded-xl flex items-center space-x-2 w-full sm:w-auto justify-center">
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/login" className="px-6 py-3 text-sm font-bold text-slate-200 glass-card hover:bg-dark-hover rounded-xl border border-dark-border w-full sm:w-auto text-center">
              Sign In to Portal
            </Link>
          </div>

          <div className="pt-8 flex items-center justify-center space-x-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" /> 100% In-Memory Processing</span>
            <span className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-brand-400" /> Zero Video Storage</span>
            <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4 text-purple-400" /> Local MediaPipe Mesh</span>
          </div>
        </div>
      </section>

      {/* Feature Cards Grid */}
      <section className="py-16 px-6 max-w-7xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white font-heading">Engineered for Academic Excellence</h2>
          <p className="text-slate-400 text-sm mt-2">Comprehensive suite of privacy-preserving tools for educators and students</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-2xl border border-dark-border space-y-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Privacy-First Engagement</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Extracts 468 MediaPipe 3D face mesh landmarks, eye aspect ratios (EAR), and head pose in browser RAM. Video is never saved or uploaded.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-dark-border space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Topic Difficulty Engine</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Random Forest ML model synthesizes visual focus metrics, quiz scores, replay frequency, and pause behavior to pinpoint hard topics.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-dark-border space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">AI Revision Generator</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Generates customized revision summaries, interactive flashcards, and targeted practice questions powered by Gemini & OpenAI.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Pipeline */}
      <section className="py-16 px-6 bg-dark-card/50 border-y border-dark-border">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <h2 className="text-2xl font-bold text-white font-heading">How LearnPulse AI Works</h2>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 glass-card rounded-xl border border-dark-border text-center space-y-2">
              <div className="text-xl font-bold text-brand-400">1</div>
              <div className="text-xs font-bold text-white">Watch</div>
              <div className="text-[10px] text-slate-400">Stream lecture videos with topic markers</div>
            </div>
            <div className="p-4 glass-card rounded-xl border border-dark-border text-center space-y-2">
              <div className="text-xl font-bold text-brand-400">2</div>
              <div className="text-xs font-bold text-white">Analyze</div>
              <div className="text-[10px] text-slate-400">In-memory CV tracks engagement signals</div>
            </div>
            <div className="p-4 glass-card rounded-xl border border-dark-border text-center space-y-2">
              <div className="text-xl font-bold text-brand-400">3</div>
              <div className="text-xs font-bold text-white">Understand</div>
              <div className="text-[10px] text-slate-400">ML engine grades topic difficulty</div>
            </div>
            <div className="p-4 glass-card rounded-xl border border-dark-border text-center space-y-2">
              <div className="text-xl font-bold text-brand-400">4</div>
              <div className="text-xs font-bold text-white">Personalize</div>
              <div className="text-[10px] text-slate-400">AI builds targeted revision kits</div>
            </div>
            <div className="p-4 glass-card rounded-xl border border-dark-border text-center space-y-2 col-span-2 md:col-span-1">
              <div className="text-xl font-bold text-brand-400">5</div>
              <div className="text-xs font-bold text-white">Improve</div>
              <div className="text-[10px] text-slate-400">Achieve higher quiz scores and mastery</div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
