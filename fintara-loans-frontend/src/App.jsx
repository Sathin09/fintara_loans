import { useCallback, useEffect, useState } from "react";
import {
  Wallet,
  LogOut,
  RefreshCw,
  FilePlus2,
  ChevronRight,
  Calculator,
  CalendarDays,
  Coins,
  FolderOpen,
} from "lucide-react";

import {
  api,
  clearAccessToken,
  getApiError,
  restoreSession,
  setAccessToken,
} from "./api/client";

import AuthScreen from "./components/AuthScreen";
import LoanForm from "./components/LoanForm";
import LoanTable from "./components/LoanTable";
import SettlementPanel from "./components/SettlementPanel";
import "./App.css";

function payloadFromLoan(loan) {
  return {
    principal: Number(loan.principal),
    annual_rate: Number(loan.annual_rate),
    n: Number(loan.term_months),
    prepayments: loan.prepayments || {},
    late_days: loan.late_days || {},
  };
}

const tabs = [
  { id: "calculator", label: "Loan Calculator", Icon: Calculator },
  { id: "schedule", label: "Repayment Schedule", Icon: CalendarDays },
  { id: "settlement", label: "Early Settlement", Icon: Coins },
  { id: "saved", label: "Saved Loans", Icon: FolderOpen },
];

