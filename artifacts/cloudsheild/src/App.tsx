import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useAuth,
  useClerk,
  useUser,
} from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowUpRight,
  Bell,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clipboard,
  Cloud,
  Copy,
  Download,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  KeyRound,
  Link as LinkIcon,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import {
  getGetDashboardSummaryQueryKey,
  getGetProjectQueryKey,
  getListProjectFilesQueryKey,
  getListProjectsQueryKey,
  useCreateProject,
  useCreateProjectFile,
  useGetDashboardSummary,
  useGetProject,
  useJoinProject,
  useListProjectFiles,
  useListProjects,
  useRequestUploadUrl,
} from '@workspace/api-client-react';
import type { Project, ProjectFile } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import {
  Link,
  Redirect,
  Route,
  Router as WouterRouter,
  Switch,
  useLocation,
  useParams,
} from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#202b3c',
    colorForeground: '#202b3c',
    colorMutedForeground: '#64707c',
    colorDanger: '#b94d3f',
    colorBackground: '#fbfaf7',
    colorInput: '#f4f0e7',
    colorInputForeground: '#202b3c',
    colorNeutral: '#dad5ca',
    fontFamily: 'Manrope, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbfaf7] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-[0_20px_70px_rgba(32,43,60,.12)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#202b3c] font-bold',
    headerSubtitle: 'text-[#64707c]',
    socialButtonsBlockButtonText: 'text-[#202b3c] font-semibold',
    formFieldLabel: 'text-[#202b3c] font-semibold',
    footerActionLink: 'text-[#3d8c7a] font-bold',
    footerActionText: 'text-[#64707c]',
    dividerText: 'text-[#64707c]',
    formButtonPrimary: 'bg-[#202b3c] hover:bg-[#31445d] text-[#fbfaf7] font-bold',
    formFieldInput: 'bg-[#f4f0e7] border-[#dad5ca] text-[#202b3c]',
    socialButtonsBlockButton: 'border-[#dad5ca] bg-[#fbfaf7] hover:bg-[#f4f0e7]',
    dividerLine: 'bg-[#dad5ca]',
    alert: 'bg-[#f8e4df] text-[#8b3f34]',
    alertText: 'text-[#8b3f34]',
    logoImage: 'w-12 h-12',
    main: 'gap-4',
  },
};

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(value),
  );
}

