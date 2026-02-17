import React, { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PublicHeader from '@/components/PublicHeader'
import { useAuth } from '@/contexts/AuthContext'
import { motion, useInView } from 'framer-motion'
import {
  Shield, ShieldCheck, BrainCircuit, Zap, Eye, Lock, ArrowRight,
  CheckCircle2, BarChart3, GitBranch, Cpu, ScanSearch,
  ChevronDown
} from 'lucide-react'

/* ── Variants ── */
const ease = [0.22, 1, 0.36, 1]

const fadeUp = {
  hidden: { opacity: 0, y: 60 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 1, delay: i * 0.12, ease },
  }),
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.85, y: 40 },
  visible: (i = 0) => ({
    opacity: 1, scale: 1, y: 0,
    transition: { duration: 0.8, delay: i * 0.08, ease },
  }),
}

const slideLeft = {
  hidden: { opacity: 0, x: 60 },
  visible: (i = 0) => ({
    opacity: 1, x: 0,
    transition: { duration: 0.9, delay: i * 0.1, ease },
  }),
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
}

/* ── Animated Section Card ── */
const SectionCard = ({ children, className = '', id }) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.15 })

  return (
    <section
      id={id}
      ref={ref}
      className={`snap-section relative min-h-[100dvh] flex items-center justify-center ${className}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 30 }}
        animate={isInView ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.96, y: 30 }}
        transition={{ duration: 0.9, ease }}
        className="w-full"
      >
        {children}
      </motion.div>
    </section>
  )
}

const Landing = () => {
  const navigate = useNavigate()
  const { loginDemo, isAuthenticated } = useAuth()

  const handleTryDemo = () => {
    loginDemo()
  }

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  return (
    <div className="snap-container w-full bg-background text-foreground">
      {/* Fixed header overlaying snap container */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <PublicHeader />
      </div>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="snap-section relative min-h-[100dvh] flex items-center justify-center overflow-hidden">
        {/* Animated orbs */}
        <div className="pointer-events-none absolute inset-0">
          <motion.div animate={{ x: [0, 50, 0], y: [0, -40, 0] }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute -top-52 -left-52 w-[700px] h-[700px] bg-blue-500/[0.07] dark:bg-blue-500/[0.15] rounded-full blur-[140px]" />
          <motion.div animate={{ x: [0, -45, 0], y: [0, 45, 0] }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
            className="absolute top-1/4 -right-40 w-[550px] h-[550px] bg-cyan-400/[0.06] dark:bg-cyan-400/[0.14] rounded-full blur-[130px]" />
          <motion.div animate={{ x: [0, 30, 0], y: [0, -25, 0] }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
            className="absolute bottom-1/4 left-1/3 w-[450px] h-[450px] bg-purple-500/[0.05] dark:bg-purple-500/[0.12] rounded-full blur-[130px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(100,140,255,0.05)_1px,transparent_1px)] dark:bg-[radial-gradient(circle,rgba(100,140,255,0.07)_1px,transparent_1px)] bg-[size:28px_28px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_70%)]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 text-center pt-16">
          {/* Badge */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}
            className="inline-flex items-center gap-2.5 px-5 py-2 mb-10 rounded-full border border-border bg-card/60 backdrop-blur-sm text-xs font-medium text-muted-foreground shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Powered by Amazon Nova AI
          </motion.div>

          {/* Heading */}
          <motion.h1 initial="hidden" animate="visible" variants={fadeUp} custom={1}
            className="text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem] font-extrabold tracking-tight leading-[1.05] mb-7">
            Cloud Security,
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-400 dark:from-blue-400 dark:via-cyan-300 dark:to-blue-300 bg-clip-text text-transparent">
              Reimagined
            </span>
          </motion.h1>

          <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={2}
            className="max-w-2xl mx-auto text-lg sm:text-xl text-muted-foreground leading-relaxed mb-12">
            Autonomous S3 bucket scanning, AI&#8209;powered compliance reasoning, and
            one&#8209;click remediation — all in a single platform.
          </motion.p>

          {/* CTAs */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}
            className="flex flex-wrap items-center justify-center gap-4 mb-16">
            <Link to="/signup">
              <button className="group relative px-9 py-4 rounded-2xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-xl shadow-blue-600/20 hover:shadow-blue-600/40 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] text-sm">
                Get Started Free
                <ArrowRight className="inline-block ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </Link>
            <button onClick={handleTryDemo}
              className="group px-9 py-4 rounded-2xl font-semibold border border-border hover:bg-card hover:border-blue-400/50 transition-all duration-300 hover:-translate-y-1 text-sm">
              Try Live Demo
              <ArrowRight className="inline-block ml-2 w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
            </button>
          </motion.div>

          {/* Trust */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4}
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground">
            {['SOC 2', 'GDPR', 'HIPAA', 'PCI-DSS', 'ISO 27001'].map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {s}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 font-medium">Scroll</span>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
            <ChevronDown className="w-4 h-4 text-muted-foreground/40" />
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════════════ PIPELINE ═══════════════ */}
      <SectionCard id="pipeline">
        <div className="max-w-6xl mx-auto px-6 w-full">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={stagger}
            className="text-center mb-16 lg:mb-20">
            <motion.p variants={fadeUp}
              className="text-sm font-semibold text-blue-500 uppercase tracking-[0.2em] mb-4">Pipeline</motion.p>
            <motion.h2 variants={fadeUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">Five Steps to Total Security</motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            {[
              { num: '01', icon: ScanSearch, title: 'Scan', desc: 'Auto-discover every bucket and its configuration in seconds.' },
              { num: '02', icon: BrainCircuit, title: 'Analyze', desc: 'Nova 2 Lite reasons across compliance frameworks.' },
              { num: '03', icon: BarChart3, title: 'Score', desc: 'Real-time risk scoring with severity breakdown.' },
              { num: '04', icon: Eye, title: 'Approve', desc: 'Human-in-the-loop review before any change.' },
              { num: '05', icon: Zap, title: 'Remediate', desc: 'Nova Act applies exact fixes automatically.' },
            ].map((step, i) => (
              <motion.div
                key={step.num}
                variants={scaleIn}
                custom={i}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group relative p-7 rounded-2xl border border-border bg-card/80 backdrop-blur-sm hover:border-blue-500/40 hover:shadow-2xl hover:shadow-blue-600/[0.08] transition-colors duration-500"
              >
                <span className="absolute top-4 right-5 text-[11px] font-bold text-muted-foreground/25 tracking-widest font-mono">{step.num}</span>
                <motion.div
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mb-5 shadow-lg shadow-blue-500/20"
                >
                  <step.icon className="w-5 h-5 text-white" />
                </motion.div>
                <h3 className="font-bold text-foreground mb-1.5 text-lg">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </SectionCard>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <SectionCard id="features">
        <div className="pointer-events-none absolute inset-0">
          <motion.div animate={{ x: [0, -25, 0], y: [0, 18, 0] }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
            className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-blue-500/[0.04] dark:bg-blue-500/[0.09] rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 w-full">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={stagger}
            className="text-center mb-16 lg:mb-20">
            <motion.p variants={fadeUp}
              className="text-sm font-semibold text-blue-500 uppercase tracking-[0.2em] mb-4">Features</motion.p>
            <motion.h2 variants={fadeUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5">Everything You Need</motion.h2>
            <motion.p variants={fadeUp}
              className="max-w-xl mx-auto text-muted-foreground text-lg">From detection to remediation, CloudGuard handles the entire security lifecycle.</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={stagger}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: ScanSearch, title: 'Intelligent Scanning', desc: 'Deep inspection of ACLs, bucket policies, encryption, versioning, logging and public access blocks.' },
              { icon: BrainCircuit, title: 'AI Reasoning', desc: 'Nova 2 Lite evaluates every finding against SOC 2, GDPR, HIPAA, and PCI-DSS simultaneously.' },
              { icon: Zap, title: 'Auto Remediation', desc: 'Generate and apply least-privilege fixes with a single click — powered by Nova Act.' },
              { icon: BarChart3, title: 'Risk Scoring', desc: 'Quantified 0-100 risk scores with per-finding severity and weighted impact analysis.' },
              { icon: GitBranch, title: 'Multi-Agent Pipeline', desc: 'Five specialized agents collaborate: Scanner, Reasoner, Scorer, Planner, and Executor.' },
              { icon: Lock, title: 'Approval Workflow', desc: 'Human-in-the-loop gating ensures no changes are applied without explicit approval.' },
            ].map((f, i) => (
              <motion.div
                key={i}
                variants={slideLeft}
                custom={i}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group relative p-7 rounded-2xl border border-border bg-card/80 backdrop-blur-sm hover:border-blue-500/30 hover:shadow-xl hover:shadow-blue-600/[0.06] transition-colors duration-500"
              >
                <motion.div
                  whileHover={{ scale: 1.12 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center mb-5 group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-cyan-400 group-hover:shadow-lg group-hover:shadow-blue-500/25 transition-all duration-500"
                >
                  <f.icon className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors duration-500" />
                </motion.div>
                <h3 className="font-bold text-foreground mb-2 text-lg">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </SectionCard>

      {/* ═══════════════ ARCHITECTURE ═══════════════ */}
      <SectionCard id="architecture">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-card/0 via-card/40 to-card/0" />
        <div className="relative max-w-6xl mx-auto px-6 w-full">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={stagger}
            className="text-center mb-16 lg:mb-20">
            <motion.p variants={fadeUp}
              className="text-sm font-semibold text-blue-500 uppercase tracking-[0.2em] mb-4">Architecture</motion.p>
            <motion.h2 variants={fadeUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5">Multi-Agent Intelligence</motion.h2>
            <motion.p variants={fadeUp}
              className="max-w-xl mx-auto text-muted-foreground text-lg">Five autonomous agents work in concert to secure your cloud.</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} variants={stagger}
            className="flex flex-col lg:flex-row gap-4">
            {[
              { icon: ScanSearch, name: 'Scanner Agent', desc: 'Fetches and normalizes bucket configs, policies, and metadata from AWS.' },
              { icon: Cpu, name: 'Compliance Reasoner', desc: 'Nova 2 Lite analyzes violations across multiple compliance frameworks.' },
              { icon: BarChart3, name: 'Risk Scorer', desc: 'Calculates weighted severity scores and prioritizes findings.' },
              { icon: BrainCircuit, name: 'Remediation Planner', desc: 'Generates minimal, safe IAM/S3 policy changes to fix issues.' },
              { icon: Zap, name: 'Execution Agent', desc: 'Nova Act applies approved fixes and verifies success.' },
            ].map((agent, i) => (
              <motion.div
                key={i}
                variants={scaleIn}
                custom={i}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group flex-1 relative p-7 rounded-2xl border border-border bg-card/80 backdrop-blur-sm hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-600/[0.06] transition-colors duration-500"
              >
                {i < 4 && <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-[2px] bg-gradient-to-r from-blue-500/40 to-transparent" />}
                <motion.div
                  whileHover={{ scale: 1.15, rotate: -5 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600/10 to-purple-600/10 dark:from-blue-600/20 dark:to-purple-600/20 flex items-center justify-center mb-4 group-hover:from-blue-600 group-hover:to-purple-600 group-hover:shadow-lg group-hover:shadow-purple-500/20 transition-all duration-500"
                >
                  <agent.icon className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors duration-500" />
                </motion.div>
                <h4 className="font-bold text-sm text-foreground mb-1.5">{agent.name}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{agent.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </SectionCard>

      {/* ═══════════════ CTA ═══════════════ */}
      <SectionCard id="cta" className="overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/[0.06] dark:bg-blue-500/[0.12] rounded-full blur-[140px]" />
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/[0.04] dark:bg-purple-500/[0.09] rounded-full blur-[110px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={stagger}>
            <motion.div variants={scaleIn} custom={0}
              className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-600/25">
              <ShieldCheck className="w-10 h-10 text-white" />
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5">Ready to Secure Your Cloud?</motion.h2>
            <motion.p variants={fadeUp} custom={2}
              className="text-muted-foreground text-lg mb-10 leading-relaxed">
              Join teams that trust CloudGuard to keep their S3 infrastructure safe, compliant, and audit&#8209;ready.
            </motion.p>
            <motion.div variants={fadeUp} custom={3}
              className="flex flex-wrap justify-center gap-4">
              <Link to="/signup">
                <button className="group px-10 py-4 rounded-2xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-xl shadow-blue-600/25 hover:shadow-blue-600/40 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] text-sm">
                  Start Free Trial
                  <ArrowRight className="inline-block ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </Link>
              <button onClick={handleTryDemo}
                className="group px-10 py-4 rounded-2xl font-semibold border border-border hover:bg-card hover:border-blue-400/50 transition-all duration-300 hover:-translate-y-1 text-sm">
                Try Live Demo
                <ArrowRight className="inline-block ml-2 w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
              </button>
            </motion.div>
          </motion.div>
        </div>
      </SectionCard>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="snap-section border-t border-border py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <div className="p-1 rounded-md bg-gradient-to-br from-blue-600 to-cyan-500">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-foreground">CloudGuard</span>
            <span className="text-muted-foreground/60">&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Docs</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing