import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Beaker, BrainCircuit, Check,
  ChevronRight, CircleHelp, Database, Download, FileJson, FileSpreadsheet, Gauge, Hash,
  Info, Layers3, LineChart, Menu, Network, PanelLeft, RefreshCw, Search,
  Send, Settings2, ShieldCheck, Sparkles, Table2, Target, Upload, X, Zap,
} from 'lucide-react';
import {
  useAnalyzeText, useGetAnalytics, useGetBenchmarks, useGetDashboard,
  useGetSignals, useHealthCheck, useUploadDataset,
} from '@workspace/api-client-react';
import type { Model } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();
const MODEL_VALUES = ['logistic-regression', 'naive-bayes', 'svm', 'vader', 'textblob'] as const;
const navItems = [
  { href: '/', label: 'Overview', icon: Gauge },
  { href: '/analyze', label: 'Analyze', icon: Search },
  { href: '/datasets', label: 'Datasets', icon: Database },
  { href: '/benchmarks', label: 'Benchmarks', icon: Target },
  { href: '/analytics', label: 'Analytics', icon: LineChart },
  { href: '/architecture', label: 'Architecture', icon: Network },
];

function cn(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(' '); }
function formatModel(model: string) { return model.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' '); }
function formatPct(value: number) { return `${(value <= 1 ? value * 100 : value).toFixed(1)}%`; }

function SentimentChip({ value }: { value?: string }) {
  return <span data-testid={`status-sentiment-${value ?? 'unknown'}`} className={cn('inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-[.12em]', value === 'positive' && 'bg-[#d9f2e9] text-[#14745f]', value === 'negative' && 'bg-[#f7dfda] text-[#ae4034]', value === 'neutral' && 'bg-[#e9e8df] text-[#5e625d]', !value && 'bg-muted text-muted-foreground')}>
    <span className={cn('h-1.5 w-1.5 rounded-full', value === 'positive' && 'bg-[#1d997b]', value === 'negative' && 'bg-[#c24c3f]', value === 'neutral' && 'bg-[#8b8d83]', !value && 'bg-muted-foreground')} />{value ?? 'pending'}
  </span>;
}

