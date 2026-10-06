import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { registerSW } from "virtual:pwa-register";
import { AuthProvider, RequireAuth, useAuth } from "./auth";
import { OrgLayout } from "./components/shell";
import "./styles/index.css";

registerSW({ immediate: true });

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (typeof sentryDsn === "string" && sentryDsn.length > 0) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
  });
}

const SignInPage = lazy(() =>
  import("./pages/sign-in").then((mod) => ({ default: mod.SignInPage })),
);
const OnboardingPage = lazy(() =>
  import("./pages/onboarding").then((mod) => ({ default: mod.OnboardingPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/dashboard").then((mod) => ({ default: mod.DashboardPage })),
);
const MorePage = lazy(() => import("./pages/dashboard").then((mod) => ({ default: mod.MorePage })));
const OpportunitiesPage = lazy(() =>
  import("./pages/opportunities").then((mod) => ({ default: mod.OpportunitiesPage })),
);
const OpportunityDetailPage = lazy(() =>
  import("./pages/opportunities").then((mod) => ({ default: mod.OpportunityDetailPage })),
);
const ApplicationsPage = lazy(() =>
  import("./pages/applications").then((mod) => ({ default: mod.ApplicationsPage })),
);
const ApplicationDetailPage = lazy(() =>
  import("./pages/applications").then((mod) => ({ default: mod.ApplicationDetailPage })),
);
const CalendarPage = lazy(() =>
  import("./pages/calendar").then((mod) => ({ default: mod.CalendarPage })),
);
const DocumentsPage = lazy(() =>
  import("./pages/documents").then((mod) => ({ default: mod.DocumentsPage })),
);
const ContentListPage = lazy(() =>
  import("./pages/content").then((mod) => ({ default: mod.ContentListPage })),
);
const ContentEditorPage = lazy(() =>
  import("./pages/content").then((mod) => ({ default: mod.ContentEditorPage })),
);
const CompliancePage = lazy(() =>
  import("./pages/compliance").then((mod) => ({ default: mod.CompliancePage })),
);
const SettingsPage = lazy(() =>
  import("./pages/settings").then((mod) => ({ default: mod.SettingsPage })),
);
const AccountPage = lazy(() =>
  import("./pages/account").then((mod) => ({ default: mod.AccountPage })),
);
const AdminPage = lazy(() => import("./pages/admin").then((mod) => ({ default: mod.AdminPage })));
const RfpReviewPage = lazy(() =>
  import("./pages/rfp-review").then((mod) => ({ default: mod.RfpReviewPage })),
);
const DataPackPage = lazy(() =>
  import("./pages/data").then((mod) => ({ default: mod.DataPackPage })),
);
const AwardsPage = lazy(() =>
  import("./pages/awards").then((mod) => ({ default: mod.AwardsPage })),
);
const AwardDetailPage = lazy(() =>
  import("./pages/awards").then((mod) => ({ default: mod.AwardDetailPage })),
);
const MatchPage = lazy(() => import("./pages/match").then((mod) => ({ default: mod.MatchPage })));
const RelationshipsPage = lazy(() =>
  import("./pages/relationships").then((mod) => ({ default: mod.RelationshipsPage })),
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Home() {
  const { me, orgs, loading } = useAuth();
  if (loading) return <p className="p-4">Loading your workspace…</p>;
  if (!me) return <Navigate to="/sign-in" replace />;
  if (orgs.length === 0) return <Navigate to="/onboarding" replace />;
  const active = orgs.find((org) => org.id === me.lastActiveOrgId) ?? orgs[0];
  if (!active) return <Navigate to="/onboarding" replace />;
  return <Navigate to={`/o/${active.slug}`} replace />;
}

function Fallback() {
  return <p className="p-4">Loading…</p>;
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element missing");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename="/app">
          <Suspense fallback={<Fallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/sign-in" element={<SignInPage />} />
              <Route
                path="/onboarding"
                element={
                  <RequireAuth>
                    <OnboardingPage />
                  </RequireAuth>
                }
              />
              <Route path="/me" element={<AccountPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route
                path="/o/:orgSlug"
                element={
                  <OrgLayout>
                    <DashboardPage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/more"
                element={
                  <OrgLayout>
                    <MorePage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/opportunities"
                element={
                  <OrgLayout>
                    <OpportunitiesPage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/opportunities/:slug"
                element={
                  <OrgLayout>
                    <OpportunityDetailPage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/applications"
                element={
                  <OrgLayout>
                    <ApplicationsPage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/rfp/:parseId"
                element={
                  <OrgLayout>
                    <RfpReviewPage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/data"
                element={
                  <OrgLayout>
                    <DataPackPage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/awards"
                element={
                  <OrgLayout>
                    <AwardsPage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/awards/:awardId"
                element={
                  <OrgLayout>
                    <AwardDetailPage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/match"
                element={
                  <OrgLayout>
                    <MatchPage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/relationships"
                element={
                  <OrgLayout>
                    <RelationshipsPage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/applications/:id"
                element={
                  <OrgLayout>
                    <ApplicationDetailPage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/calendar"
                element={
                  <OrgLayout>
                    <CalendarPage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/documents"
                element={
                  <OrgLayout>
                    <DocumentsPage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/content"
                element={
                  <OrgLayout>
                    <ContentListPage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/content/:id"
                element={
                  <OrgLayout>
                    <ContentEditorPage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/compliance"
                element={
                  <OrgLayout>
                    <CompliancePage />
                  </OrgLayout>
                }
              />
              <Route
                path="/o/:orgSlug/settings"
                element={
                  <OrgLayout>
                    <SettingsPage />
                  </OrgLayout>
                }
              />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
