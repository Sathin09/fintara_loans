
import { useState } from "react";
import { Calculator, Coins } from "lucide-react";
import { api, getApiError } from "../api/client";
import { money } from "./LoanTable";

export default function SettlementPanel({ loanPayload, schedule }) {
  const [month, setMonth] = useState("6");
  const [days, setDays] = useState("10");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function calculate(event) {
    event.preventDefault();
    setError("");
    setResult(null);

    const m = Number(month);
    const d = Number(days);

    if (!loanPayload || !schedule) {
      setError("Generate a schedule before calculating settlement.");
      return;
    }

    if (!Number.isInteger(m) || m < 1 || m > schedule.instalments) {
      setError(
        `Choose an instalment between 1 and ${schedule.instalments}.`
      );
      return;
    }

    if (!Number.isInteger(d) || d < 0 || d > 36500) {
      setError("Days after instalment must be between 0 and 36500.");
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post("/loans/settlement", {
        ...loanPayload,
        m,
        d,
      });

      setResult(data);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div className="heading-icon"><Coins size={20} /></div>
        <div>
          <h3>Early settlement</h3>
          <p>Calculate the amount required to settle the loan early.</p>
        </div>
      </div>

      <form onSubmit={calculate}>
        <div className="form-grid settlement-inputs">
          <label>
            Instalment month (m)
            <input
              type="number"
              min="1"
              max={schedule?.instalments || 600}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
            />
          </label>

          <label>
            Days after instalment (d)
            <input
              type="number"
              min="0"
              max="36500"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              required
            />
          </label>
        </div>

        {error && (
          <div className="error-message" role="alert">{error}</div>
        )}

        <button className="primary-button" disabled={loading || !schedule}>
          <Calculator size={18} />
          {loading ? "Calculating..." : "Calculate settlement"}
        </button>
      </form>

      {result && (
        <div className="settlement-result" aria-live="polite">
          <div className="settlement-total">
            <span>Settlement amount</span>
            <strong>{money(result.settlement_amount)}</strong>
          </div>

          <div className="breakdown-row">
            <span>Balance after instalment</span>
            <strong>{money(result.balance)}</strong>
          </div>

          <div className="breakdown-row">
            <span>Accrued interest ({result.days_after} days)</span>
            <strong>{money(result.accrued_interest)}</strong>
          </div>

          <div className="breakdown-row">
            <span>
              Closure fee ({(result.closure_fee_rate * 100).toFixed(0)}%)
            </span>
            <strong>{money(result.closure_fee)}</strong>
          </div>
        </div>
      )}
    </section>
  );
}
