import { addMoney, formatMoney } from "@se-grants/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useOrg } from "../auth";
import { canEdit } from "../components/shell";
import { Button, Card, Empty, Field, Notice, Page, controlClass } from "../components/ui";
import { api } from "../lib/api";
import { when } from "../lib/format";
import {
  categoryLabel,
  messageFrom,
  paymentLabel,
  reimbursementLabel,
  reportKindLabel,
  todayInput,
  toIso,
} from "../lib/money-labels";

type Award = {
  id: string;
  applicationId: string;
  title: string;
  amount: string | null;
  startDate: string | null;
  endDate: string | null;
  paymentType: string;
  isFederal: boolean;
};

type Application = { id: string; title: string; status: string };

type FederalSpend = {
  fiscalYearLabel: string;
  federalSpent: string;
  threshold: string;
  over: boolean;
  remaining: string;
};

type Line = {
  id: string;
  category: string;
  description: string;
  budgeted: string | null;
  isMatch: boolean;
  spent: string;
};

type Spend = {
  id: string;
  budgetLineId: string;
  date: string | null;
  amount: string | null;
  vendor: string;
  description: string;
  reimbursementRequestId: string | null;
};

type RequestRow = {
  id: string;
  periodStart: string | null;
  periodEnd: string | null;
  amount: string | null;
  status: string;
  expectedPaidAt: string | null;
};

type ReportRow = {
  id: string;
  kind: string;
  dueAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
  generatedDocumentId: string | null;
};

type MetricRow = {
  id: string;
  name: string;
  target: string | null;
  unit: string;
  entries: { id: string; value: string | null; date: string | null; note: string }[];
};

type Forecast = {
  kind: string;
  note: string;
  notYetRequested: string;
  awaiting: { id: string; amount: string | null; expectedPaidAt: string | null }[];
};

type AwardDetail = Award & {
  assistanceListing: string | null;
  matchRequiredAmount: string | null;
  restrictions: string | null;
  budgetLines: Line[];
  expenditures: Spend[];
  reimbursements: RequestRow[];
  reports: ReportRow[];
  metrics: MetricRow[];
  matchLogged: string;
  forecast: Forecast;
};

const categories = [
  "PERSONNEL",
  "FRINGE",
  "TRAVEL",
  "FREIGHT",
  "EQUIPMENT",
  "SUPPLIES",
  "CONTRACTUAL",
  "CONSTRUCTION",
  "OTHER",
  "INDIRECT",
] as const;