function Header({ title, eyebrow }: { title: string; eyebrow: string }) {
  const [, setLocation] = useLocation();
  return <header className="mb-7 flex items-start justify-between gap-4">
    <div>
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />{eyebrow}</div>
      <h1 className="text-3xl font-semibold tracking-[-.045em] text-foreground sm:text-[2.5rem]">{title}</h1>
    </div>
    <div className="hidden items-center gap-2 sm:flex">
      <button data-testid="button-command-search" onClick={() => setLocation('/analyze')} className="flex h-9 items-center gap-2 border border-border bg-card px-3 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-foreground"><Search size={14} /><span>Classify text</span><kbd className="ml-2 hidden border border-border px-1.5 py-0.5 font-mono text-[9px] lg:inline">⌘ K</kbd></button>
      <button data-testid="button-refresh-view" onClick={() => window.location.reload()} className="flex h-9 w-9 items-center justify-center border border-border bg-card text-muted-foreground transition-colors hover:text-accent" aria-label="Refresh view"><RefreshCw size={14} /></button>
    </div>
  </header>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setLocation('/analyze');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setLocation]);

  return <div className="noise min-h-[100dvh] bg-background">
    {mobileOpen && (
      <div
        className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
        onClick={() => setMobileOpen(false)}
      />
    )}
    <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-[246px] flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform duration-300 lg:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
      <div className="flex items-center justify-between px-2">
        <Link href="/" data-testid="link-brand" className="flex items-center gap-3">
          <span className="relative flex h-8 w-8 items-center justify-center bg-accent text-sidebar text-sm font-bold"><span className="absolute inset-[5px] border border-sidebar/40" /><ShieldCheck size={16} /></span>
          <span><span className="block text-[15px] font-semibold tracking-[-.04em] text-sidebar-foreground">SENTINEL</span><span className="block font-mono text-[9px] tracking-[.28em] text-sidebar-foreground/50">AI / INTELLIGENCE</span></span>
        </Link>
        <button data-testid="button-close-mobile-nav" onClick={() => setMobileOpen(false)} className="text-sidebar-foreground/50 lg:hidden"><X size={18} /></button>
      </div>
      <div className="my-8 flex items-center gap-2 px-2 font-mono text-[9px] uppercase tracking-[.17em] text-sidebar-foreground/40"><span className="h-px flex-1 bg-sidebar-border" />Workspace <span className="h-px flex-1 bg-sidebar-border" /></div>
      <nav className="space-y-1" aria-label="Primary navigation">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase()}`} onClick={() => setMobileOpen(false)} className={cn('group flex items-center gap-3 border-l-2 px-3 py-2.5 text-[13px] transition-colors', location === href ? 'border-sidebar-primary bg-sidebar-accent text-sidebar-foreground' : 'border-transparent text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground')}>
          <Icon size={16} strokeWidth={location === href ? 2.3 : 1.7} /><span>{label}</span>{location === href && <ChevronRight size={13} className="ml-auto text-sidebar-primary" />}
        </Link>)}
      </nav>
      <div className="mt-auto">
        <div className="mb-4 border border-sidebar-border bg-sidebar-accent/50 p-3">
          <div className="mb-2 flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-[.16em] text-sidebar-foreground/45">System status</span><span className="h-1.5 w-1.5 rounded-full bg-sidebar-primary" /></div>
          <div className="font-mono text-[11px] text-sidebar-foreground/80">All services nominal</div>
          <div className="mt-2 h-1 bg-sidebar-border"><div className="h-full w-[92%] bg-sidebar-primary" /></div>
        </div>
        <Link href="/architecture" data-testid="link-settings" className="flex items-center gap-3 px-3 py-2 text-xs text-sidebar-foreground/45 hover:text-sidebar-foreground"><Settings2 size={15} />Workspace details</Link>
        <div className="mt-5 flex items-center gap-2 border-t border-sidebar-border px-3 pt-4"><div className="flex h-7 w-7 items-center justify-center bg-sidebar-primary text-[11px] font-bold text-sidebar-primary-foreground">AR</div><div className="min-w-0"><div className="truncate text-xs text-sidebar-foreground">Analyst Room</div><div className="font-mono text-[9px] text-sidebar-foreground/40">RESEARCH / PROD</div></div><PanelLeft size={14} className="ml-auto text-sidebar-foreground/40" /></div>
      </div>
    </aside>
    <div className="lg:pl-[246px]">
      <div className="flex h-14 items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur-sm lg:hidden"><button data-testid="button-open-mobile-nav" onClick={() => setMobileOpen(true)} className="text-foreground"><Menu size={20} /></button><span className="font-mono text-[10px] tracking-[.2em]">SENTINEL / LIVE</span><Activity size={17} className="text-accent" /></div>
      <main className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  </div>;
}

function LoadingState({ label = 'Syncing intelligence' }: { label?: string }) {
  return <div data-testid="status-loading" className="space-y-3"><div className="h-5 w-40 animate-pulse bg-muted" /><div className="h-32 animate-pulse bg-muted/70" /><div className="h-24 animate-pulse bg-muted/50" /><div className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{label}...</div></div>;
}
function ErrorState({ onRetry, label = 'Signal unavailable' }: { onRetry: () => void; label?: string }) {
  return <div data-testid="status-error" className="flex flex-col items-center justify-center border border-destructive/30 bg-destructive/5 px-6 py-16 text-center"><div className="mb-3 flex h-9 w-9 items-center justify-center border border-destructive/40 text-destructive"><Info size={17} /></div><p className="mb-1 text-sm font-medium">{label}</p><p className="mb-4 text-xs text-muted-foreground">The source did not respond. Nothing has been inferred.</p><button data-testid="button-retry" onClick={onRetry} className="flex items-center gap-2 border border-border bg-card px-3 py-2 text-xs hover:border-accent"><RefreshCw size={13} />Retry connection</button></div>;
}

function Overview() {
  const dashboard = useGetDashboard();
  const signals = useGetSignals();
  if (dashboard.isLoading || signals.isLoading) return <LoadingState />;
  if (dashboard.isError) return <ErrorState onRetry={() => dashboard.refetch()} />;
  const d = dashboard.data;
  const trend = d?.trend ?? [];
  const counts = d?.counts;
  const maxTrend = Math.max(...trend.map((point) => point.positive + point.negative + point.neutral), 1);
  return <div className="animate-rise">
    <Header eyebrow="Live workspace / 01" title="Sentiment overview" />
    <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Sentiment health" value={`${d?.healthScore ?? 0}`} suffix="/100" note="Composite signal" accent="teal" icon={<Gauge size={16} />} />
      <MetricCard label="Analyzed today" value={(d?.analyzedToday ?? 0).toLocaleString()} note="Across connected sources" accent="amber" icon={<Activity size={16} />} />
      <MetricCard label="Positive share" value={formatPct(counts?.positivePct ?? 0)} note={`${(counts?.positive ?? 0).toLocaleString()} observations`} accent="teal" icon={<ArrowUpRight size={16} />} />
      <MetricCard label="Active models" value={`${d?.activeModels ?? 0}`} note="Evaluation-ready" accent="ink" icon={<BrainCircuit size={16} />} />
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.8fr)]">
      <section className="panel min-w-0 p-5 sm:p-6">
        <SectionHeading kicker="Movement / 7-day window" title="Conversation temperature" action="Explore analytics" href="/analytics" />
        <div className="mt-7 h-[230px] w-full">
          <svg viewBox="0 0 900 230" preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label="Sentiment movement chart" data-testid="chart-sentiment-trend">
            {[0, 1, 2, 3].map((line) => <line key={line} x1="0" y1={line * 58 + 8} x2="900" y2={line * 58 + 8} stroke="hsl(var(--border))" strokeDasharray="3 5" />)}
            <polyline fill="none" stroke="hsl(var(--chart-2))" strokeWidth="2.5" points={trend.map((p, i) => `${(i / Math.max(trend.length - 1, 1)) * 900},${220 - (p.negative / maxTrend) * 190}`).join(' ')} />
            <polyline fill="none" stroke="hsl(var(--chart-1))" strokeWidth="2.5" points={trend.map((p, i) => `${(i / Math.max(trend.length - 1, 1)) * 900},${220 - (p.positive / maxTrend) * 190}`).join(' ')} />
            <polyline fill="none" stroke="hsl(var(--chart-3))" strokeWidth="1.5" strokeDasharray="5 4" points={trend.map((p, i) => `${(i / Math.max(trend.length - 1, 1)) * 900},${220 - (p.neutral / maxTrend) * 190}`).join(' ')} />
          </svg>
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">{trend.map((p) => <span key={p.label} data-testid={`text-trend-label-${p.label}`}>{p.label}</span>)}</div>
        <div className="mt-6 flex flex-wrap gap-5 border-t border-border pt-4 font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground"><span><i className="mr-2 inline-block h-1.5 w-5 bg-chart-1" />Positive</span><span><i className="mr-2 inline-block h-1.5 w-5 bg-chart-2" />Negative</span><span><i className="mr-2 inline-block h-px w-5 bg-chart-3 align-middle" />Neutral</span></div>
      </section>
      <section className="panel p-5 sm:p-6">
        <SectionHeading kicker="Source distribution" title="Platform mix" />
        <div className="mt-7 space-y-5" data-testid="list-platform-mix">{(d?.platforms ?? []).map((platform) => {
          const total = platform.positive + platform.negative + platform.neutral;
          return <div key={platform.platform} data-testid={`row-platform-${platform.platform}`}>
            <div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium capitalize">{platform.platform}</span><span className="font-mono text-[10px] text-muted-foreground">{total.toLocaleString()} posts</span></div>
            <div className="flex h-2 overflow-hidden bg-muted"><div className="bg-chart-1" style={{ width: `${total ? (platform.positive / total) * 100 : 0}%` }} /><div className="bg-chart-3" style={{ width: `${total ? (platform.neutral / total) * 100 : 0}%` }} /><div className="bg-chart-2" style={{ width: `${total ? (platform.negative / total) * 100 : 0}%` }} /></div>
            <div className="mt-1 flex gap-3 font-mono text-[9px] text-muted-foreground"><span className="text-chart-1">+ {total ? Math.round((platform.positive / total) * 100) : 0}%</span><span className="text-chart-3">= {total ? Math.round((platform.neutral / total) * 100) : 0}%</span><span className="text-chart-2">− {total ? Math.round((platform.negative / total) * 100) : 0}%</span></div>
          </div>;
        })}</div>
      </section>
    </div>
    <section className="mt-5 panel p-5 sm:p-6">
      <SectionHeading kicker="Automated watch / last 24 hours" title="Recent signals" action="View analytics" href="/analytics" />
      <div className="mt-5 divide-y divide-border">{(signals.data ?? []).slice(0, 5).map((signal) => <SignalRow key={signal.id} signal={signal} />)}</div>
      {!signals.data?.length && <div data-testid="status-empty-signals" className="py-12 text-center text-sm text-muted-foreground">No signals have crossed the watch threshold yet.</div>}
    </section>
  </div>;
}

function MetricCard({ label, value, suffix, note, accent, icon }: { label: string; value: string; suffix?: string; note: string; accent: 'teal' | 'amber' | 'ink'; icon: ReactNode }) {
  return <div className="panel relative overflow-hidden p-5"><div className={cn('absolute left-0 top-0 h-1 w-12', accent === 'teal' && 'bg-accent', accent === 'amber' && 'bg-chart-3', accent === 'ink' && 'bg-primary')} /><div className="mb-7 flex items-center justify-between text-muted-foreground"><span className="font-mono text-[10px] uppercase tracking-[.14em]">{label}</span><span className={cn(accent === 'teal' && 'text-accent', accent === 'amber' && 'text-chart-3', accent === 'ink' && 'text-primary')}>{icon}</span></div><div data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`} className="metric-number text-3xl font-semibold">{value}<small className="ml-1 text-base font-normal text-muted-foreground">{suffix}</small></div><div className="mt-2 text-xs text-muted-foreground">{note}</div></div>;
}
function SectionHeading({ kicker, title, action, href }: { kicker: string; title: string; action?: string; href?: string }) {
  return <div className="flex items-end justify-between gap-3"><div><div className="mb-1 font-mono text-[9px] uppercase tracking-[.17em] text-muted-foreground">{kicker}</div><h2 className="text-lg font-semibold tracking-[-.03em]">{title}</h2></div>{action && href && <Link href={href} data-testid={`link-${action.toLowerCase().replaceAll(' ', '-')}`} className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[.1em] text-accent hover:underline">{action}<ChevronRight size={13} /></Link>}</div>;
}
function SignalRow({ signal }: { signal: { id: string; type: string; title: string; detail: string; platform: string; sentiment: string; time: string; severity: string } }) {
  return <div data-testid={`row-signal-${signal.id}`} className="grid gap-3 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"><div className={cn('hidden h-8 w-8 items-center justify-center border sm:flex', signal.severity === 'high' ? 'border-destructive/35 text-destructive' : signal.severity === 'medium' ? 'border-chart-3/50 text-chart-3' : 'border-border text-muted-foreground')}><Zap size={14} /></div><div><div className="mb-1 flex flex-wrap items-center gap-2"><span className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">{signal.type} / {signal.platform}</span><SentimentChip value={signal.sentiment} /></div><div className="text-sm font-medium">{signal.title}</div><div className="mt-1 text-xs text-muted-foreground">{signal.detail}</div></div><div className="font-mono text-[10px] text-muted-foreground sm:text-right">{signal.time}</div></div>;
}

const SAMPLES = [
  { label: 'Positive Review', text: 'This app is extraordinarily fast, beautifully designed, and very reliable! Highly recommended.' },
  { label: 'Critical Issue', text: 'Horrible update! Constantly crashes on startup, endless loading bugs, and unresponsive customer support.' },
  { label: 'Mixed Signals', text: 'Clean and elegant user interface, but the latency is noticeable and checkout is somewhat sluggish.' },
  { label: 'Neutral Update', text: 'The engineering team released software version 3.2.0 across all regions today.' },
];

function Analyze() {
  const [text, setText] = useState('');
  const [model, setModel] = useState<Model>('logistic-regression');
  const [result, setResult] = useState<Awaited<ReturnType<typeof import('@workspace/api-client-react').analyzeText>> | null>(null);
  const mutation = useAnalyzeText();
  const submit = (event: FormEvent) => { event.preventDefault(); if (!text.trim()) return; mutation.mutate({ data: { text: text.trim(), model } }, { onSuccess: (data) => setResult(data) }); };
  return <div className="animate-rise">
    <Header eyebrow="Classifier / single observation" title="Analyze a text" />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="panel p-5 sm:p-7">
        <div className="mb-6 flex items-center justify-between border-b border-border pb-4"><div><div className="font-mono text-[9px] uppercase tracking-[.17em] text-accent">Inference console</div><div className="mt-1 text-sm font-medium">One post. Five lenses.</div></div><span className="font-mono text-[10px] text-muted-foreground">UTF-8 / max 10,000 chars</span></div>
        <form onSubmit={submit}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="analysis-text" className="block font-mono text-[10px] uppercase tracking-[.13em] text-muted-foreground">Source text</label>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">Try example:</span>
              {SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  data-testid={`button-sample-${s.label.toLowerCase().replace(' ', '-')}`}
                  onClick={() => setText(s.text)}
                  className="border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <textarea id="analysis-text" data-testid="input-analysis-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste a social post, review, or transcript excerpt..." maxLength={10000} className="min-h-[230px] w-full resize-y border border-border bg-background p-4 text-sm leading-7 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-accent focus:ring-1 focus:ring-accent/30" />
          <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground"><span>{text.length.toLocaleString()} / 10,000</span><span>Plain text input</span></div>
          <div className="mt-7 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"><div><label htmlFor="analysis-model" className="mb-2 block font-mono text-[10px] uppercase tracking-[.13em] text-muted-foreground">Classification model</label><select id="analysis-model" data-testid="select-analysis-model" value={model} onChange={(event) => setModel(event.target.value as Model)} className="h-11 w-full appearance-none border border-border bg-background px-3 text-sm outline-none focus:border-accent sm:min-w-[280px]">{MODEL_VALUES.map((value) => <option key={value} value={value}>{formatModel(value)}</option>)}</select></div><button type="submit" data-testid="button-run-analysis" disabled={mutation.isPending || !text.trim()} className="flex h-11 items-center justify-center gap-2 bg-primary px-5 text-xs font-medium text-primary-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">{mutation.isPending ? <><RefreshCw size={14} className="animate-spin" />Running model</> : <><Send size={14} />Classify text</>}</button></div>
        </form>
        {mutation.isError && <div data-testid="status-analysis-error" className="mt-5 border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">Classification failed. Check the API connection and try again.</div>}
      </section>
      <section className="panel sentinel-grid p-5 sm:p-6">
        <SectionHeading kicker="Output / interpreted" title="Classification result" />
        {!result && <div data-testid="status-empty-analysis" className="flex min-h-[355px] flex-col items-center justify-center text-center"><div className="mb-5 flex h-14 w-14 items-center justify-center border border-dashed border-border text-muted-foreground"><Sparkles size={22} /></div><p className="max-w-[220px] text-sm text-muted-foreground">Run an observation to see sentiment, confidence, polarity, and the model's reasoning.</p></div>}
        {result && <div className="animate-rise">
          <div className="mt-7 flex items-end justify-between border-b border-border pb-5"><div><div className="mb-3 font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">Predicted sentiment</div><SentimentChip value={result.sentiment} /></div><div className="text-right"><div className="metric-number text-4xl font-semibold">{formatPct(result.confidence)}</div><div className="font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">confidence</div></div></div>
          <div className="grid grid-cols-2 gap-4 border-b border-border py-5"><div><div className="mb-1 font-mono text-[9px] uppercase text-muted-foreground">Polarity</div><div data-testid="text-analysis-polarity" className="metric-number text-xl">{result.polarity > 0 ? '+' : ''}{result.polarity.toFixed(3)}</div></div><div><div className="mb-1 font-mono text-[9px] uppercase text-muted-foreground">Model</div><div data-testid="text-analysis-model" className="text-sm font-medium">{formatModel(result.model)}</div></div></div>
          <div className="py-5"><div className="mb-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground"><Hash size={12} />Keyword signals</div><div className="flex flex-wrap gap-2">{result.keywords.map((keyword) => <span key={keyword.word} data-testid={`tag-keyword-${keyword.word}`} className="border border-border bg-card px-2 py-1 font-mono text-[10px]">#{keyword.word} <b className="text-accent">{keyword.count}</b></span>)}</div></div>
          <div className="border-l-2 border-accent bg-accent/5 p-3 text-xs leading-5 text-muted-foreground"><span className="mb-1 block font-mono text-[9px] uppercase tracking-[.13em] text-accent">Explanation</span>{result.explanation}</div>
        </div>}
      </section>
    </div>
  </div>;
}

function SentimentDistributionChart({
  summary,
  filter,
  onSelectFilter,
}: {
  summary: {
    total: number;
    positive: number;
    negative: number;
    neutral: number;
    positivePct: number;
    negativePct: number;
    neutralPct: number;
  };
  filter: 'all' | 'positive' | 'negative' | 'neutral';
  onSelectFilter: (filter: 'all' | 'positive' | 'negative' | 'neutral') => void;
}) {
  const total = Math.max(summary.total, 1);
  const radius = 56;
  const circ = 2 * Math.PI * radius;
  const posStroke = (summary.positive / total) * circ;
  const neuStroke = (summary.neutral / total) * circ;
  const negStroke = (summary.negative / total) * circ;
  const maxCount = Math.max(summary.positive, summary.neutral, summary.negative, 1);

  return (
    <div data-testid="module-sentiment-distribution-chart" className="mt-5 space-y-4 rounded border border-border bg-card/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[.18em] text-accent">Pictorial representation</div>
          <h3 className="text-base font-semibold">Dataset Sentiment Breakdown</h3>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className="text-muted-foreground">Filter comments:</span>
          {(['all', 'positive', 'neutral', 'negative'] as const).map((key) => (
            <button
              key={key}
              type="button"
              data-testid={`button-filter-${key}`}
              onClick={() => onSelectFilter(key)}
              className={cn(
                'rounded border px-2 py-0.5 uppercase transition-colors',
                filter === key
                  ? 'border-accent bg-accent text-accent-foreground font-semibold'
                  : 'border-border bg-background text-muted-foreground hover:border-accent hover:text-foreground'
              )}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards for Positive, Neutral, Negative */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div
          data-testid="card-positive-comments"
          onClick={() => onSelectFilter(filter === 'positive' ? 'all' : 'positive')}
          className={cn(
            'cursor-pointer rounded border p-3.5 transition-all',
            filter === 'positive' ? 'border-chart-1 bg-chart-1/10 shadow-sm' : 'border-border bg-background hover:border-chart-1/60'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[.12em] text-chart-1 font-semibold">Positive comments</span>
            <span className="h-2 w-2 rounded-full bg-chart-1" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span data-testid="metric-positive-count" className="metric-number text-2xl font-bold text-chart-1">{summary.positive}</span>
            <span className="font-mono text-xs text-muted-foreground">{formatPct(summary.positivePct)}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-chart-1" style={{ width: `${summary.positivePct}%` }} />
          </div>
        </div>

        <div
          data-testid="card-neutral-comments"
          onClick={() => onSelectFilter(filter === 'neutral' ? 'all' : 'neutral')}
          className={cn(
            'cursor-pointer rounded border p-3.5 transition-all',
            filter === 'neutral' ? 'border-chart-3 bg-chart-3/10 shadow-sm' : 'border-border bg-background hover:border-chart-3/60'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[.12em] text-chart-3 font-semibold">Neutral comments</span>
            <span className="h-2 w-2 rounded-full bg-chart-3" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span data-testid="metric-neutral-count" className="metric-number text-2xl font-bold text-chart-3">{summary.neutral}</span>
            <span className="font-mono text-xs text-muted-foreground">{formatPct(summary.neutralPct)}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-chart-3" style={{ width: `${summary.neutralPct}%` }} />
          </div>
        </div>

        <div
          data-testid="card-negative-comments"
          onClick={() => onSelectFilter(filter === 'negative' ? 'all' : 'negative')}
          className={cn(
            'cursor-pointer rounded border p-3.5 transition-all',
            filter === 'negative' ? 'border-chart-2 bg-chart-2/10 shadow-sm' : 'border-border bg-background hover:border-chart-2/60'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[.12em] text-chart-2 font-semibold">Negative comments</span>
            <span className="h-2 w-2 rounded-full bg-chart-2" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span data-testid="metric-negative-count" className="metric-number text-2xl font-bold text-chart-2">{summary.negative}</span>
            <span className="font-mono text-xs text-muted-foreground">{formatPct(summary.negativePct)}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-chart-2" style={{ width: `${summary.negativePct}%` }} />
          </div>
        </div>
      </div>

      {/* Pictorial Chart Grid: Donut Ring + Comparative Bars */}
      <div className="grid grid-cols-1 items-center gap-6 rounded border border-border bg-background p-4 md:grid-cols-[160px_1fr]">
        {/* Donut Chart */}
        <div className="relative mx-auto flex h-[150px] w-[150px] items-center justify-center">
          <svg viewBox="0 0 150 150" className="h-full w-full -rotate-90">
            {/* Background Ring */}
            <circle cx="75" cy="75" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="15" />
            {/* Positive Segment */}
            {posStroke > 0 && (
              <circle
                cx="75"
                cy="75"
                r={radius}
                fill="none"
                stroke="hsl(var(--chart-1))"
                strokeWidth="15"
                strokeDasharray={`${posStroke} ${circ - posStroke}`}
                strokeDashoffset={0}
              />
            )}
            {/* Neutral Segment */}
            {neuStroke > 0 && (
              <circle
                cx="75"
                cy="75"
                r={radius}
                fill="none"
                stroke="hsl(var(--chart-3))"
                strokeWidth="15"
                strokeDasharray={`${neuStroke} ${circ - neuStroke}`}
                strokeDashoffset={-posStroke}
              />
            )}
            {/* Negative Segment */}
            {negStroke > 0 && (
              <circle
                cx="75"
                cy="75"
                r={radius}
                fill="none"
                stroke="hsl(var(--chart-2))"
                strokeWidth="15"
                strokeDasharray={`${negStroke} ${circ - negStroke}`}
                strokeDashoffset={-(posStroke + neuStroke)}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="metric-number text-2xl font-bold">{summary.total}</span>
            <span className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">Comments</span>
          </div>
        </div>

        {/* Comparative Volume Bars */}
        <div className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">Volume comparison</div>

          {/* Positive Bar */}
          <div>
            <div className="mb-1 flex justify-between text-xs font-medium">
              <span className="flex items-center gap-1.5 text-chart-1 font-semibold">
                <span className="h-2 w-2 rounded-full bg-chart-1" />
                Positive
              </span>
              <span className="font-mono text-muted-foreground">{summary.positive} comments ({formatPct(summary.positivePct)})</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded bg-muted/60">
              <div
                className="h-full bg-chart-1 transition-all duration-500"
                style={{ width: `${(summary.positive / maxCount) * 100}%` }}
              />
            </div>
          </div>

          {/* Neutral Bar */}
          <div>
            <div className="mb-1 flex justify-between text-xs font-medium">
              <span className="flex items-center gap-1.5 text-chart-3 font-semibold">
                <span className="h-2 w-2 rounded-full bg-chart-3" />
                Neutral
              </span>
              <span className="font-mono text-muted-foreground">{summary.neutral} comments ({formatPct(summary.neutralPct)})</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded bg-muted/60">
              <div
                className="h-full bg-chart-3 transition-all duration-500"
                style={{ width: `${(summary.neutral / maxCount) * 100}%` }}
              />
            </div>
          </div>

          {/* Negative Bar */}
          <div>
            <div className="mb-1 flex justify-between text-xs font-medium">
              <span className="flex items-center gap-1.5 text-chart-2 font-semibold">
                <span className="h-2 w-2 rounded-full bg-chart-2" />
                Negative
              </span>
              <span className="font-mono text-muted-foreground">{summary.negative} comments ({formatPct(summary.negativePct)})</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded bg-muted/60">
              <div
                className="h-full bg-chart-2 transition-all duration-500"
                style={{ width: `${(summary.negative / maxCount) * 100}%` }}
              />
            </div>
          </div>

          {/* Proportional Ribbon */}
          <div className="pt-1">
            <div className="mb-1 flex justify-between font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground">
              <span>Proportional distribution ribbon</span>
              <span>100% total</span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded bg-muted">
              <div className="bg-chart-1 transition-all" style={{ width: `${summary.positivePct}%` }} title={`Positive: ${summary.positivePct}%`} />
              <div className="bg-chart-3 transition-all" style={{ width: `${summary.neutralPct}%` }} title={`Neutral: ${summary.neutralPct}%`} />
              <div className="bg-chart-2 transition-all" style={{ width: `${summary.negativePct}%` }} title={`Negative: ${summary.negativePct}%`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Datasets() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState('');
  const [datasetModel, setDatasetModel] = useState<Model>('logistic-regression');
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');
  const upload = useUploadDataset();
  const onFile = (nextFile?: File) => {
    if (!nextFile) return;
    setFile(nextFile);
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? '');
      setContent(nextFile.name.toLowerCase().endsWith('.xlsx') ? (value.split(',')[1] ?? value) : value);
    };
    if (nextFile.name.toLowerCase().endsWith('.xlsx')) reader.readAsDataURL(nextFile);
    else reader.readAsText(nextFile);
  };
  const loadSampleDataset = () => {
    const sampleCsv = `text,platform
"The new interface is extraordinarily fast, clean, and intuitive to navigate.",Twitter
"ABSOLUTELY PHENOMENAL! This is by far the best update they have ever shipped!!!",Instagram
"Customer support resolved my ticket within five minutes, extremely helpful and friendly.",Facebook
"Solid, reliable performance every single day. Highly recommend this tool to all developers.",LinkedIn
"Super impressed with how smooth and responsive the charts feel on mobile.",YouTube
"A true masterpiece of design, flawless typography and delightful interactions.",Twitter
"Setup was quick and painless, worked out of the box in under two minutes.",Reddit
"Cannot recommend this product enough, five-star experience from beginning to end!",Facebook
"Loving the dark mode theme, elegant color palette and crystal clear contrast.",Instagram
"The export feature is a huge win for our workflow, saved us countless hours.",LinkedIn
"App crashed three times today during checkout, completely lost my shopping cart.",Twitter
"HORRIBLE UPDATE! Everything is lagging, broken, and practically unusable right now!!",Reddit
"Extremely disappointed with the customer service, waited two weeks for no resolution.",Facebook
"The software is definitely not good, slow performance and constant memory leaks.",Twitter
"Cannot recommend this service, total waste of money and full of annoying bugs.",LinkedIn
"Terrible delay on order shipment, support was totally useless and unhelpful.",Instagram
"Constant glitches after the latest patch, screen freezes whenever I click export.",YouTube
"Awful user experience, confusing menus and broken search functionality.",Twitter
"The new build is full of errors and broke our continuous integration pipeline completely.",LinkedIn
"Worst purchase I made this year, defective hardware and zero refund support.",YouTube
"Version 3.4.1 has been published to npm and docker hub registries today.",Twitter
"Scheduled server maintenance will commence at 02:00 UTC on Sunday morning.",LinkedIn
"The conference will take place in San Francisco from October 12 to 14.",Twitter
"The annual quarterly earnings report is scheduled for release next Tuesday.",Facebook
"Documentation has been translated into Spanish, French, and Japanese languages.",Reddit
"Database migration script created tables for user accounts and audit logs.",LinkedIn
"The shipment tracking number was sent to your registered email address.",Instagram
"Standard parcel delivery arrived via postal service at 3:15 PM today.",Facebook
"Our support center operating hours are Monday through Friday, 9am to 6pm EST.",YouTube
"The device includes a USB-C charging cable and basic quick-start reference guide.",Reddit`;
    const blob = new Blob([sampleCsv], { type: 'text/csv' });
    const sampleFile = new File([blob], 'social_sentiment_sample_30.csv', { type: 'text/csv' });
    setFile(sampleFile);
    setContent(sampleCsv);
  };
  const submit = () => {
    if (!file || !content) return;
    upload.mutate({
      data: {
        fileName: file.name,
        fileType: file.type || file.name.split('.').pop() || 'text/csv',
        content,
        ...({ model: datasetModel } as any),
      },
    });
  };
  const result = upload.data;

  const exportCsv = () => {
    if (!result || !result.rows.length) return;
    const header = 'id,text,platform,sentiment,confidence\n';
    const csvBody = result.rows.map((r) => `"${r.id}","${r.text.replace(/"/g, '""')}","${r.platform}","${r.sentiment}",${r.confidence}`).join('\n');
    const blob = new Blob([header + csvBody], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classified_${result.fileName || 'dataset'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredRows = (result?.rows ?? []).filter(
    (row) => filter === 'all' || row.sentiment === filter
  );

  return <div className="animate-rise">
    <Header eyebrow="Corpus management / batch inference" title="Datasets" />
    <div className="grid gap-5 xl:grid-cols-[370px_minmax(0,1fr)]">
      <section className="panel p-5 sm:p-6">
        <div className="mb-5"><div className="font-mono text-[9px] uppercase tracking-[.17em] text-accent">New corpus</div><h2 className="mt-1 text-lg font-semibold">Upload a dataset</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">Bring a labeled or unlabeled export into the workspace. We classify the text column and return a reviewable sample.</p></div>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.json,text/csv,application/json" className="hidden" data-testid="input-dataset-file" onChange={(event) => onFile(event.target.files?.[0])} />
        <button data-testid="button-select-dataset" onClick={() => inputRef.current?.click()} className="flex min-h-[170px] w-full flex-col items-center justify-center border border-dashed border-border bg-background px-4 text-center transition-colors hover:border-accent hover:bg-accent/5"><Upload size={22} className="mb-3 text-accent" /><span className="text-sm font-medium">{file ? file.name : 'Select a file to inspect'}</span><span className="mt-2 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">CSV · XLSX · JSON</span></button>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" data-testid="button-load-sample-dataset" onClick={loadSampleDataset} className="text-[11px] font-mono text-accent hover:underline">
            + Load 30-comment sample dataset
          </button>
          {file && <button data-testid="button-remove-dataset" onClick={() => { setFile(null); setContent(''); }} className="text-xs text-muted-foreground hover:text-destructive">Clear file</button>}
        </div>
        {file && <div className="mt-3 flex items-center gap-3 border border-border bg-muted/40 p-3"><div className="flex h-8 w-8 items-center justify-center bg-card text-accent">{file.name.endsWith('.json') ? <FileJson size={16} /> : <FileSpreadsheet size={16} />}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{file.name}</div><div className="font-mono text-[9px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div></div><button data-testid="button-remove-dataset-x" onClick={() => { setFile(null); setContent(''); }} className="text-muted-foreground hover:text-destructive" aria-label="Remove dataset"><X size={15} /></button></div>}
        <div className="mt-4">
          <label htmlFor="dataset-model" className="mb-2 block font-mono text-[10px] uppercase tracking-[.13em] text-muted-foreground">Classification algorithm</label>
          <select id="dataset-model" data-testid="select-dataset-model" value={datasetModel} onChange={(e) => setDatasetModel(e.target.value as Model)} className="h-10 w-full appearance-none border border-border bg-background px-3 text-xs outline-none focus:border-accent">
            {MODEL_VALUES.map((value) => <option key={value} value={value}>{formatModel(value)}</option>)}
          </select>
        </div>
        <button data-testid="button-upload-dataset" onClick={submit} disabled={!file || !content || upload.isPending} className="mt-5 flex h-11 w-full items-center justify-center gap-2 bg-primary text-xs text-primary-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40">{upload.isPending ? <><RefreshCw size={14} className="animate-spin" />Processing rows</> : <><Zap size={14} />Classify dataset</>}</button>
        {upload.isError && <div data-testid="status-upload-error" className="mt-4 border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">The dataset could not be processed. Confirm the file format and try again.</div>}
      </section>
      <section className="panel min-w-0 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <SectionHeading kicker="Preview / returned sample" title={result ? result.fileName : 'Awaiting a corpus'} />
          {result && (
            <button
              type="button"
              data-testid="button-export-dataset"
              onClick={exportCsv}
              className="flex items-center gap-1.5 border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          )}
        </div>
        {!result && <div data-testid="status-empty-dataset" className="flex min-h-[360px] flex-col items-center justify-center border border-dashed border-border bg-background/40 text-center"><Table2 size={24} className="mb-4 text-muted-foreground" /><p className="text-sm font-medium">No dataset loaded</p><p className="mt-2 max-w-[250px] text-xs leading-5 text-muted-foreground">Your classified rows and sentiment distribution will appear here after processing.</p></div>}
        {result && <div className="animate-rise">
          {/* Pictorial Representation Module */}
          <SentimentDistributionChart
            summary={result.summary}
            filter={filter}
            onSelectFilter={setFilter}
          />

          {/* Table Header with Active Filter Info */}
          <div className="mb-3 mt-6 flex items-center justify-between border-t border-border pt-4">
            <div className="text-xs text-muted-foreground">
              Showing <b className="text-foreground">{filteredRows.length}</b> of {result.totalRows} observations
              {filter !== 'all' && (
                <span className="ml-2 inline-flex items-center gap-1 rounded bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">
                  Filtered: {filter}
                  <button type="button" onClick={() => setFilter('all')} className="ml-1 hover:text-foreground">✕</button>
                </span>
              )}
            </div>
            {filter !== 'all' && (
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="text-[11px] font-mono text-muted-foreground hover:text-accent"
              >
                Reset to all
              </button>
            )}
          </div>

          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[610px] text-left">
              <thead>
                <tr className="border-b border-border font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">
                  <th className="pb-3 pr-4">Text sample</th>
                  <th className="pb-3 pr-4">Platform</th>
                  <th className="pb-3 pr-4">Sentiment</th>
                  <th className="pb-3 text-right">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRows.map((row) => (
                  <tr key={row.id} data-testid={`row-dataset-${row.id}`} className="text-xs">
                    <td className="max-w-[340px] truncate py-3 pr-4">{row.text}</td>
                    <td className="py-3 pr-4 capitalize text-muted-foreground">{row.platform}</td>
                    <td className="py-3 pr-4"><SentimentChip value={row.sentiment} /></td>
                    <td className="metric-number py-3 text-right">{formatPct(row.confidence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>}
      </section>
    </div>
  </div>;
}

function Benchmarks() {
  const benchmarks = useGetBenchmarks();
  if (benchmarks.isLoading) return <LoadingState label="Loading evaluation registry" />;
  if (benchmarks.isError) return <ErrorState onRetry={() => benchmarks.refetch()} />;
  const rows = benchmarks.data ?? [];
  const best = rows.reduce((winner, row) => row.f1 > (winner?.f1 ?? 0) ? row : winner, rows[0]);
  return <div className="animate-rise"><Header eyebrow="Model evaluation / registry" title="Benchmarks" /><div className="mb-5 grid gap-3 sm:grid-cols-3"><MetricCard label="Models evaluated" value={`${rows.length}`} note="Common validation set" accent="ink" icon={<Beaker size={16} />} /><MetricCard label="Top F1 score" value={best ? formatPct(best.f1) : '—'} note={best ? `${best.name} leads the set` : 'No results yet'} accent="teal" icon={<Target size={16} />} /><MetricCard label="Evaluation mode" value="Macro" note="Balanced across classes" accent="amber" icon={<Layers3 size={16} />} /></div><section className="panel p-5 sm:p-7"><SectionHeading kicker="Comparative readout / higher is better" title="Model performance" /><div className="scrollbar-thin mt-7 overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-border font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground"><th className="pb-3">Model</th><th className="pb-3">Family</th><th className="pb-3">Accuracy</th><th className="pb-3">Precision</th><th className="pb-3">Recall</th><th className="pb-3">F1 score</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.model} data-testid={`row-benchmark-${row.model}`} className={cn('text-sm', row.model === best?.model && 'bg-accent/5')}><td className="py-4 pr-5"><div className="flex items-center gap-3"><span className={cn('flex h-7 w-7 items-center justify-center border font-mono text-[10px]', row.model === best?.model ? 'border-accent bg-accent text-accent-foreground' : 'border-border')}>{row.model === best?.model ? <Check size={13} /> : String(rows.indexOf(row) + 1).padStart(2, '0')}</span><div><div className="font-medium">{row.name}</div><div className="font-mono text-[9px] text-muted-foreground">{formatModel(row.model)}</div></div></div></td><td className="py-4 pr-5 text-xs text-muted-foreground">{row.family}</td>{(['accuracy', 'precision', 'recall', 'f1'] as const).map((key) => <td key={key} className="py-4 pr-5"><div className="flex items-center gap-3"><span className={cn('metric-number min-w-[44px] text-xs', key === 'f1' && 'font-semibold text-accent')}>{formatPct(row[key])}</span><span className="hidden h-1 w-16 bg-muted sm:block"><span className={cn('block h-full', key === 'f1' ? 'bg-accent' : 'bg-primary/50')} style={{ width: `${row[key] <= 1 ? row[key] * 100 : Math.min(row[key], 100)}%` }} /></span></div></td>)}</tr>)}</tbody></table></div><div className="mt-6 flex items-start gap-3 border-l-2 border-chart-3 bg-chart-3/5 p-3 text-xs leading-5 text-muted-foreground"><Info size={15} className="mt-0.5 shrink-0 text-chart-3" />Scores reflect the latest shared evaluation set. Use the single-text console to inspect model behavior before adopting a result.</div></section></div>;
}

function Analytics() {
  const analytics = useGetAnalytics();
  if (analytics.isLoading) return <LoadingState label="Building signal index" />;
  if (analytics.isError) return <ErrorState onRetry={() => analytics.refetch()} />;
  const data = analytics.data;
  const keywords = [...(data?.keywords ?? [])].sort((a, b) => b.count - a.count);
  const max = Math.max(...keywords.map((keyword) => keyword.count), 1);
  return <div className="animate-rise"><Header eyebrow="Signal index / language patterns" title="Analytics" /><div className="mb-5 grid gap-3 sm:grid-cols-3"><MetricCard label="Unique keywords" value={`${data?.totalKeywords ?? 0}`} note="Across indexed observations" accent="ink" icon={<Hash size={16} />} /><MetricCard label="Positive topic" value={data?.highlights?.positiveTopic ?? '—'} note="Highest affinity cluster" accent="teal" icon={<ArrowUpRight size={16} />} /><MetricCard label="Trending keyword" value={data?.highlights?.trendingKeyword ?? '—'} note="Fastest recent movement" accent="amber" icon={<Activity size={16} />} /></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(310px,.85fr)]"><section className="panel p-5 sm:p-7"><SectionHeading kicker="Vocabulary / frequency weighted" title="Keyword landscape" /><div className="mt-7 space-y-4" data-testid="list-keywords">{keywords.map((keyword, index) => <div key={keyword.word} data-testid={`row-keyword-${keyword.word}`} className="grid grid-cols-[24px_1fr_auto] items-center gap-3"><span className="font-mono text-[10px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span><div><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="font-medium">#{keyword.word}</span><span className="font-mono text-[10px] text-muted-foreground">{keyword.count}</span></div><div className="h-1.5 bg-muted"><div className={cn('h-full', keyword.sentiment === 'positive' ? 'bg-chart-1' : keyword.sentiment === 'negative' ? 'bg-chart-2' : 'bg-chart-3')} style={{ width: `${(keyword.count / max) * 100}%` }} /></div></div><SentimentChip value={keyword.sentiment} /></div>)}</div>{!keywords.length && <div data-testid="status-empty-keywords" className="py-16 text-center text-sm text-muted-foreground">No keyword signals have been indexed.</div>}</section><section className="panel p-5 sm:p-7"><SectionHeading kicker="Interpretation / analyst notes" title="Topic highlights" /><div className="mt-7 space-y-3"><InsightBlock label="Positive topic" value={data?.highlights?.positiveTopic} tone="positive" /><InsightBlock label="Negative topic" value={data?.highlights?.negativeTopic} tone="negative" /><InsightBlock label="Trending keyword" value={data?.highlights?.trendingKeyword} tone="neutral" /></div><div className="mt-7 border-t border-border pt-5"><div className="mb-3 font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Reading this view</div><p className="text-xs leading-6 text-muted-foreground">Frequency is weighted by appearance across the indexed corpus. Sentiment color is assigned by the dominant classification attached to each keyword, not by frequency alone.</p></div></section></div></div>;
}
function InsightBlock({ label, value, tone }: { label: string; value?: string; tone: 'positive' | 'negative' | 'neutral' }) {
  return <div className="flex items-center gap-3 border border-border bg-background p-3"><span className={cn('h-9 w-1', tone === 'positive' && 'bg-chart-1', tone === 'negative' && 'bg-chart-2', tone === 'neutral' && 'bg-chart-3')} /><div><div className="font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">{label}</div><div data-testid={`text-highlight-${label.toLowerCase().replace(' ', '-')}`} className="mt-1 text-sm font-medium">{value || 'Awaiting signal'}</div></div></div>;
}

function Architecture() {
  const health = useHealthCheck();
  return <div className="animate-rise"><Header eyebrow="System notes / provenance" title="Architecture" /><div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_350px]"><section className="panel overflow-hidden p-5 sm:p-7"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><div className="font-mono text-[9px] uppercase tracking-[.17em] text-accent">Pipeline / v0.1</div><h2 className="mt-1 text-xl font-semibold tracking-[-.03em]">From noise to a signal you can defend.</h2></div><div data-testid="status-api-health" className="flex items-center gap-2 border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground"><span className={cn('h-1.5 w-1.5 rounded-full', health.isError ? 'bg-destructive' : 'bg-accent')} />API {health.isLoading ? 'checking' : health.isError ? 'degraded' : health.data?.status ?? 'nominal'}</div></div><div className="relative space-y-3" data-testid="list-pipeline-stages">{[['01', 'Ingest', 'CSV, XLSX, JSON', 'Normalize text, preserve source metadata, and create a traceable observation.'], ['02', 'Tokenize', 'Linguistic preprocessing', 'Remove noise without erasing the phrases that carry intent or sentiment.'], ['03', 'Classify', 'Five model families', 'Score each observation across logistic regression, Naive Bayes, SVM, VADER, and TextBlob.'], ['04', 'Explain', 'Evidence layer', 'Return polarity, confidence, keyword signals, and a short model-grounded explanation.']].map(([number, name, meta, detail], index) => <div key={number} className="group grid gap-4 border border-border bg-background p-4 transition-colors hover:border-accent sm:grid-cols-[52px_180px_1fr] sm:items-center"><span className="font-mono text-[11px] text-accent">{number}</span><div><div className="text-sm font-semibold">{name}</div><div className="mt-1 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">{meta}</div></div><p className="text-xs leading-5 text-muted-foreground">{detail}</p>{index < 3 && <span className="absolute left-[25px] mt-[100px] hidden h-3 border-l border-dashed border-accent/40 sm:block" />}</div>)}</div></section><aside className="space-y-5"><section className="panel p-5 sm:p-6"><SectionHeading kicker="Project metadata" title="Sentinel AI" /><dl className="mt-6 divide-y divide-border">{[['Purpose', 'Research-grade sentiment intelligence'], ['Contract', 'OpenAPI / typed client'], ['Inputs', 'Social text + structured datasets'], ['Outputs', 'Class · confidence · provenance']].map(([term, value]) => <div key={term} className="grid grid-cols-[90px_1fr] gap-3 py-3 text-xs"><dt className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">{term}</dt><dd>{value}</dd></div>)}</dl></section><section className="panel sentinel-grid p-5 sm:p-6"><div className="mb-4 flex h-9 w-9 items-center justify-center border border-accent text-accent"><CircleHelp size={17} /></div><h3 className="text-sm font-semibold">A note on confidence</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">Confidence is a model output, not a truth claim. Compare it with polarity, source context, and the benchmark registry before making a decision.</p><Link href="/benchmarks" data-testid="link-read-benchmarks" className="mt-4 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[.11em] text-accent hover:underline">Read benchmark notes <ChevronRight size={13} /></Link></section></aside></div></div>;
}

function Router() {
  return <ErrorBoundary resetKey={useLocation()[0]}><Shell><Switch><Route path="/" component={Overview} /><Route path="/analyze" component={Analyze} /><Route path="/datasets" component={Datasets} /><Route path="/benchmarks" component={Benchmarks} /><Route path="/analytics" component={Analytics} /><Route path="/architecture" component={Architecture} /><Route component={NotFound} /></Switch></Shell></ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;