function formatRelative(value?: string) {
  if (!value) return 'just now';
  const distance = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(distance / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function initials(name?: string | null) {
  if (!name) return 'CS';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function errorText(error: unknown) {
  if (error && typeof error === 'object' && 'error' in error) {
    return String((error as { error?: string }).error);
  }
  return 'Something went wrong. Please try again.';
}

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
      <span
        className={`grid size-9 place-items-center rounded-xl ${dark ? 'bg-[#f7c948]' : 'bg-[#202b3c]'}`}
        data-testid="logo-mark"
      >
        <span className={`relative block h-5 w-5 rounded-[5px] border-2 ${dark ? 'border-[#202b3c]' : 'border-[#f7c948]'}`}>
          <span className={`absolute left-1 top-1 h-0.5 w-2.5 rounded-full ${dark ? 'bg-[#202b3c]' : 'bg-[#f7c948]'}`} />
          <span className={`absolute left-1 top-2.5 h-0.5 w-1.5 rounded-full ${dark ? 'bg-[#3d8c7a]' : 'bg-[#3d8c7a]'}`} />
        </span>
      </span>
      <span className={`font-bold tracking-[-0.03em] ${dark ? 'text-[#f8f4ec]' : 'text-[#202b3c]'}`} data-testid="text-brand">
        CloudShield
      </span>
    </Link>
  );
}

function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'yellow' }) {
  const styles = {
    primary: 'bg-[#202b3c] text-[#fbfaf7] hover:bg-[#31445d]',
    secondary: 'border border-[#d8d3c9] bg-[#fbfaf7] text-[#202b3c] hover:bg-[#f1ede4]',
    ghost: 'text-[#64707c] hover:bg-[#eee9df] hover:text-[#202b3c]',
    yellow: 'bg-[#f7c948] text-[#202b3c] hover:bg-[#f9d66e]',
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function LoadingPage({ label = 'Loading your room' }: { label?: string }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[#f4f1ea] px-6">
      <div className="animate-rise flex flex-col items-center gap-5 text-center">
        <div className="relative grid size-16 place-items-center rounded-2xl bg-[#202b3c]">
          <Cloud className="size-7 text-[#f7c948]" strokeWidth={1.5} />
          <span className="absolute -right-1 -top-1 size-3 animate-[cloudshield-pulse_1.5s_ease-in-out_infinite] rounded-full bg-[#3d8c7a]" />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#3d8c7a]" data-testid="status-loading">Secure channel</p>
          <p className="mt-2 text-sm text-[#64707c]" data-testid="text-loading-message">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-[#e7c9c1] bg-[#fff8f6] p-8 text-center" data-testid="state-error">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-[#f8e4df] text-[#b94d3f]">
        <CircleAlert className="size-6" />
      </div>
      <h3 className="mt-4 font-bold text-[#202b3c]" data-testid="text-error-title">The room is out of reach</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#64707c]" data-testid="text-error-message">
        {message || 'We could not load this surface right now. Your work is safe. Try the connection again.'}
      </p>
      <Button variant="secondary" className="mt-5" onClick={onRetry} data-testid="button-retry">
        <RefreshCw className="size-4" /> Retry connection
      </Button>
    </div>
  );
}

function Landing() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingPage label="Checking your secure channel" />;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return (
    <div className="noise min-h-[100dvh] overflow-hidden bg-[#f4f1ea] text-[#202b3c]">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10" data-testid="header-landing">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Main navigation">
          <Link href="/sign-in" className="rounded-lg px-3 py-2 text-sm font-bold text-[#64707c] transition-colors hover:bg-[#e9e4da] hover:text-[#202b3c]" data-testid="link-sign-in">
            Sign in
          </Link>
          <Link href="/sign-up" className="rounded-lg bg-[#202b3c] px-4 py-2.5 text-sm font-bold text-[#fbfaf7] transition-colors hover:bg-[#31445d]" data-testid="link-get-started">
            Open a room <ArrowUpRight className="ml-1 inline size-4" />
          </Link>
        </nav>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 pb-20 pt-12 lg:grid-cols-[1.08fr_.92fr] lg:px-10 lg:pb-32 lg:pt-20">
          <div className="relative z-10 animate-rise">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#d8d3c9] bg-[#fbfaf7]/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#3d8c7a]" data-testid="status-landing-secure">
              <span className="size-1.5 rounded-full bg-[#3d8c7a]" /> private by default
            </div>
            <h1 className="max-w-3xl text-[clamp(3.4rem,8vw,7.4rem)] font-extrabold leading-[.91] tracking-[-.08em] text-[#202b3c]" data-testid="heading-landing">
              Handoffs with<br /><span className="text-[#3d8c7a]">a clear signal.</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-[#64707c]" data-testid="text-landing-intro">
              CloudShield gives teams one trusted room for the files, context, and TL-issued keys that keep important work moving.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-lg bg-[#202b3c] px-5 py-3.5 text-sm font-bold text-[#fbfaf7] transition-colors hover:bg-[#31445d]" data-testid="link-create-room">
                Create your first room <ArrowUpRight className="size-4" />
              </Link>
              <a href="#how-it-works" className="inline-flex items-center gap-2 px-2 py-3 text-sm font-bold text-[#64707c] hover:text-[#202b3c]" data-testid="link-how-it-works">
                See how it works <ChevronRight className="size-4" />
              </a>
            </div>
            <div className="mt-12 flex items-center gap-3 text-xs text-[#64707c]" data-testid="text-landing-note">
              <LockKeyhole className="size-4 text-[#3d8c7a]" />
              Your room is only visible to the people you invite.
            </div>
          </div>

          <div className="animate-rise animate-rise-delay-2 relative mx-auto w-full max-w-[530px]" data-testid="visual-operations-room">
            <div className="absolute -right-5 -top-8 h-48 w-48 rounded-full bg-[#f7c948]/35 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-[#d8d3c9] bg-[#202b3c] p-4 shadow-[0_28px_80px_rgba(32,43,60,.18)]">
              <div className="flex items-center justify-between border-b border-[#ffffff1a] px-3 pb-4">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[#3d8c7a]" />
                  <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[#f4f1ea]/60">Room / 04A</span>
                </div>
                <span className="font-mono text-[10px] text-[#f7c948]">LIVE CHANNEL</span>
              </div>
              <div className="grid gap-3 p-3">
                <div className="rounded-xl border border-[#ffffff16] bg-[#ffffff08] p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[.15em] text-[#f4f1ea]/45">Project room</p>
                      <p className="mt-2 text-xl font-bold text-[#f4f1ea]">Northline Launch</p>
                    </div>
                    <ShieldCheck className="size-5 text-[#f7c948]" />
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <span className="rounded-full bg-[#3d8c7a]/20 px-2.5 py-1 font-mono text-[9px] text-[#90d5c5]">TL VERIFIED</span>
                    <span className="font-mono text-[10px] text-[#f4f1ea]/45">12 files · 8 members</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#f7c948] p-4 text-[#202b3c]">
                    <KeyRound className="size-5" />
                    <p className="mt-9 font-mono text-[9px] uppercase tracking-[.14em] opacity-60">Reference key</p>
                    <p className="mt-1 font-mono text-xs font-bold">CS-7K4-PQ2</p>
                  </div>
                  <div className="rounded-xl border border-[#ffffff16] bg-[#ffffff08] p-4">
                    <UploadCloud className="size-5 text-[#90d5c5]" />
                    <p className="mt-9 font-mono text-[9px] uppercase tracking-[.14em] text-[#f4f1ea]/45">Last signal</p>
                    <p className="mt-1 text-xs font-semibold text-[#f4f1ea]">Briefing.pdf added</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-[#ffffff1a] px-3 pt-4">
                <span className="size-2 rounded-full bg-[#f7c948]" />
                <span className="font-mono text-[9px] tracking-[.15em] text-[#f4f1ea]/50">SYNCED 14:08:31 UTC</span>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-[#d8d3c9] bg-[#fbfaf7]" data-testid="section-how-it-works">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[.75fr_1.25fr] lg:px-10 lg:py-28">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#3d8c7a]">The operating model</p>
              <h2 className="mt-4 max-w-md text-4xl font-extrabold leading-tight tracking-[-.05em] text-[#202b3c]" data-testid="heading-how-it-works">
                Less hunting.<br />More handoff.
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-7 text-[#64707c]">Every room keeps the signal close: who owns it, what is shared, and which key gets a collaborator through the door.</p>
            </div>
            <div className="grid gap-0 sm:grid-cols-3">
              {[
                ['01', 'Make the room', 'Name the work and set the TL. A focused home for the project appears in seconds.'],
                ['02', 'Issue the key', 'Share a reference key with the people who need access. No public links.'],
                ['03', 'Move the work', 'Upload files directly to the room and keep the handoff trail visible.'],
              ].map(([number, title, copy]) => (
                <div className="border-t border-[#d8d3c9] py-6 sm:border-l sm:border-t-0 sm:pl-7 sm:pr-6" key={number} data-testid={`card-workflow-${number}`}>
                  <span className="font-mono text-xs text-[#3d8c7a]">{number}</span>
                  <h3 className="mt-8 text-lg font-bold text-[#202b3c]">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#64707c]">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-14 px-6 py-20 lg:grid-cols-[1.1fr_.9fr] lg:px-10 lg:py-28" data-testid="section-principles">
          <div className="relative min-h-[380px] overflow-hidden rounded-[2rem] bg-[#3d8c7a] p-8 text-[#fbfaf7]">
            <div className="absolute -right-16 -top-16 size-64 rounded-full border-[1px] border-[#b5e2d7]/30" />
            <div className="absolute -bottom-24 -left-12 size-72 rounded-full border-[1px] border-[#b5e2d7]/20" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[.2em] text-[#d6f0e9]">Signal / 001</span>
                <ShieldCheck className="size-6 text-[#f7c948]" />
              </div>
              <div>
                <p className="max-w-md text-4xl font-extrabold leading-tight tracking-[-.06em]">A calmer way to hold the important parts.</p>
                <p className="mt-5 max-w-sm text-sm leading-6 text-[#d6f0e9]">Designed for the moment when a project leaves one set of hands and needs to land safely in another.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#b94d3f]">Built for the in-between</p>
            <h2 className="mt-4 text-4xl font-extrabold leading-tight tracking-[-.05em] text-[#202b3c]" data-testid="heading-principles">The handoff is the product.</h2>
            <p className="mt-5 text-sm leading-7 text-[#64707c]">CloudShield is intentionally not another noisy task board. It is a small, dependable room where teams can leave enough context for the next person to do good work.</p>
            <div className="mt-8 space-y-4">
              {[
                ['One source of truth', 'A project title, TL, members, files, and key stay together.'],
                ['Visible by invitation', 'Reference keys are issued, not guessed.'],
                ['A useful trail', 'Recent signals make the room feel alive without becoming noise.'],
              ].map(([title, copy], index) => (
                <div className="flex gap-4" key={title} data-testid={`text-principle-${index}`}>
                  <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-[#f7c948] text-[#202b3c]"><Check className="size-3" /></span>
                  <div><p className="text-sm font-bold text-[#202b3c]">{title}</p><p className="mt-1 text-sm leading-6 text-[#64707c]">{copy}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#d8d3c9] px-6 py-8 lg:px-10" data-testid="footer-landing">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-xs text-[#64707c] sm:flex-row">
          <Logo />
          <p data-testid="text-footer-note">A considered room for work in motion.</p>
          <p className="font-mono text-[10px] uppercase tracking-[.16em]">Private / focused / shared</p>
        </div>
      </footer>
    </div>
  );
}

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const [, setLocation] = useLocation();
  return (
    <div className="noise grid min-h-[100dvh] bg-[#f4f1ea] lg:grid-cols-[.9fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-[#202b3c] p-10 text-[#f8f4ec] lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 top-20 size-96 rounded-full border border-[#ffffff12]" />
        <div className="absolute -bottom-40 -left-20 size-[28rem] rounded-full border border-[#f7c94822]" />
        <Logo dark />
        <div className="relative max-w-md">
          <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#f7c948]" data-testid="text-auth-kicker">CloudShield / secure channel</p>
          <h1 className="mt-5 text-5xl font-extrabold leading-[.98] tracking-[-.07em]" data-testid="heading-auth">
            Keep the signal.<br /><span className="text-[#90d5c5]">Lose the scramble.</span>
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-[#d8e0dd]">A trusted home for project handoffs, shared files, and the people moving the work forward.</p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#f8f4ec]/45">Encrypted room protocol / v1</p>
      </div>
      <div className="flex flex-col items-center justify-center px-5 py-10">
        <div className="mb-8 flex w-full max-w-[440px] items-center justify-between lg:hidden"><Logo /><Link href="/" className="text-sm font-bold text-[#64707c]" data-testid="link-auth-home">Back home</Link></div>
        <div className="w-full max-w-[440px]">
          {mode === 'sign-in' ? (
            <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
          ) : (
            <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
          )}
        </div>
        <p className="mt-8 text-center text-xs text-[#64707c]" data-testid="text-auth-privacy"><LockKeyhole className="mr-1 inline size-3.5 text-[#3d8c7a]" /> Your account is managed by Clerk and never exposed to a room.</p>
      </div>
    </div>
  );
}

function Sidebar({ projects, mobileOpen, onClose }: { projects: Project[]; mobileOpen: boolean; onClose: () => void }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const displayName = user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress || 'Operator';
  return (
    <>
      {mobileOpen && <button className="fixed inset-0 z-30 bg-[#202b3c]/40 lg:hidden" onClick={onClose} aria-label="Close menu" data-testid="button-close-menu-overlay" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[276px] flex-col bg-[#202b3c] px-5 py-6 text-[#f8f4ec] transition-transform lg:static lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`} data-testid="sidebar">
        <div className="flex items-center justify-between">
          <Logo dark />
          <button className="rounded-md p-2 text-[#f8f4ec]/55 hover:bg-[#ffffff12] lg:hidden" onClick={onClose} aria-label="Close menu" data-testid="button-close-menu"><X className="size-4" /></button>
        </div>
        <div className="mt-12">
          <p className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[.2em] text-[#f8f4ec]/40">Workspace</p>
          <Link href="/dashboard" onClick={onClose} className="flex items-center gap-3 rounded-lg bg-[#ffffff10] px-3 py-3 text-sm font-bold text-[#f8f4ec]" data-testid="link-dashboard">
            <span className="grid size-7 place-items-center rounded-md bg-[#f7c948] text-[#202b3c]"><Cloud className="size-4" /></span> Overview
          </Link>
        </div>
        <div className="mt-9 flex-1">
          <div className="mb-3 flex items-center justify-between px-3">
            <p className="font-mono text-[9px] uppercase tracking-[.2em] text-[#f8f4ec]/40">Your rooms</p>
            <span className="font-mono text-[10px] text-[#f8f4ec]/35" data-testid="text-sidebar-project-count">{projects.length.toString().padStart(2, '0')}</span>
          </div>
          {projects.length === 0 ? (
            <p className="px-3 text-xs leading-5 text-[#f8f4ec]/45" data-testid="text-sidebar-empty">Rooms you create or join will appear here.</p>
          ) : (
            <div className="space-y-1">
              {projects.slice(0, 5).map((project) => (
                <Link href={`/projects/${project.id}`} onClick={onClose} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#f8f4ec]/65 hover:bg-[#ffffff0d] hover:text-[#f8f4ec]" key={project.id} data-testid={`link-sidebar-project-${project.id}`}>
                  <span className="grid size-7 place-items-center rounded-md bg-[#3d8c7a]/25 font-mono text-[10px] text-[#90d5c5]">{initials(project.companyName)}</span>
                  <span className="min-w-0 flex-1 truncate">{project.title}</span>
                  <ChevronRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-[#ffffff14] pt-4">
          <div className="flex items-center gap-3 px-2 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#f7c948] text-xs font-extrabold text-[#202b3c]" data-testid="avatar-sidebar">{initials(displayName)}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold" data-testid="text-sidebar-user">{displayName}</p><p className="mt-0.5 truncate font-mono text-[9px] text-[#f8f4ec]/40">operator</p></div>
            <button className="rounded-md p-2 text-[#f8f4ec]/45 hover:bg-[#ffffff12] hover:text-[#f8f4ec]" onClick={() => signOut({ redirectUrl: basePath || '/' })} aria-label="Sign out" data-testid="button-sign-out"><LogOut className="size-4" /></button>
          </div>
        </div>
      </aside>
    </>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const projectsQuery = useListProjects();
  const projects = projectsQuery.data ?? [];
  return (
    <div className="noise flex min-h-[100dvh] bg-[#f4f1ea]">
      <Sidebar projects={projects} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="min-w-0 flex-1">
        <header className="flex h-[76px] items-center justify-between border-b border-[#d8d3c9] bg-[#f4f1ea]/85 px-5 backdrop-blur-sm lg:px-10" data-testid="header-app">
          <button className="rounded-lg p-2 text-[#64707c] hover:bg-[#e9e4da] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu" data-testid="button-open-menu"><Menu className="size-5" /></button>
          <div className="hidden items-center gap-2 text-xs text-[#64707c] lg:flex"><span className="size-1.5 rounded-full bg-[#3d8c7a]" /> Secure workspace</div>
          <div className="ml-auto flex items-center gap-3"><button className="relative rounded-lg p-2 text-[#64707c] hover:bg-[#e9e4da]" aria-label="Notifications" data-testid="button-notifications"><Bell className="size-[18px]" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#b94d3f]" /></button><span className="hidden font-mono text-[10px] uppercase tracking-[.16em] text-[#64707c] sm:inline" data-testid="status-workspace">channel active</span></div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-5 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const createProject = useCreateProject();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ companyName: '', title: '', tlName: '' });
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.companyName || !form.title || !form.tlName) { setError('Complete all three fields to open the room.'); return; }
    setError('');
    createProject.mutate({ data: form }, {
      onSuccess: (project) => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setLocation(`/projects/${project.id}`);
      },
      onError: (err) => setError(errorText(err)),
    });
  };
  return <Modal title="Open a project room" eyebrow="New channel" onClose={onClose}>
    <p className="mb-6 text-sm leading-6 text-[#64707c]">Give your team a focused place to land the next handoff.</p>
    <form className="space-y-4" onSubmit={submit}>
      <Field label="Company or team" value={form.companyName} placeholder="e.g. Northline Studio" onChange={(value) => setForm({ ...form, companyName: value })} testId="input-create-company" />
      <Field label="Project title" value={form.title} placeholder="e.g. Launch readiness" onChange={(value) => setForm({ ...form, title: value })} testId="input-create-title" />
      <Field label="TL name" value={form.tlName} placeholder="The person leading this room" onChange={(value) => setForm({ ...form, tlName: value })} testId="input-create-tl" />
      {error && <p className="text-xs font-semibold text-[#b94d3f]" data-testid="text-create-error">{error}</p>}
      <Button type="submit" className="mt-2 w-full" disabled={createProject.isPending} data-testid="button-submit-create">{createProject.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} {createProject.isPending ? 'Opening room…' : 'Open room'}</Button>
    </form>
  </Modal>;
}

function JoinProjectModal({ onClose }: { onClose: () => void }) {
  const joinProject = useJoinProject();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ companyName: '', person: '', projectTitle: '', referenceKey: '' });
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (Object.values(form).some((value) => !value.trim())) { setError('All fields are required to join a room.'); return; }
    setError('');
    joinProject.mutate({ data: form }, {
      onSuccess: (project) => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setLocation(`/projects/${project.id}`);
      },
      onError: (err) => setError(errorText(err)),
    });
  };
  return <Modal title="Join a project room" eyebrow="Use your key" onClose={onClose}>
    <p className="mb-6 text-sm leading-6 text-[#64707c]">Enter the details exactly as they appear in the invitation from the TL.</p>
    <form className="space-y-4" onSubmit={submit}>
      <Field label="Company or team" value={form.companyName} placeholder="The team who invited you" onChange={(value) => setForm({ ...form, companyName: value })} testId="input-join-company" />
      <Field label="Your name" value={form.person} placeholder="How the room should know you" onChange={(value) => setForm({ ...form, person: value })} testId="input-join-person" />
      <Field label="Project title" value={form.projectTitle} placeholder="e.g. Launch readiness" onChange={(value) => setForm({ ...form, projectTitle: value })} testId="input-join-title" />
      <Field label="Reference key" value={form.referenceKey} placeholder="e.g. CS-7K4-PQ2" onChange={(value) => setForm({ ...form, referenceKey: value.toUpperCase() })} testId="input-join-key" mono />
      {error && <p className="text-xs font-semibold text-[#b94d3f]" data-testid="text-join-error">{error}</p>}
      <Button type="submit" variant="yellow" className="mt-2 w-full" disabled={joinProject.isPending} data-testid="button-submit-join">{joinProject.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />} {joinProject.isPending ? 'Checking key…' : 'Join room'}</Button>
    </form>
  </Modal>;
}

function Modal({ eyebrow, title, onClose, children }: { eyebrow: string; title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#202b3c]/45 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" data-testid="dialog-modal">
    <div className="animate-rise relative max-h-[calc(100dvh-40px)] w-full max-w-[480px] overflow-auto rounded-2xl border border-[#d8d3c9] bg-[#fbfaf7] p-7 shadow-[0_24px_80px_rgba(32,43,60,.22)]">
      <button className="absolute right-5 top-5 rounded-md p-2 text-[#64707c] hover:bg-[#eee9df] hover:text-[#202b3c]" onClick={onClose} aria-label="Close dialog" data-testid="button-close-dialog"><X className="size-4" /></button>
      <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#3d8c7a]" data-testid="text-modal-eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-extrabold tracking-[-.04em] text-[#202b3c]" data-testid="heading-modal">{title}</h2>
      {children}
    </div>
  </div>;
}

function Field({ label, value, placeholder, onChange, testId, mono = false }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; testId: string; mono?: boolean }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold text-[#202b3c]" data-testid={`label-${testId}`}>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`w-full rounded-lg border border-[#d8d3c9] bg-[#f4f1ea] px-3.5 py-3 text-sm text-[#202b3c] placeholder:text-[#9b9a96] focus:border-[#3d8c7a] focus:outline-none ${mono ? 'font-mono uppercase tracking-[.1em]' : ''}`} data-testid={testId} /></label>;
}

function Dashboard() {
  const summaryQuery = useGetDashboardSummary();
  const projectsQuery = useListProjects();
  const [modal, setModal] = useState<'create' | 'join' | null>(null);
  const [notice, setNotice] = useState('');
  const { user } = useUser();
  const summary = summaryQuery.data;
  const projects = projectsQuery.data ?? [];
  const summaryCards: Array<{ label: string; value: number; Icon: typeof Cloud; color: string; caption: string }> = [
    { label: 'Rooms in orbit', value: summary?.projectCount ?? 0, Icon: Cloud, color: 'text-[#3d8c7a]', caption: 'active project rooms' },
    { label: 'Files shared', value: summary?.fileCount ?? 0, Icon: FolderOpen, color: 'text-[#b94d3f]', caption: 'across your rooms' },
    { label: 'Shared with me', value: summary?.sharedWithMeCount ?? 0, Icon: Users, color: 'text-[#b17b0e]', caption: 'rooms you joined' },
  ];
  const greeting = user?.firstName ? `Good to see you, ${user.firstName}.` : 'Good to see you.';
  const reload = () => { summaryQuery.refetch(); projectsQuery.refetch(); };
  if (summaryQuery.isLoading || projectsQuery.isLoading) return <DashboardSkeleton />;
  if (summaryQuery.isError || projectsQuery.isError) return <ErrorState message="We could not load your workspace overview." onRetry={reload} />;
  return (
    <>
      <div className="animate-rise flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div><p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#3d8c7a]" data-testid="text-dashboard-kicker">Workspace overview</p><h1 className="mt-3 text-4xl font-extrabold tracking-[-.06em] text-[#202b3c] lg:text-5xl" data-testid="heading-dashboard">{greeting}</h1><p className="mt-3 text-sm text-[#64707c]" data-testid="text-dashboard-subtitle">Here is the current state of your project rooms.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setModal('join')} data-testid="button-open-join"><KeyRound className="size-4 text-[#3d8c7a]" /> Join a room</Button><Button variant="yellow" onClick={() => setModal('create')} data-testid="button-open-create"><Plus className="size-4" /> New room</Button></div>
      </div>
      {notice && <div className="mt-6 flex items-center justify-between rounded-lg border border-[#b5e2d7] bg-[#edf8f5] px-4 py-3 text-sm text-[#286856]" data-testid="status-dashboard-notice"><span className="flex items-center gap-2"><CircleCheck className="size-4" /> {notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notice" data-testid="button-dismiss-notice"><X className="size-4" /></button></div>}

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {summaryCards.map(({ label, value, Icon, color, caption }, index) => <div className={`animate-rise animate-rise-delay-${index + 1} rounded-2xl border border-[#d8d3c9] bg-[#fbfaf7] p-5`} key={label} data-testid={`card-summary-${index}`}><div className="flex items-start justify-between"><p className="text-xs font-bold text-[#64707c]">{label}</p><Icon className={`size-5 ${color}`} /></div><p className="mt-7 font-mono text-3xl font-medium tracking-[-.06em] text-[#202b3c]" data-testid={`text-summary-value-${index}`}>{value}</p><p className="mt-1 text-xs text-[#9b9a96]">{caption}</p></div>)}
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-[1.32fr_.68fr]">
        <section className="animate-rise animate-rise-delay-2" data-testid="section-projects">
          <div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#64707c]">Current rooms</p><h2 className="mt-1 text-xl font-extrabold tracking-[-.04em] text-[#202b3c]" data-testid="heading-projects">Your project rooms</h2></div><span className="font-mono text-[10px] text-[#9b9a96]" data-testid="text-project-count">{projects.length} total</span></div>
          {projects.length === 0 ? <EmptyProjects onCreate={() => setModal('create')} onJoin={() => setModal('join')} /> : <div className="grid gap-3">{projects.map((project) => <ProjectCard project={project} key={project.id} />)}</div>}
        </section>
        <section className="animate-rise animate-rise-delay-3" data-testid="section-activity">
          <div className="mb-4"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#64707c]">Room telemetry</p><h2 className="mt-1 text-xl font-extrabold tracking-[-.04em] text-[#202b3c]" data-testid="heading-activity">Recent activity</h2></div>
          <div className="rounded-2xl border border-[#d8d3c9] bg-[#fbfaf7] p-5">{summary?.recentActivity?.length ? <div className="space-y-5">{summary.recentActivity.slice(0, 6).map((activity) => <div className="flex gap-3" key={activity.id} data-testid={`row-activity-${activity.id}`}><span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${activity.type === 'file_uploaded' ? 'bg-[#f8e4df] text-[#b94d3f]' : activity.type === 'member_joined' ? 'bg-[#f7efc9] text-[#a27812]' : 'bg-[#edf8f5] text-[#3d8c7a]'}`}>{activity.type === 'file_uploaded' ? <UploadCloud className="size-3.5" /> : activity.type === 'member_joined' ? <Users className="size-3.5" /> : <Plus className="size-3.5" />}</span><div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#202b3c]" data-testid={`text-activity-title-${activity.id}`}>{activity.title}</p><p className="mt-1 text-xs leading-5 text-[#64707c]">{activity.detail}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[.1em] text-[#9b9a96]">{formatRelative(activity.occurredAt)}</p></div></div>)}</div> : <div className="grid min-h-[230px] place-items-center text-center"><div><div className="mx-auto grid size-10 place-items-center rounded-full bg-[#f4f1ea] text-[#64707c]"><Bell className="size-4" /></div><p className="mt-3 text-sm font-bold text-[#202b3c]" data-testid="text-empty-activity">No activity yet</p><p className="mt-1 max-w-[190px] text-xs leading-5 text-[#64707c]">Create or join a room to see its signal here.</p></div></div>}</div>
        </section>
      </div>
      {modal === 'create' && <CreateProjectModal onClose={() => setModal(null)} />}
      {modal === 'join' && <JoinProjectModal onClose={() => setModal(null)} />}
    </>
  );
}

function DashboardSkeleton() {
  return <div className="animate-pulse space-y-10" data-testid="state-dashboard-loading"><div className="space-y-3"><div className="h-3 w-28 rounded bg-[#ded9ce]" /><div className="h-12 w-72 rounded bg-[#ded9ce]" /><div className="h-3 w-56 rounded bg-[#ded9ce]" /></div><div className="grid gap-4 sm:grid-cols-3"><div className="h-32 rounded-2xl bg-[#ded9ce]" /><div className="h-32 rounded-2xl bg-[#ded9ce]" /><div className="h-32 rounded-2xl bg-[#ded9ce]" /></div><div className="h-64 rounded-2xl bg-[#ded9ce]" /></div>;
}

function EmptyProjects({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return <div className="rounded-2xl border border-dashed border-[#c8c2b6] bg-[#fbfaf7] p-8 md:p-12" data-testid="state-empty-projects"><div className="flex max-w-lg flex-col items-start"><div className="grid size-12 place-items-center rounded-2xl bg-[#f7c948] text-[#202b3c]"><Cloud className="size-6" /></div><h3 className="mt-6 text-2xl font-extrabold tracking-[-.04em] text-[#202b3c]" data-testid="heading-empty-projects">Your workspace is quiet.</h3><p className="mt-3 max-w-md text-sm leading-6 text-[#64707c]">Open a room for a new handoff, or use a TL-issued reference key to join work already in motion.</p><div className="mt-7 flex flex-wrap gap-2"><Button onClick={onCreate} data-testid="button-empty-create"><Plus className="size-4" /> Open a room</Button><Button variant="secondary" onClick={onJoin} data-testid="button-empty-join"><KeyRound className="size-4" /> Join with key</Button></div></div></div>;
}

function ProjectCard({ project }: { project: Project }) {
  return <Link href={`/projects/${project.id}`} className="group flex flex-col gap-5 rounded-2xl border border-[#d8d3c9] bg-[#fbfaf7] p-5 transition-colors hover:border-[#3d8c7a]/60 hover:bg-[#f9f8f3] sm:flex-row sm:items-center sm:justify-between" data-testid={`card-project-${project.id}`}><div className="flex min-w-0 items-center gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#202b3c] font-mono text-xs font-bold text-[#f7c948]">{initials(project.companyName)}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-base font-extrabold text-[#202b3c]" data-testid={`text-project-title-${project.id}`}>{project.title}</p><span className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-[.08em] ${project.role === 'tl' ? 'bg-[#f7efc9] text-[#987515]' : 'bg-[#edf8f5] text-[#2b7765]'}`}>{project.role === 'tl' ? 'TL' : 'Member'}</span></div><p className="mt-1 text-xs text-[#64707c]">{project.companyName} <span className="mx-1 text-[#c8c2b6]">/</span> TL {project.tlName}</p></div></div><div className="flex items-center gap-6 sm:pl-6"><div className="flex gap-4 text-xs text-[#64707c]"><span className="flex items-center gap-1.5"><Users className="size-3.5" /> {project.memberCount}</span><span className="flex items-center gap-1.5"><File className="size-3.5" /> {project.filesCount}</span></div><ArrowUpRight className="size-4 text-[#9b9a96] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#3d8c7a]" /></div></Link>;
}

function ProjectRoom() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const projectQuery = useGetProject(projectId, { query: { queryKey: getGetProjectQueryKey(projectId), enabled: !!projectId } });
  const filesQuery = useListProjectFiles(projectId, { query: { queryKey: getListProjectFilesQueryKey(projectId), enabled: !!projectId } });
  const project = projectQuery.data;
  const files = filesQuery.data ?? [];
  const [showUpload, setShowUpload] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
  const copyKey = async () => {
    if (!project) return;
    await navigator.clipboard?.writeText(project.referenceKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const retry = () => { projectQuery.refetch(); filesQuery.refetch(); };
  if (projectQuery.isLoading || filesQuery.isLoading) return <RoomSkeleton />;
  if (projectQuery.isError || filesQuery.isError || !project) return <ErrorState message="This project room could not be reached." onRetry={retry} />;
  return <div className="animate-rise">
    <div className="mb-8 flex items-center gap-2 text-xs text-[#64707c]"><Link href="/dashboard" className="hover:text-[#202b3c]" data-testid="link-back-dashboard">Overview</Link><ChevronRight className="size-3" /><span data-testid="text-breadcrumb-project">{project.title}</span></div>
    <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] uppercase tracking-[.2em] text-[#3d8c7a]" data-testid="text-project-company">{project.companyName}</span><span className="text-[#c8c2b6]">/</span><span className="rounded-full bg-[#edf8f5] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.08em] text-[#2b7765]" data-testid="status-project-role">{project.role === 'tl' ? 'team lead' : 'member access'}</span></div><h1 className="mt-4 text-4xl font-extrabold tracking-[-.06em] text-[#202b3c] lg:text-5xl" data-testid="heading-project-room">{project.title}</h1><p className="mt-3 text-sm text-[#64707c]" data-testid="text-project-meta">Led by {project.tlName} <span className="mx-2 text-[#c8c2b6]">·</span> Opened {formatDate(project.createdAt)}</p></div><Button variant="yellow" onClick={() => setShowUpload(true)} data-testid="button-open-upload"><UploadCloud className="size-4" /> Share a file</Button></div>
    {notice && <div className="mt-7 flex items-center gap-2 rounded-lg border border-[#b5e2d7] bg-[#edf8f5] px-4 py-3 text-sm text-[#286856]" data-testid="status-upload-notice"><CircleCheck className="size-4" /> {notice}</div>}
    <div className="mt-10 grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
      <section className="space-y-5">
        <div className="rounded-2xl bg-[#202b3c] p-6 text-[#f8f4ec]" data-testid="card-reference-key"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#f8f4ec]/50">TL-issued reference key</p><p className="mt-3 max-w-[240px] text-sm leading-6 text-[#f8f4ec]/75">Share this key only with the people who should enter the room.</p></div><KeyRound className="size-5 text-[#f7c948]" /></div><div className="mt-8 flex items-center justify-between gap-3 rounded-xl border border-[#ffffff1a] bg-[#ffffff0a] p-4"><span className="font-mono text-lg font-medium tracking-[.16em] text-[#f7c948]" data-testid="text-reference-key">{project.referenceKey}</span><button onClick={copyKey} className="rounded-lg p-2 text-[#f8f4ec]/60 hover:bg-[#ffffff12] hover:text-[#f8f4ec]" aria-label="Copy reference key" data-testid="button-copy-reference-key">{copied ? <Check className="size-4 text-[#90d5c5]" /> : <Copy className="size-4" />}</button></div><p className="mt-3 font-mono text-[9px] uppercase tracking-[.12em] text-[#f8f4ec]/40" data-testid="text-reference-key-status">{copied ? 'Copied to clipboard' : 'Access is granted by the TL'}</p></div>
        <div className="rounded-2xl border border-[#d8d3c9] bg-[#fbfaf7] p-6" data-testid="card-members"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#64707c]">Room people</p><h2 className="mt-2 text-lg font-extrabold text-[#202b3c]" data-testid="heading-members">{project.memberCount} members</h2></div><Users className="size-5 text-[#3d8c7a]" /></div><div className="mt-6 flex items-center"><div className="flex -space-x-2">{Array.from({ length: Math.min(project.memberCount, 5) }).map((_, index) => <span className={`grid size-9 place-items-center rounded-full border-2 border-[#fbfaf7] text-[10px] font-extrabold ${index === 0 ? 'bg-[#f7c948] text-[#202b3c]' : index % 2 ? 'bg-[#3d8c7a] text-[#f8f4ec]' : 'bg-[#d8d3c9] text-[#202b3c]'}`} key={index} data-testid={`avatar-member-${index}`}>{index === 0 ? initials(project.tlName) : String.fromCharCode(65 + index)}</span>)}</div><span className="ml-3 text-xs text-[#64707c]" data-testid="text-members-summary">TL + collaborators</span></div></div>
      </section>
       <section className="rounded-2xl border border-[#d8d3c9] bg-[#fbfaf7] p-6" data-testid="section-files"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#64707c]">Shared files</p><h2 className="mt-2 text-xl font-extrabold tracking-[-.04em] text-[#202b3c]" data-testid="heading-files">{files.length} {files.length === 1 ? 'file' : 'files'} in the room</h2></div><button onClick={() => setShowUpload(true)} className="inline-flex items-center gap-2 self-start rounded-lg border border-[#d8d3c9] px-3 py-2 text-xs font-bold text-[#202b3c] hover:bg-[#f1ede4]" data-testid="button-add-file"><Plus className="size-3.5" /> Add file</button></div>{files.length === 0 ? <div className="mt-7 grid min-h-[225px] place-items-center rounded-xl border border-dashed border-[#c8c2b6] bg-[#f8f5ee] p-7 text-center" data-testid="state-empty-files"><div><div className="mx-auto grid size-11 place-items-center rounded-xl bg-[#f7c948] text-[#202b3c]"><FolderOpen className="size-5" /></div><p className="mt-4 text-sm font-bold text-[#202b3c]" data-testid="text-empty-files">The room is ready for its first file.</p><p className="mt-1 text-xs text-[#64707c]">Share the brief, the source of truth, or the next step.</p><Button className="mt-5" onClick={() => setShowUpload(true)} data-testid="button-empty-upload"><UploadCloud className="size-4" /> Upload a file</Button></div></div> : <div className="mt-7 divide-y divide-[#ece7dd]">{files.map((file) => <FileRow file={file} key={file.id} onPreview={() => setPreviewFile(file)} />)}</div>}</section>
    </div>
    {uploadError && <div className="mt-5 rounded-lg border border-[#e7c9c1] bg-[#fff8f6] px-4 py-3 text-sm text-[#8b3f34]" data-testid="text-upload-error">{uploadError}</div>}
    {showUpload && <UploadModal projectId={projectId} onClose={() => setShowUpload(false)} onError={setUploadError} onComplete={() => { setShowUpload(false); setNotice('File shared with the room.'); filesQuery.refetch(); setUploadError(''); }} />}
     {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
  </div>;
}

function RoomSkeleton() { return <div className="animate-pulse space-y-8" data-testid="state-room-loading"><div className="h-3 w-36 rounded bg-[#ded9ce]" /><div className="h-14 w-80 rounded bg-[#ded9ce]" /><div className="grid gap-5 xl:grid-cols-2"><div className="h-64 rounded-2xl bg-[#ded9ce]" /><div className="h-64 rounded-2xl bg-[#ded9ce]" /></div></div>; }

function FileRow({ file, onPreview }: { file: ProjectFile; onPreview: () => void }) {
  const icon = file.contentType.includes('image') ? <FileImage className="size-5" /> : file.contentType.includes('spreadsheet') || file.contentType.includes('csv') ? <FileSpreadsheet className="size-5" /> : file.contentType.includes('zip') || file.contentType.includes('archive') ? <FileArchive className="size-5" /> : file.contentType.includes('pdf') || file.contentType.includes('text') ? <FileText className="size-5" /> : <File className="size-5" />;
  return <button type="button" onClick={onPreview} className="group flex w-full items-center gap-4 py-4 text-left hover:bg-[#fbfaf7]" data-testid={`button-file-${file.id}`} aria-label={`Review ${file.name}`}><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#f4f1ea] text-[#3d8c7a]">{icon}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#202b3c]" data-testid={`text-file-name-${file.id}`}>{file.name}</p><p className="mt-1 text-xs text-[#64707c]">{formatBytes(file.size)} <span className="mx-1 text-[#c8c2b6]">·</span> {file.uploadedBy} <span className="mx-1 text-[#c8c2b6]">·</span> {formatRelative(file.uploadedAt)}</p></div><span className="hidden rounded-full bg-[#f7efc9] px-2 py-1 font-mono text-[9px] uppercase tracking-[.08em] text-[#987515] sm:inline">{file.uploadedByRole === 'tl' ? 'TL upload' : 'Member upload'}</span><ArrowUpRight className="size-4 text-[#9b9a96] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#3d8c7a]" /></button>;
}

function FilePreviewModal({ file, onClose }: { file: ProjectFile; onClose: () => void }) {
  const { getToken } = useAuth();
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; url?: string; text?: string; message?: string }>({ status: 'loading' });
  const fileUrl = `/api/storage${file.objectPath}`;
  const isText = file.contentType.startsWith('text/') || file.contentType.includes('json') || file.contentType.includes('xml') || file.contentType.includes('csv');

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    const load = async () => {
      try {
        const token = await getToken();
        const response = await fetch(fileUrl, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) throw new Error(`Unable to load file (${response.status}).`);
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (isText) {
          const text = await blob.text();
          if (active) setState({ status: 'ready', url: objectUrl, text });
        } else if (active) {
          setState({ status: 'ready', url: objectUrl });
        }
      } catch (error) {
        if (active) setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to load this file.' });
      }
    };
    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl, getToken, isText]);

  const downloadFile = () => {
    if (!state.url) return;
    const link = document.createElement('a');
    link.href = state.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#202b3c]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" data-testid="dialog-file-preview">
    <div className="flex max-h-[calc(100dvh-32px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#d8d3c9] bg-[#fbfaf7] shadow-[0_24px_80px_rgba(32,43,60,.28)]">
      <div className="flex items-center justify-between gap-4 border-b border-[#e6e0d5] px-5 py-4">
        <div className="min-w-0"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#3d8c7a]">File review</p><h2 className="mt-1 truncate text-lg font-extrabold text-[#202b3c]" data-testid="heading-file-preview">{file.name}</h2></div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={downloadFile} disabled={!state.url} className="inline-flex items-center gap-2 rounded-lg border border-[#d8d3c9] px-3 py-2 text-xs font-bold text-[#202b3c] hover:bg-[#f1ede4] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-download-file"><Download className="size-3.5" /> Download</button>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#64707c] hover:bg-[#eee9df] hover:text-[#202b3c]" aria-label="Close file preview" data-testid="button-close-file-preview"><X className="size-4" /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#f4f1ea] p-4 sm:p-6">
        {state.status === 'loading' && <div className="grid min-h-[360px] place-items-center text-sm text-[#64707c]" data-testid="state-file-preview-loading"><LoaderCircle className="mr-2 inline size-4 animate-spin" /> Loading secure preview…</div>}
        {state.status === 'error' && <div className="grid min-h-[360px] place-items-center text-center" data-testid="state-file-preview-error"><div><CircleAlert className="mx-auto size-8 text-[#b94d3f]" /><p className="mt-3 font-bold text-[#202b3c]">This file could not be reviewed.</p><p className="mt-2 text-sm text-[#64707c]">{state.message}</p></div></div>}
        {state.status === 'ready' && file.contentType.startsWith('image/') && state.url && <img src={state.url} alt={file.name} className="mx-auto max-h-[calc(100dvh-190px)] max-w-full rounded-xl object-contain shadow-sm" data-testid="preview-image" />}
        {state.status === 'ready' && file.contentType === 'application/pdf' && state.url && <iframe src={state.url} title={`Preview of ${file.name}`} className="h-[min(70vh,760px)] w-full rounded-xl border border-[#d8d3c9] bg-white" data-testid="preview-pdf" />}
        {state.status === 'ready' && isText && <pre className="mx-auto max-w-4xl whitespace-pre-wrap break-words rounded-xl border border-[#d8d3c9] bg-white p-5 font-mono text-xs leading-6 text-[#202b3c]" data-testid="preview-text">{state.text}</pre>}
        {state.status === 'ready' && !file.contentType.startsWith('image/') && file.contentType !== 'application/pdf' && !isText && <div className="grid min-h-[360px] place-items-center text-center" data-testid="state-file-preview-download-only"><div><File className="mx-auto size-10 text-[#3d8c7a]" /><p className="mt-4 font-bold text-[#202b3c]">Preview is not available for this file type.</p><p className="mt-2 text-sm text-[#64707c]">Download the file to review it in the appropriate application.</p><button type="button" onClick={downloadFile} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#202b3c] px-4 py-2.5 text-sm font-bold text-[#fbfaf7]" data-testid="button-download-file-only"><Download className="size-4" /> Download the file</button></div></div>}
      </div>
    </div>
  </div>;
}

function UploadModal({ projectId, onClose, onComplete, onError }: { projectId: string; onClose: () => void; onComplete: () => void; onError: (message: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestUploadUrl = useRequestUploadUrl();
  const createFile = useCreateProjectFile();
  const [selected, setSelected] = useState<File | null>(null);
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'uploading' | 'recording'>('idle');
  const [error, setError] = useState('');
  const submit = async () => {
    if (!selected) { setError('Choose a file first.'); return; }
    setError('');
    try {
      setPhase('requesting');
      const contentType = selected.type || 'application/octet-stream';
      const response = await requestUploadUrl.mutateAsync({ data: { name: selected.name, size: selected.size, contentType } });
      setPhase('uploading');
      const upload = await fetch(response.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: selected });
      if (!upload.ok) throw new Error('The direct upload did not complete.');
      setPhase('recording');
      await createFile.mutateAsync({ projectId, data: { name: selected.name, size: selected.size, contentType, objectPath: response.objectPath } });
      onComplete();
    } catch (uploadError) {
      const message = errorText(uploadError);
      setError(message);
      onError(message);
      setPhase('idle');
    }
  };
  const pending = phase !== 'idle';
  return <Modal title="Share a file" eyebrow="Direct upload" onClose={pending ? () => undefined : onClose}>
    <p className="mb-6 text-sm leading-6 text-[#64707c]">Files move directly to secure storage, then their metadata is recorded in this room.</p>
    <input ref={inputRef} type="file" className="hidden" onChange={(event) => setSelected(event.target.files?.[0] ?? null)} data-testid="input-upload-file" />
    <button type="button" disabled={pending} onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#bdb7aa] bg-[#f8f5ee] px-5 py-10 text-center transition-colors hover:border-[#3d8c7a] hover:bg-[#edf8f5] disabled:cursor-not-allowed" data-testid="button-choose-file">
      <span className="grid size-12 place-items-center rounded-xl bg-[#f7c948] text-[#202b3c]"><UploadCloud className="size-6" /></span>
      <span className="mt-4 text-sm font-bold text-[#202b3c]">{selected ? selected.name : 'Choose a file from your device'}</span>
      <span className="mt-1 text-xs text-[#64707c]">{selected ? `${formatBytes(selected.size)} · ready to share` : 'Any file type · direct to storage'}</span>
    </button>
    {error && <p className="mt-3 text-xs font-semibold text-[#b94d3f]" data-testid="text-upload-modal-error">{error}</p>}
    {pending && <div className="mt-4 rounded-lg bg-[#edf8f5] px-3 py-2 text-xs text-[#286856]" data-testid="status-upload-progress"><LoaderCircle className="mr-2 inline size-3.5 animate-spin" />{phase === 'requesting' ? 'Securing an upload slot…' : phase === 'uploading' ? 'Sending file directly…' : 'Adding file to the room…'}</div>}
    <div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={onClose} disabled={pending} data-testid="button-cancel-upload">Cancel</Button><Button variant="yellow" onClick={submit} disabled={pending || !selected} data-testid="button-submit-upload">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{pending ? 'Sharing…' : 'Share file'}</Button></div>
  </Modal>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingPage />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <AppShell>{children}</AppShell>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUser.current !== undefined && previousUser.current !== userId) {
        client.clear();
      }
      previousUser.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={Landing} />
    <Route path="/sign-in/*?" component={() => <AuthPage mode="sign-in" />} />
    <Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} />
    <Route path="/dashboard">{() => <ProtectedRoute><Dashboard /></ProtectedRoute>}</Route>
    <Route path="/projects/:projectId">{() => <ProtectedRoute><ProjectRoom /></ProtectedRoute>}</Route>
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function ClerkApp() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Open your project rooms' } }, signUp: { start: { title: 'Create your CloudShield account', subtitle: 'Keep the signal moving' } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}><QueryClientProvider client={queryClient}><ClerkQueryClientCacheInvalidator /><Router /></QueryClientProvider></ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkApp /></WouterRouter>;
}

export default App;