function formatMoney(value) {
  return `LKR ${Number(value ?? 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [loans, setLoans] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [loanPayload, setLoanPayload] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState("calculator");

  const refreshLoans = useCallback(async () => {
    const { data } = await api.get("/loans");
    setLoans(data.data || []);
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreUserSession() {
      const session = restoreSession();

      if (!session) {
        setInitializing(false);
        return;
      }

      setUser(session.user);
      setLoading(true);
      try {
        const { data } = await api.get("/loans");

        if (active) {
          setLoans(data.data || []);
          setSessionExpiresAt(session.expiresAt);
        }
      } catch (err) {
        if (!active) return;

        if (err.response?.status === 401) {
          clearAccessToken();
          setUser(null);
        } else {
          setPageError(getApiError(err));
          setSessionExpiresAt(session.expiresAt);
        }
      } finally {
        if (active) {
          setLoading(false);
          setInitializing(false);
        }
      }
    }

    void restoreUserSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionExpiresAt) return undefined;

    const timeout = window.setTimeout(() => {
      clearAccessToken();
      setSessionExpiresAt(null);
      setUser(null);
      setLoans([]);
      setSelectedLoan(null);
      setLoanPayload(null);
      setSchedule(null);
      setActiveTab("calculator");
    }, Math.max(sessionExpiresAt - Date.now(), 0));

    return () => window.clearTimeout(timeout);
  }, [sessionExpiresAt]);

  const authenticated = useCallback(async (token, profile, expiresAt) => {
    setAccessToken(token, expiresAt, profile);
    setSessionExpiresAt(Date.parse(expiresAt));
    setUser(profile);
    setPageError("");
    setNotice("");
    setLoading(true);

    try {
      const { data } = await api.get("/loans");
      setLoans(data.data || []);
    } catch (err) {
      setPageError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  async function calculate(payload) {
    setLoading(true);
    setPageError("");
    setNotice("");
    setSelectedLoan(null);
    setSchedule(null);
    setLoanPayload(payload);

    try {
      const { data } = await api.post("/loans/schedule", payload);

      setSchedule(data);
      setActiveTab("schedule");
      setNotice(
        "Schedule calculated successfully. It has not been saved yet."
      );
    } catch (err) {
      setPageError(getApiError(err));
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  }

  async function saveLoan(payload) {
    setLoading(true);
    setPageError("");
    setNotice("");

    try {
      const { data: created } = await api.post("/loans", payload);
      const loan = created.loan;

      setSelectedLoan(loan);
      setLoanPayload(payload);

      await refreshLoans();

      const { data: calculated } = await api.post(
        "/loans/schedule",
        payload
      );

      setSchedule(calculated);
      setActiveTab("schedule");
      setNotice(`Loan ${loan.loan_code} created successfully.`);
    } catch (err) {
      setPageError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function openLoan(loan) {
    setLoading(true);
    setPageError("");
    setNotice("");
    setSelectedLoan(loan);
    setSchedule(null);

    try {
      const payload = payloadFromLoan(loan);

      const { data } = await api.post("/loans/schedule", payload);

      setLoanPayload(payload);
      setSchedule(data);
      setActiveTab("schedule");
      setNotice(`Viewing saved loan ${loan.loan_code}.`);
    } catch (err) {
      setPageError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await api.post("/logout");
    } catch {
      // Clear the local token even if the request fails.
    } finally {
      clearAccessToken();
      setSessionExpiresAt(null);
      setUser(null);
      setLoans([]);
      setSelectedLoan(null);
      setLoanPayload(null);
      setSchedule(null);
      setPageError("");
      setNotice("");
      setActiveTab("calculator");
    }
  }

  if (initializing) {
    return (
      <main className="auth-page">
        <p role="status">Restoring your session...</p>
      </main>
    );
  }

  if (!user) {
    return <AuthScreen onAuthenticated={authenticated} />;
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Wallet size={23} />
          </div>

          <div>
            <h1>Fintara Loans</h1>
            <p>Loan calculation workspace</p>
          </div>
        </div>

        <div className="user-actions">
          <span className="user-label">{user.name}</span>

          <button
            type="button"
            className="secondary-button"
            onClick={logout}
            disabled={loading}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </header>

      <section className="intro">
        <p className="eyebrow">LOAN MANAGEMENT</p>
        <h2>Repayment workspace</h2>
        <p>
          Calculate reducing-balance schedules, track prepayments and
          late penalties, and estimate early-settlement amounts.
        </p>
      </section>

      {pageError && (
        <div className="error-message" role="alert">
          {pageError}
        </div>
      )}

      {notice && (
        <div className="success-message" role="status">
          {notice}
        </div>
      )}

      {loading && (
        <div className="loading-line" role="status">
          <RefreshCw size={16} className="spin" />
          Processing request...
        </div>
      )}

      {/* Workspace navigation */}
      <nav
        className="workspace-tabs"
        role="tablist"
        aria-label="Loan management sections"
      >
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            id={`tab-${id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`panel-${id}`}
            className={`workspace-tab ${
              activeTab === id ? "active" : ""
            }`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Loan calculator */}
      {activeTab === "calculator" && (
        <section
          id="panel-calculator"
          role="tabpanel"
          aria-labelledby="tab-calculator"
          className="workspace-content"
        >
          <LoanForm
            busy={loading}
            onCalculate={calculate}
            onSave={saveLoan}
          />
        </section>
      )}

      {/* Repayment schedule */}
      {activeTab === "schedule" && (
        <section
          id="panel-schedule"
          role="tabpanel"
          aria-labelledby="tab-schedule"
          className="workspace-content"
        >
          {schedule ? (
            <>
              {selectedLoan && (
                <section className="panel loan-meta">
                  <div>
                    <span>Saved loan code</span>
                    <strong>{selectedLoan.loan_code}</strong>
                  </div>

                  <div>
                    <span>Annual interest rate</span>
                    <strong>
                      {Number(selectedLoan.annual_rate).toFixed(4)}%
                    </strong>
                  </div>

                  <div>
                    <span>Term</span>
                    <strong>{selectedLoan.term_months} months</strong>
                  </div>
                </section>
              )}

              <LoanTable schedule={schedule} />
            </>
          ) : (
            <section className="panel empty-state">
              <CalendarDays size={30} />
              <h3>No repayment schedule yet</h3>
              <p>
                Calculate a loan or select a saved loan to view its
                repayment schedule.
              </p>

              <button
                type="button"
                className="primary-button"
                onClick={() => setActiveTab("calculator")}
              >
                <Calculator size={17} />
                Open loan calculator
              </button>
            </section>
          )}
        </section>
      )}

      {/* Early settlement */}
      {activeTab === "settlement" && (
        <section
          id="panel-settlement"
          role="tabpanel"
          aria-labelledby="tab-settlement"
          className="workspace-content"
        >
          {schedule && loanPayload ? (
            <SettlementPanel
              key={selectedLoan?.id ?? "unsaved-loan"}
              loanPayload={loanPayload}
              schedule={schedule}
            />
          ) : (
            <section className="panel empty-state">
              <Coins size={30} />
              <h3>No loan selected</h3>
              <p>
                Calculate a loan or open a saved loan before estimating
                its early-settlement amount.
              </p>

              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  setActiveTab(
                    loans.length > 0 ? "saved" : "calculator"
                  )
                }
              >
                {loans.length > 0
                  ? "Choose a saved loan"
                  : "Calculate a loan"}
              </button>
            </section>
          )}
        </section>
      )}

      {/* Saved loans */}
      {activeTab === "saved" && (
        <section
          id="panel-saved"
          role="tabpanel"
          aria-labelledby="tab-saved"
          className="workspace-content"
        >
          <section className="panel">
            <div className="panel-heading">
              <div className="heading-icon">
                <FilePlus2 size={20} />
              </div>

              <div>
                <h3>Saved loans</h3>
                <p>Your saved loans belonging to this account.</p>
              </div>
            </div>

            {loans.length === 0 ? (
              <div className="empty-state">
                <FolderOpen size={30} />
                <p>No saved loans yet. Create your first loan.</p>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setActiveTab("calculator")}
                >
                  <Calculator size={17} />
                  Create a loan
                </button>
              </div>
            ) : (
              <div className="saved-loans">
                {loans.map((loan) => (
                  <button
                    type="button"
                    className={`saved-loan ${
                      selectedLoan?.id === loan.id ? "selected" : ""
                    }`}
                    key={loan.id}
                    onClick={() => openLoan(loan)}
                    disabled={loading}
                  >
                    <span className="saved-loan-main">
                      <strong>{loan.loan_code}</strong>

                      <small>
                        {formatMoney(loan.principal)}
                        {" · "}
                        {loan.term_months} months
                        {" · "}
                        {Number(loan.annual_rate).toFixed(2)}% p.a.
                      </small>
                    </span>

                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="saved-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                setLoading(true);
                setPageError("");

                try {
                  await refreshLoans();
                  setNotice("Saved loans refreshed.");
                } catch (err) {
                  setPageError(getApiError(err));
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              <RefreshCw size={16} />
              Refresh saved loans
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={() => setActiveTab("calculator")}
            >
              <FilePlus2 size={17} />
              New loan
            </button>
          </div>
        </section>
      )}

      <footer className="footer">
        Fintara Loans · All amounts in LKR · Two decimal places
      </footer>
    </main>
  );
}