export function AwardsPage() {
  const org = useOrg();
  const [search] = useSearchParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const awards = useQuery({
    queryKey: ["awards", org?.id],
    enabled: Boolean(org),
    queryFn: () => api<{ items: Award[] }>(`/orgs/${org?.id}/awards`),
  });
  const applications = useQuery({
    queryKey: ["applications", org?.id],
    enabled: Boolean(org),
    queryFn: () => api<{ items: Application[] }>(`/orgs/${org?.id}/applications`),
  });
  const federal = useQuery({
    queryKey: ["federal-spend", org?.id],
    enabled: Boolean(org),
    queryFn: () => api<FederalSpend>(`/orgs/${org?.id}/awards/federal-spend`),
  });
  if (!org) return null;
  const organization = org;
  const ready = (applications.data?.items ?? []).filter(
    (item) =>
      item.status === "AWARDED" &&
      !(awards.data?.items ?? []).some((award) => award.applicationId === item.id),
  );
  const preset = search.get("application") ?? ready[0]?.id ?? "";

  return (
    <Page
      title="Awards"
      lede="Budgets, receipts, and the money still waiting to come back from a funder."
    >
      {error ? <Notice>{error}</Notice> : null}
      {federal.data ? (
        <Card className="mb-4">
          <h2 className="text-lg font-semibold">
            Federal spending, {federal.data.fiscalYearLabel}
          </h2>
          <p className="mt-2 text-sm">
            {formatMoney(federal.data.federalSpent)} spent on federal awards. The Single Audit
            threshold is {formatMoney(federal.data.threshold)}.{" "}
            {federal.data.over
              ? "This year is over that threshold."
              : `${formatMoney(federal.data.remaining)} remains under it.`}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            This is a running total. It does not create a compliance item.
          </p>
        </Card>
      ) : null}
      {(awards.data?.items.length ?? 0) === 0 ? (
        <Empty title="No awards yet">
          <p>Mark an application awarded, then set up the budget here.</p>
        </Empty>
      ) : (
        <ul className="space-y-2">
          {(awards.data?.items ?? []).map((award) => (
            <li key={award.id}>
              <Link
                className="flex min-h-11 flex-col justify-center rounded-lg border border-line bg-white px-4 py-3"
                to={`/o/${organization.slug}/awards/${award.id}`}
              >
                <span className="font-medium">{award.title}</span>
                <span className="text-sm text-ink-soft">
                  {formatMoney(award.amount)} · {paymentLabel(award.paymentType)}
                  {award.isFederal ? " · Federal" : ""} · {when(award.startDate)} to{" "}
                  {when(award.endDate)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {canEdit(organization.role) && ready.length > 0 ? (
        <AwardSetup
          orgId={organization.id}
          applications={ready}
          preset={preset}
          onSaved={async () => {
            setError(null);
            await queryClient.invalidateQueries({ queryKey: ["awards", organization.id] });
          }}
          onError={setError}
        />
      ) : null}
    </Page>
  );
}

function AwardSetup({
  orgId,
  applications,
  preset,
  onSaved,
  onError,
}: {
  orgId: string;
  applications: Application[];
  preset: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [applicationId, setApplicationId] = useState(preset);
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(todayInput());
  const [endDate, setEndDate] = useState(todayInput());
  const [paymentType, setPaymentType] = useState("REIMBURSEMENT");
  const [isFederal, setIsFederal] = useState(false);
  const [assistanceListing, setAssistanceListing] = useState("");
  const [matchRequiredAmount, setMatchRequiredAmount] = useState("");
  const [restrictions, setRestrictions] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`/orgs/${orgId}/awards`, {
        method: "POST",
        json: {
          applicationId,
          amount,
          startDate,
          endDate,
          paymentType,
          isFederal,
          assistanceListing: assistanceListing.trim() || null,
          matchRequiredAmount: matchRequiredAmount.trim() || null,
          restrictions: restrictions.trim() || null,
          agreementDocumentId: null,
        },
      });
      await onSaved();
    } catch (error) {
      onError(messageFrom(error));
    }
  }

  return (
    <form className="mt-6" onSubmit={(event) => void submit(event)}>
      <h2 className="text-lg font-semibold">Set up an award</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Saving an award is separate from marking the application awarded.
      </p>
      <Field label="Awarded application">
        <select
          className={controlClass}
          value={applicationId}
          onChange={(event) => setApplicationId(event.target.value)}
          required
        >
          {applications.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Award amount">
        <input
          className={controlClass}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="10000.00"
          required
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start date">
          <input
            className={controlClass}
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
        </Field>
        <Field label="End date">
          <input
            className={controlClass}
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            required
          />
        </Field>
      </div>
      <Field label="How the funder pays">
        <select
          className={controlClass}
          value={paymentType}
          onChange={(event) => setPaymentType(event.target.value)}
        >
          <option value="REIMBURSEMENT">Reimbursement</option>
          <option value="ADVANCE">Paid up front</option>
          <option value="MIXED">Mixed</option>
        </select>
      </Field>
      <label className="mb-4 flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isFederal}
          onChange={(event) => setIsFederal(event.target.checked)}
        />
        Federal award
      </label>
      <Field label="Assistance listing" hint="Optional. Used on federal awards.">
        <input
          className={controlClass}
          value={assistanceListing}
          onChange={(event) => setAssistanceListing(event.target.value)}
        />
      </Field>
      <Field label="Match required" hint="Leave blank if the funder did not require match.">
        <input
          className={controlClass}
          value={matchRequiredAmount}
          onChange={(event) => setMatchRequiredAmount(event.target.value)}
          placeholder="0.00"
        />
      </Field>
      <Field label="Restrictions">
        <textarea
          className={controlClass}
          value={restrictions}
          onChange={(event) => setRestrictions(event.target.value)}
        />
      </Field>
      <Button type="submit">Save award</Button>
    </form>
  );
}

export function AwardDetailPage() {
  const org = useOrg();
  const { awardId = "" } = useParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["award", org?.id, awardId],
    enabled: Boolean(org && awardId),
    queryFn: () => api<AwardDetail>(`/orgs/${org?.id}/awards/${awardId}`),
  });
  if (!org) return null;
  const organization = org;
  const award = detail.data;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["award", organization.id, awardId] });
    await queryClient.invalidateQueries({ queryKey: ["federal-spend", organization.id] });
  }

  return (
    <Page title={award?.title ?? "Award"} lede={award ? paymentLabel(award.paymentType) : ""}>
      <p className="mb-4 text-sm">
        <Link to={`/o/${organization.slug}/awards`}>All awards</Link>
      </p>
      {error ? <Notice>{error}</Notice> : null}
      {note ? <Notice>{note}</Notice> : null}
      {!award ? <p>Loading the award…</p> : null}
      {award ? (
        <>
          <Card>
            <p>
              {formatMoney(award.amount)} from {when(award.startDate)} to {when(award.endDate)}
              {award.isFederal ? " · Federal" : ""}
            </p>
            {award.matchRequiredAmount ? (
              <p className="mt-1 text-sm">
                Match required {formatMoney(award.matchRequiredAmount)}. Logged{" "}
                {formatMoney(award.matchLogged)}.
              </p>
            ) : null}
            <h2 className="mt-4 text-lg font-semibold">Cash coming back</h2>
            <p className="mt-1 text-sm">{award.forecast.note}</p>
            {award.forecast.kind === "reimbursement" ? (
              <>
                <p className="mt-2 text-sm">
                  Not yet requested: {formatMoney(award.forecast.notYetRequested)}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {award.forecast.awaiting.map((row) => (
                    <li key={row.id}>
                      Awaiting {formatMoney(row.amount)}
                      {row.expectedPaidAt ? ` · expected ${when(row.expectedPaidAt)}` : ""}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Card>
          <BudgetSection
            award={award}
            orgId={organization.id}
            canChange={canEdit(organization.role)}
            onSaved={refresh}
            onError={setError}
          />
          <ReportSection
            award={award}
            orgId={organization.id}
            canChange={canEdit(organization.role)}
            onSaved={refresh}
            onError={setError}
            onNote={setNote}
          />
        </>
      ) : null}
    </Page>
  );
}

function BudgetSection({
  award,
  orgId,
  canChange,
  onSaved,
  onError,
}: {
  award: AwardDetail;
  orgId: string;
  canChange: boolean;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [category, setCategory] = useState<string>("SUPPLIES");
  const [description, setDescription] = useState("");
  const [budgeted, setBudgeted] = useState("");
  const [isMatch, setIsMatch] = useState(false);
  const [budgetLineId, setBudgetLineId] = useState(award.budgetLines[0]?.id ?? "");
  const [spendDate, setSpendDate] = useState(todayInput());
  const [spendAmount, setSpendAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [spendDescription, setSpendDescription] = useState("");
  const [periodStart, setPeriodStart] = useState(todayInput());
  const [periodEnd, setPeriodEnd] = useState(todayInput());
  const [requestAmount, setRequestAmount] = useState("");
  const [requestStatus, setRequestStatus] = useState("SUBMITTED");
  const [expectedPaidAt, setExpectedPaidAt] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const openReceipts = award.expenditures.filter((row) => !row.reimbursementRequestId);
  const selectedSum = addMoney(
    openReceipts.filter((row) => selected.includes(row.id)).map((row) => row.amount),
  );

  async function addLine(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`/orgs/${orgId}/awards/${award.id}/budget-lines`, {
        method: "POST",
        json: { category, description, budgeted, isMatch },
      });
      setDescription("");
      setBudgeted("");
      await onSaved();
    } catch (error) {
      onError(messageFrom(error));
    }
  }

  async function addSpend(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`/orgs/${orgId}/awards/${award.id}/expenditures`, {
        method: "POST",
        json: {
          budgetLineId: budgetLineId || award.budgetLines[0]?.id,
          date: spendDate,
          amount: spendAmount,
          vendor,
          description: spendDescription,
          receiptDocumentId: null,
        },
      });
      setSpendAmount("");
      setVendor("");
      setSpendDescription("");
      await onSaved();
    } catch (error) {
      onError(messageFrom(error));
    }
  }

  async function addRequest(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`/orgs/${orgId}/awards/${award.id}/reimbursements`, {
        method: "POST",
        json: {
          periodStart,
          periodEnd,
          amount: requestAmount,
          status: requestStatus,
          expectedPaidAt: toIso(expectedPaidAt),
          expenditureIds: selected,
        },
      });
      setRequestAmount("");
      setSelected([]);
      await onSaved();
    } catch (error) {
      onError(messageFrom(error));
    }
  }

  return (
    <section className="mt-6 space-y-4">
      <h2 className="text-lg font-semibold">Budget and spending</h2>
      <ul className="space-y-2">
        {award.budgetLines.map((line) => (
          <li key={line.id} className="rounded-lg border border-line bg-white px-4 py-3 text-sm">
            {line.description} · {categoryLabel(line.category)} · budgeted{" "}
            {formatMoney(line.budgeted)} · spent {formatMoney(line.spent)}
            {line.isMatch ? " · match" : ""}
          </li>
        ))}
      </ul>
      {canChange ? (
        <form onSubmit={(event) => void addLine(event)}>
          <Field label="Budget line">
            <input
              className={controlClass}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </Field>
          <Field label="Category">
            <select
              className={controlClass}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((value) => (
                <option key={value} value={value}>
                  {categoryLabel(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Budgeted amount">
            <input
              className={controlClass}
              value={budgeted}
              onChange={(event) => setBudgeted(event.target.value)}
              required
            />
          </Field>
          <label className="mb-4 flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isMatch}
              onChange={(event) => setIsMatch(event.target.checked)}
            />
            This line is match
          </label>
          <Button type="submit">Add budget line</Button>
        </form>
      ) : null}
      <h3 className="text-base font-semibold">Receipts</h3>
      <ul className="space-y-2 text-sm">
        {award.expenditures.map((row) => (
          <li key={row.id}>
            {when(row.date)} · {row.vendor} · {formatMoney(row.amount)} · {row.description}
          </li>
        ))}
      </ul>
      {canChange && award.budgetLines.length > 0 ? (
        <form onSubmit={(event) => void addSpend(event)}>
          <Field label="Budget line for this receipt">
            <select
              className={controlClass}
              value={budgetLineId || award.budgetLines[0]?.id}
              onChange={(event) => setBudgetLineId(event.target.value)}
            >
              {award.budgetLines.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.description}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              className={controlClass}
              type="date"
              value={spendDate}
              onChange={(event) => setSpendDate(event.target.value)}
              required
            />
          </Field>
          <Field label="Amount">
            <input
              className={controlClass}
              value={spendAmount}
              onChange={(event) => setSpendAmount(event.target.value)}
              required
            />
          </Field>
          <Field label="Vendor">
            <input
              className={controlClass}
              value={vendor}
              onChange={(event) => setVendor(event.target.value)}
              required
            />
          </Field>
          <Field label="What was this for?">
            <input
              className={controlClass}
              value={spendDescription}
              onChange={(event) => setSpendDescription(event.target.value)}
              required
            />
          </Field>
          <Button type="submit">Add expenditure</Button>
        </form>
      ) : null}
      {award.forecast.kind === "reimbursement" && canChange ? (
        <form onSubmit={(event) => void addRequest(event)}>
          <h3 className="text-base font-semibold">Reimbursement request</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Type the amount you are asking for. It is not filled in from the receipts.
          </p>
          {selected.length > 0 ? (
            <p className="mt-1 text-sm">
              Selected receipts add up to {formatMoney(selectedSum)}. The request uses the amount
              you type.
            </p>
          ) : null}
          <div className="mt-3 space-y-2">
            {openReceipts.map((row) => (
              <label key={row.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(row.id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, row.id]
                        : current.filter((id) => id !== row.id),
                    )
                  }
                />
                {row.vendor} · {formatMoney(row.amount)}
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Period start">
              <input
                className={controlClass}
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
                required
              />
            </Field>
            <Field label="Period end">
              <input
                className={controlClass}
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
                required
              />
            </Field>
          </div>
          <Field label="Amount requested">
            <input
              className={controlClass}
              value={requestAmount}
              onChange={(event) => setRequestAmount(event.target.value)}
              required
            />
          </Field>
          <Field label="Status">
            <select
              className={controlClass}
              value={requestStatus}
              onChange={(event) => setRequestStatus(event.target.value)}
            >
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="PAID">Paid</option>
              <option value="CANCELED">Canceled</option>
            </select>
          </Field>
          <Field label="Expected payment" hint="Optional.">
            <input
              className={controlClass}
              type="datetime-local"
              value={expectedPaidAt}
              onChange={(event) => setExpectedPaidAt(event.target.value)}
            />
          </Field>
          <Button type="submit">Save reimbursement request</Button>
        </form>
      ) : null}
      <ul className="space-y-1 text-sm">
        {award.reimbursements.map((row) => (
          <li key={row.id}>
            {reimbursementLabel(row.status)} · {formatMoney(row.amount)} · {when(row.periodStart)}{" "}
            to {when(row.periodEnd)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReportSection({
  award,
  orgId,
  canChange,
  onSaved,
  onError,
  onNote,
}: {
  award: AwardDetail;
  orgId: string;
  canChange: boolean;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
  onNote: (message: string) => void;
}) {
  const [kind, setKind] = useState("PROGRESS");
  const [dueAt, setDueAt] = useState("");
  const [periodStart, setPeriodStart] = useState(award.startDate ?? todayInput());
  const [periodEnd, setPeriodEnd] = useState(award.endDate ?? todayInput());
  const [metricName, setMetricName] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");

  async function addReport(event: FormEvent) {
    event.preventDefault();
    const due = toIso(dueAt);
    if (!due) {
      onError("Choose when the report is due.");
      return;
    }
    try {
      await api(`/orgs/${orgId}/awards/${award.id}/reports`, {
        method: "POST",
        json: { kind, dueAt: due, periodStart, periodEnd },
      });
      await onSaved();
    } catch (error) {
      onError(messageFrom(error));
    }
  }

  async function generate(reportId: string) {
    try {
      await api(`/orgs/${orgId}/awards/${award.id}/reports/${reportId}/generate`, {
        method: "POST",
      });
      onNote("A draft was saved in Documents. It is not marked submitted.");
      await onSaved();
    } catch (error) {
      onError(messageFrom(error));
    }
  }

  async function submit(reportId: string) {
    try {
      await api(`/orgs/${orgId}/awards/${award.id}/reports/${reportId}/submit`, {
        method: "POST",
      });
      onNote("Marked submitted.");
      await onSaved();
    } catch (error) {
      onError(messageFrom(error));
    }
  }

  async function addMetric(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`/orgs/${orgId}/awards/${award.id}/metrics`, {
        method: "POST",
        json: { name: metricName, target, unit },
      });
      setMetricName("");
      setTarget("");
      setUnit("");
      await onSaved();
    } catch (error) {
      onError(messageFrom(error));
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Reports</h2>
      <ul className="mt-3 space-y-3">
        {award.reports.map((report) => (
          <li key={report.id} className="rounded-lg border border-line bg-white px-4 py-3 text-sm">
            <p>
              {reportKindLabel(report.kind)} · due {when(report.dueAt)} ·{" "}
              {report.status === "SUBMITTED" ? "Submitted" : "Open"}
            </p>
            {canChange && report.status !== "SUBMITTED" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button onClick={() => void generate(report.id)}>Generate draft</Button>
                <Button tone="quiet" onClick={() => void submit(report.id)}>
                  Mark submitted
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {canChange ? (
        <form className="mt-4" onSubmit={(event) => void addReport(event)}>
          <Field label="Report type">
            <select
              className={controlClass}
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="PROGRESS">Progress</option>
              <option value="FINANCIAL">Financial</option>
              <option value="FINAL">Final</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Due">
            <input
              className={controlClass}
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              required
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Period start">
              <input
                className={controlClass}
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
                required
              />
            </Field>
            <Field label="Period end">
              <input
                className={controlClass}
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
                required
              />
            </Field>
          </div>
          <Button type="submit">Add report</Button>
        </form>
      ) : null}
      <h2 className="mt-8 text-lg font-semibold">Measures</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {award.metrics.map((metric) => (
          <li key={metric.id}>
            {metric.name}: {metric.entries[0]?.value ?? "no entry"} / {metric.target} {metric.unit}
            {canChange ? (
              <MetricEntryForm
                orgId={orgId}
                awardId={award.id}
                metricId={metric.id}
                onSaved={onSaved}
                onError={onError}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {canChange ? (
        <form className="mt-4" onSubmit={(event) => void addMetric(event)}>
          <Field label="Measure">
            <input
              className={controlClass}
              value={metricName}
              onChange={(event) => setMetricName(event.target.value)}
              required
            />
          </Field>
          <Field label="Target">
            <input
              className={controlClass}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              required
            />
          </Field>
          <Field label="Unit">
            <input
              className={controlClass}
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              required
            />
          </Field>
          <Button type="submit">Add measure</Button>
        </form>
      ) : null}
    </section>
  );
}

function MetricEntryForm({
  orgId,
  awardId,
  metricId,
  onSaved,
  onError,
}: {
  orgId: string;
  awardId: string;
  metricId: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayInput());
  const [note, setNote] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`/orgs/${orgId}/awards/${awardId}/metrics/${metricId}/entries`, {
        method: "POST",
        json: { value, date, note },
      });
      setValue("");
      setNote("");
      await onSaved();
    } catch (error) {
      onError(messageFrom(error));
    }
  }

  return (
    <form className="mt-2" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          className={controlClass}
          aria-label="Value"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
        />
        <input
          className={controlClass}
          aria-label="Date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
        <input
          className={controlClass}
          aria-label="Note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <Button type="submit">Log progress</Button>
    </form>
  );
}
