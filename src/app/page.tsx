import { getCurrentUser } from "@/lib/auth";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { FeatureStrip } from "@/components/landing/feature-strip";
import { HowItWorks } from "@/components/landing/how-it-works";
import { RiskScoring } from "@/components/landing/risk-scoring";
import { AnalysisPipeline } from "@/components/landing/analysis-pipeline";
import { Limitations } from "@/components/landing/limitations";
import { Footer } from "@/components/landing/footer";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser().catch(() => null);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] selection:bg-[var(--accent-coral)] selection:text-[var(--accent-text)]">
      {/* Sticky Top Navbar */}
      <Navbar user={user} />

      {/* Auth Status Notice if redirected from protected route */}
      {params.auth && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
          {params.auth === "required" ? (
            <div
              role="status"
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-4 text-[13px] text-[var(--text-secondary)] flex items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-[var(--accent-coral)]" />
                <span>Sign in with Google to access your ImpactGraph repository workspace.</span>
              </div>
              <a
                href="/api/auth/google"
                className="font-mono text-xs font-bold text-[var(--accent-coral)] hover:underline shrink-0"
              >
                Sign In Now →
              </a>
            </div>
          ) : (
            <div
              role="alert"
              className="rounded-xl border border-[var(--danger)]/50 bg-[var(--surface-primary)] p-4 text-[13px] text-[var(--danger)] flex items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-[var(--danger)]" />
                <span>
                  {params.auth === "database"
                    ? "Database connection failed during authentication. Verify DATABASE_URL."
                    : "Google sign-in could not be completed. Check OAuth credentials and callback URL."}
                </span>
              </div>
              <a
                href="/api/auth/google"
                className="font-mono text-xs font-bold text-[var(--danger)] hover:underline shrink-0"
              >
                Retry Sign In →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Main Landing Page Sections */}
      <main id="main-content">
        {/* Hero Section */}
        <Hero user={user} />

        {/* Feature Strip */}
        <FeatureStrip />

        {/* How It Works Section + PR Analysis Report Card */}
        <HowItWorks />

        {/* Risk Scoring at a Glance */}
        <RiskScoring />

        {/* Analysis Capabilities & Pipeline */}
        <AnalysisPipeline />

        {/* Limitations & Transparency */}
        <Limitations />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
