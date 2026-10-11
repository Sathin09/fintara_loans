import { useState } from "react";
import { CalendarClock, Plus } from "lucide-react";

export default function LoanAdjustmentForm({ schedule, busy, onSubmit }) {
  const [month, setMonth] = useState("");
  const [prepayment, setPrepayment] = useState("");
  const [lateDays, setLateDays] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (!prepayment && lateDays === "") {
      setError("Enter an extra payment, days late, or both.");
      return;
    }

    if (
      prepayment &&
      (!/^\d+(\.\d{1,2})?$/.test(prepayment) ||
        !Number.isFinite(Number(prepayment)) ||
        Number(prepayment) <= 0)
    ) {
      setError("Extra payment must be greater than zero with up to 2 decimals.");
      return;
    }

    if (
      lateDays !== "" &&
      (!/^\d+$/.test(lateDays) || Number(lateDays) > 36500)
    ) {
      setError("Days late must be a whole number from 0 to 36500.");
      return;
    }

    try {
      await onSubmit({
        month: Number(month),
        ...(prepayment ? { prepayment: Number(prepayment) } : {}),
        ...(lateDays !== "" ? { late_days: Number(lateDays) } : {}),
      });
      setMonth("");
      setPrepayment("");
      setLateDays("");
    } catch {
      // The parent displays the API error.
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div className="heading-icon">
          <CalendarClock size={20} />
        </div>
        <div>
          <h3>Add installment adjustment</h3>
          <p>
            Add another extra payment, record days late, or do both for this
            saved loan.
          </p>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="form-grid adjustment-form-grid">
          <label>
            Installment month
            <select
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              required
              disabled={busy}
            >
              <option value="">Select month</option>
              {Array.from({ length: schedule.instalments }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  Month {index + 1}
                </option>
              ))}
            </select>
          </label>

          <label>
            Additional payment (LKR)
            <input
              type="number"
              min="0.01"
              max="9999999999999.99"
              step="0.01"
              value={prepayment}
              onChange={(event) => setPrepayment(event.target.value)}
              placeholder="Optional"
              disabled={busy}
            />
          </label>

          <label>
            Days late
            <input
              type="number"
              min="0"
              max="36500"
              step="1"
              value={lateDays}
              onChange={(event) => setLateDays(event.target.value)}
              placeholder="Optional"
              disabled={busy}
            />
          </label>
        </div>

        <p className="adjustment-form-note">
          Extra payments are added to any existing payment for that month.
          Entered days replace that month&apos;s previous late-day value.
        </p>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="primary-button"
          disabled={busy || schedule.instalments === 0}
        >
          <Plus size={17} />
          Add adjustment
        </button>
      </form>
    </section>
  );
}
