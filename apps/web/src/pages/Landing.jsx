import React, { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PublicHeader from '@/components/PublicHeader'
import { useAuth } from '@/contexts/AuthContext'
import { motion, useInView } from 'framer-motion'
import {
  Shield, ShieldCheck, BrainCircuit, Zap, Eye, Lock, ArrowRight,
  CheckCircle2, BarChart3, GitBranch, Cpu, ScanSearch,
  ChevronDown, AlertTriangle, XCircle, Terminal, FileJson, Check,
  Clock, DollarSign
}
  from 'lucide-react'

/* ── Variants ── */
/* ── Variants ── */
const ease = [0.25, 0.1, 0.25, 1]

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 1, delay: i * 0.1, ease },
  }),
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, scale: 1, y: 0,
    transition: { duration: 0.8, delay: i * 0.05, ease },
  }),
}

const slideLeft = {
  hidden: { opacity: 0, x: 40 },
  visible: (i = 0) => ({
    opacity: 1, x: 0,
    transition: { duration: 0.8, delay: i * 0.05, ease },
  }),
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
}

/* ── Animated Section Card ── */
const SectionCard = ({ children, className = '', id }) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: false, amount: 0.15 })

  return (
    <section
      id={id}
      ref={ref}
      className={`snap-section relative min-h-[100dvh] w-full flex items-center justify-center py-16 sm:py-24 px-4 sm:px-6 md:px-8 overflow-y-auto sm:overflow-hidden ${className}`}
    >
      <motion.div
        variants={stagger}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className="w-full max-w-[1400px] mx-auto"
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
      {/* Fixed header overlaying container */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <PublicHeader />
      </div>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="snap-section relative min-h-[100dvh] flex items-center justify-center overflow-x-hidden overflow-y-auto sm:overflow-hidden pt-20 pb-12">
        {/* Animated orbs */}
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            animate={{
              x: [0, 100, 0],
              y: [0, -60, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-blue-600/20 blur-[120px] rounded-full mix-blend-screen"
          />
          <motion.div
            animate={{
              x: [0, -80, 0],
              y: [0, 90, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-1/3 -right-20 w-[500px] h-[500px] bg-cyan-500/15 blur-[100px] rounded-full mix-blend-screen"
          />
          <motion.div
            animate={{
              x: [0, 60, 0],
              y: [0, -50, 0],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute bottom-0 left-1/4 w-[600px] h-[400px] bg-purple-600/15 blur-[120px] rounded-full mix-blend-screen"
          />
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] dark:opacity-[0.05]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center pt-12 sm:pt-24 pb-12 sm:pb-24 z-10 w-full mt-0 sm:-mt-16">
          {/* Badge */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}
            className="inline-flex items-center gap-2 sm:gap-2.5 px-3 sm:px-5 py-1.5 sm:py-2 mb-4 sm:mb-8 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-[10px] sm:text-xs font-medium text-muted-foreground shadow-lg shadow-black/5 hover:bg-white/10 transition-colors cursor-default">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Powered by Amazon Nova AI
          </motion.div>

          {/* Heading */}
          <motion.h1 initial="hidden" animate="visible" variants={fadeUp} custom={1}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-black tracking-tight leading-[1.1] sm:leading-[1] mb-4 sm:mb-6 drop-shadow-sm">
            Cloud Security,
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-500 dark:from-blue-400 dark:via-cyan-300 dark:to-blue-400 bg-clip-text text-transparent pb-1 sm:pb-2 inline-block">
              Reimagined
            </span>
          </motion.h1>

          <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={2}
            className="max-w-2xl mx-auto text-sm sm:text-lg lg:text-xl text-muted-foreground/80 leading-relaxed mb-6 sm:mb-8 font-light px-2 sm:px-0">
            Autonomous S3, EC2, and IAM security scanning, AWS cost optimization, AI&#8209;powered compliance reasoning, and
            one&#8209;click remediation — all in a single platform.
          </motion.p>

          {/* CTAs */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 mb-10 sm:mb-12 w-full">
            <Link to="/signup" className="w-full sm:w-auto">
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="group relative px-8 py-3.5 sm:py-4 w-full sm:w-auto justify-center rounded-2xl font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 transition-all duration-300 text-sm overflow-hidden flex items-center"
              >
                <span className="relative z-10 flex items-center justify-center">
                  Get Started Free
                  <ArrowRight className="inline-block ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </motion.button>
            </Link>
            <motion.button
              onClick={handleTryDemo}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="group px-8 py-3.5 sm:py-4 w-full sm:w-auto flex items-center justify-center rounded-2xl font-bold border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-sm shadow-lg hover:shadow-xl"
            >
              Try Live Demo
              <ArrowRight className="inline-block ml-2 w-4 h-4 sm:opacity-0 sm:-translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-blue-400" />
            </motion.button>
          </motion.div>

          {/* Trust */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4}
            className="flex flex-wrap items-center justify-center gap-2 sm:gap-x-6 lg:gap-x-8 sm:gap-y-4 text-[10px] sm:text-xs font-medium text-muted-foreground/60 w-full mb-12 sm:mb-0">
            {['SOC 2', 'GDPR', 'HIPAA', 'PCI-DSS', 'ISO 27001'].map((s) => (
              <span key={s} className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/5 border border-white/5 whitespace-nowrap">
                <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" /> {s}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-4 sm:bottom-10 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 sm:gap-3">
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40 font-semibold">Scroll</span>
          <motion.div
            animate={{ y: [0, 10, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-5 h-8 rounded-full border border-muted-foreground/30 flex justify-center pt-2"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1 h-1 rounded-full bg-muted-foreground/60"
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════════════ THE PROBLEM ═══════════════ */}
      <SectionCard id="problem" className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 w-full">
          <motion.div variants={stagger} className="text-center mb-16">
            <motion.h2 variants={fadeUp}
              className="text-3xl sm:text-4xl lg:text-6xl font-bold tracking-tight mb-6">Why Cloud Security is Broken</motion.h2>
            <motion.p variants={fadeUp}
              className="max-w-2xl mx-auto text-muted-foreground text-lg sm:text-xl">
              Manual reviews can't keep up with the speed of cloud deployment. The result? Catastrophic exposure.
            </motion.p>
          </motion.div>

          <motion.div variants={stagger} className="grid md:grid-cols-3 gap-4 sm:gap-8">
            <motion.div variants={scaleIn} custom={0} className="p-6 sm:p-8 rounded-3xl bg-card/40 border border-white/10 backdrop-blur-md text-center hover:bg-card/60 transition-colors">
              <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-4 sm:mb-6">
                <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-red-500" />
              </div>
              <div className="text-3xl sm:text-5xl font-black text-foreground mb-1 sm:mb-2">93%</div>
              <div className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2 sm:mb-4">Misconfiguration</div>
              <p className="text-xs sm:text-base text-muted-foreground leading-relaxed">of cloud breaches are caused by simple misconfigurations, not advanced hacks.</p>
            </motion.div>
            <motion.div variants={scaleIn} custom={1} className="p-6 sm:p-8 rounded-3xl bg-card/40 border border-white/10 backdrop-blur-md text-center hover:bg-card/60 transition-colors">
              <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 sm:mb-6">
                <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-orange-500" />
              </div>
              <div className="text-3xl sm:text-5xl font-black text-foreground mb-1 sm:mb-2">200+ Days</div>
              <div className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2 sm:mb-4">Exposure Time</div>
              <p className="text-xs sm:text-base text-muted-foreground leading-relaxed">Average time it takes to detect a breach. By then, your data is long gone.</p>
            </motion.div>
            <motion.div variants={scaleIn} custom={2} className="p-6 sm:p-8 rounded-3xl bg-card/40 border border-white/10 backdrop-blur-md text-center hover:bg-card/60 transition-colors">
              <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 sm:mb-6">
                <DollarSign className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500" />
              </div>
              <div className="text-3xl sm:text-5xl font-black text-foreground mb-1 sm:mb-2">$4.45M</div>
              <div className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2 sm:mb-4">Avg Cost</div>
              <p className="text-xs sm:text-base text-muted-foreground leading-relaxed">The average cost of a data breach in 2024. Can your startup survive that?</p>
            </motion.div>
  
          </motion.div>
        </div>
      </SectionCard>

      {/* ═══════════════ PIPELINE ═══════════════ */}
      <SectionCard id="pipeline">
        <div className="max-w-6xl mx-auto px-6 w-full mt-10 sm:mt-0">
          <motion.div variants={stagger} className="text-center mb-10 lg:mb-20">
            <motion.p variants={fadeUp}
              className="text-xs sm:text-sm font-semibold text-blue-500 uppercase tracking-[0.2em] mb-2 sm:mb-4">Pipeline</motion.p>
            <motion.h2 variants={fadeUp}
              className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight">Five Steps to Total Security</motion.h2>
          </motion.div>

          <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            {[
              { num: '01', icon: ScanSearch, title: 'Scan', desc: 'Auto-discover S3, EC2, and IAM assets, security gaps, and idle resources.' },
              { num: '02', icon: BrainCircuit, title: 'Analyze', desc: 'Nova 2 Lite reasons across compliance and cost frameworks.' },
              { num: '03', icon: BarChart3, title: 'Score', desc: 'Real-time risk scoring and wasted cost calculations.' },
              { num: '04', icon: Eye, title: 'Approve', desc: 'Human-in-the-loop review before any modifications.' },
              { num: '05', icon: Zap, title: 'Remediate', desc: 'Nova applies security fixes, IAM policies, and resource cleanup.' },
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
          <motion.div variants={stagger} className="text-center mb-16 lg:mb-20">
            <motion.p variants={fadeUp}
              className="text-sm font-semibold text-blue-500 uppercase tracking-[0.2em] mb-4">Features</motion.p>
            <motion.h2 variants={fadeUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5">Everything You Need</motion.h2>
            <motion.p variants={fadeUp}
              className="max-w-xl mx-auto text-muted-foreground text-lg">From detection to remediation, CloudGuard handles the entire security lifecycle.</motion.p>
          </motion.div>

          <motion.div variants={stagger} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: ScanSearch, title: 'Intelligent Scanning', desc: 'Deep inspection of S3 buckets, EC2 instances, and IAM policies for security risks and compliance gaps.' },
              { icon: DollarSign, title: 'Cost Optimization', desc: 'Auto-detect idle AWS resources, unattached volumes, and forgotten instances to eliminate wasted cloud costs.' },
              { icon: BrainCircuit, title: 'AI Reasoning', desc: 'Nova evaluates findings against SOC 2, GDPR, HIPAA, and cost-efficiency best practices simultaneously.' },
              { icon: Zap, title: 'Auto Remediation', desc: 'Generate and apply least-privilege IAM policies, EC2 security group fixes, and cost-saving actions.' },
              { icon: BarChart3, title: 'Risk & Cost Scoring', desc: 'Quantified 0-100 risk scores alongside projected monthly savings and severity breakdown.' },
              { icon: Lock, title: 'Approval Workflow', desc: 'Human-in-the-loop gating ensures no changes are applied without your explicit approval.' },
            ].map((f, i) => (
              <motion.div
                key={i}
                variants={scaleIn}
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

      {/* ═══════════════ CODE COMPARISON ═══════════════ */}
      <SectionCard id="code-comparison" className="bg-black/20">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <motion.div variants={stagger} className="grid lg:grid-cols-2 gap-12 items-center">

            <div className="space-y-8">
              <motion.div variants={fadeUp}>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
                  Don't Just Find It. <br />
                  <span className="text-blue-500">Fix It.</span>
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Traditional tools give you a PDF report. <span className="text-foreground font-medium">CloudGuard gives you the code.</span>
                  <br /><br />
                  Our <span className="text-blue-400">Remediation Planner</span> generates precise, least-privilege IAM policies and EC2 security group rules to replace over-permissive configurations. Review the diff, approve with one click, and sleep soundly.
                </p>
              </motion.div>

              <motion.div variants={fadeUp} className="flex gap-4">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <XCircle className="w-4 h-4 text-red-500" />
                  </div>
                  <span>Blocks Public Access</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span>Enforces Encryption</span>
                </div>
              </motion.div>
            </div>

            <motion.div variants={scaleIn} className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-900/20 font-mono text-sm bg-[#0d1117]">
              <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20" />
                </div>
                <div className="flex gap-4 text-xs font-medium text-muted-foreground">
                  <span className="text-red-400">Current Policy</span>
                  <span className="text-emerald-400">Nova Generated</span>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-white/5">
                {/* Bad Code */}
                <div className="p-4 overflow-x-auto">
                  <pre className="text-red-300 opacity-70">
                    {`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": "*"
    }
  ]
}`}
                  </pre>
                  <div className="mt-4 flex items-center gap-2 text-xs text-red-400">
                    <AlertTriangle className="w-3 h-3" /> Critical Analysis: Public R/W
                  </div>
                </div>

                {/* Good Code */}
                <div className="p-4 bg-blue-500/5 overflow-x-auto relative">
                  <div className="absolute top-0 right-0 p-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-bl-lg">
                    RECOMMENDED
                  </div>
                  <pre className="text-blue-300">
                    {`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}`}
                  </pre>
                  <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
                    <Check className="w-3 h-3" /> Fix Applied: Enforce TLS & Least Privilege
                  </div>
                </div>
              </div>
            </motion.div>

          </motion.div>
        </div>
      </SectionCard>

      {/* ═══════════════ ARCHITECTURE ═══════════════ */}
      <SectionCard id="architecture">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-card/0 via-card/40 to-card/0" />
        <div className="relative max-w-6xl mx-auto px-6 w-full">
          <motion.div variants={stagger} className="text-center mb-16 lg:mb-20">
            <motion.p variants={fadeUp}
              className="text-sm font-semibold text-blue-500 uppercase tracking-[0.2em] mb-4">Architecture</motion.p>
            <motion.h2 variants={fadeUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5">Multi-Agent Intelligence</motion.h2>
            <motion.p variants={fadeUp}
              className="max-w-xl mx-auto text-muted-foreground text-lg">Five autonomous agents work in concert to secure your cloud.</motion.p>
          </motion.div>

          <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { icon: ScanSearch, name: 'Scanner Agent', desc: 'Fetches and normalizes infrastructure configs, policies, and utilization metrics from AWS.' },
              { icon: Cpu, name: 'Intelligence Reasoner', desc: 'Nova 2 Lite analyzes security violations and identifies cost optimization opportunities.' },
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

      {/* ═══════════════ FAQ ═══════════════ */}
      <SectionCard id="faq" className="border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 w-full">
          <motion.div variants={stagger}
            className="text-center mb-16">
            <motion.h2 variants={fadeUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6">Frequently Asked Questions</motion.h2>
          </motion.div>

          <div className="grid gap-6">
            {[
              { q: "Is it safe to let AI fix my infrastructure?", a: "Absolutely. CloudGuard uses a Human-in-the-Loop model. The AI proposes a remediation plan (Terraform/Policy JSON), but NOTHING is applied until a human approves it." },
              { q: "Does this work for production environments?", a: "Yes. Our Scanner Agent is read-only and non-intrusive. The Execution Agent only acts when you explicitly approve a fix." },
              { q: "What compliance frameworks do you support?", a: "Currently, we support SOC 2, HIPAA, GDPR, and PCI-DSS. The Compliance Reasoner (Nova 2 Lite) maps your config directly to these controls." }
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={slideLeft}
                className="group p-8 rounded-3xl bg-card/40 border border-white/10 backdrop-blur-md hover:bg-card/60 hover:border-blue-500/30 transition-all cursor-default"
              >
                <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-4">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 text-sm font-black shadow-inner shadow-blue-500/20">?</span>
                  {item.q}
                </h3>
                <p className="text-muted-foreground ml-12 text-lg leading-relaxed">{item.a}</p>
              </motion.div>
            ))}
          </div>
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
          <motion.div variants={stagger}>
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