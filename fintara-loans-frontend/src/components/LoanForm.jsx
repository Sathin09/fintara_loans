import { useState } from "react";
import {
  Calculator,
  Save,
  Plus,
  Trash2,
  Wallet,
  CalendarClock,
  Info,
} from "lucide-react";

const initialForm = {
  principal: "120000",
  annual_rate: "12",
  n: "12",
};

const emptyPrepayment = () => ({
  id: crypto.randomUUID(),
  month: "",
  amount: "",
});

const emptyLatePayment = () => ({
  id: crypto.randomUUID(),
  month: "",
  days: "",
});

function rowsToMap(rows, valueField, label) {
  const result = {};
  const usedMonths = new Set();

  for (const row of rows) {
    const month = row.month.trim();
    const value = row[valueField].trim();

    // Ignore a completely empty row.
    if (!month && !value) continue;

    if (!month || !value) {
      throw new Error(
        `Please enter both the month and ${label.toLowerCase()} for every row.`
      );
    }

    if (!/^[1-9]\d*$/.test(month)) {
      throw new Error("Month must be a positive whole number.");
    }

    if (usedMonths.has(month)) {
      throw new Error(`Month ${month} is entered more than once.`);
    }

    usedMonths.add(month);
    result[month] = Number(value);
  }

  return result;
}

// Retained as a named export for compatibility with App.jsx.
export function buildLoanPayload(form) {
  const prepayments = Array.isArray(form.prepaymentRows)
    ? rowsToMap(form.prepaymentRows, "amount", "Prepayment amount")
    : JSON.parse(form.prepayments || "{}");

  const lateDays = Array.isArray(form.latePaymentRows)
    ? rowsToMap(form.latePaymentRows, "days", "Late days")
    : JSON.parse(form.late_days || "{}");

  return {
    principal: Number(form.principal),
    annual_rate: Number(form.annual_rate),
    n: Number(form.n),
    prepayments,
    late_days: lateDays,
  };
}

export default function LoanForm({ onCalculate, onSave, busy }) {
  const [form, setForm] = useState(initialForm);
  const [prepaymentRows, setPrepaymentRows] = useState([]);
  const [latePaymentRows, setLatePaymentRows] = useState([]);
  const [localError, setLocalError] = useState("");

  function update(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updatePrepayment(id, field, value) {
    setPrepaymentRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  }

  function updateLatePayment(id, field, value) {
    setLatePaymentRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  }

  async function submit(event, action) {
    event.preventDefault();
    setLocalError("");

    try {
      const payload = buildLoanPayload({
        ...form,
        prepaymentRows,
        latePaymentRows,
      });

      if (
        !Number.isFinite(payload.principal) ||
        payload.principal <= 0 ||
        payload.principal > 9999999999999.99 ||
        !Number.isFinite(payload.annual_rate) ||
        payload.annual_rate < 0 ||
        payload.annual_rate > 1000 ||
        !Number.isInteger(payload.n) ||
        payload.n < 1 ||
        payload.n > 600
      ) {
        throw new Error(
          "Enter a valid principal, an interest rate from 0 to 1000, and a term from 1 to 600 months."
        );
      }

      if (
        !/^\d+(\.\d{1,2})?$/.test(form.principal) ||
        !/^\d+(\.\d{1,4})?$/.test(form.annual_rate)
      ) {
        throw new Error(
          "Principal supports up to 2 decimal places and the interest rate up to 4."
        );
      }

      for (const [field, values] of [
        ["prepayments", payload.prepayments],
        ["late_days", payload.late_days],
      ]) {
        for (const [month, value] of Object.entries(values)) {
          if (
            !/^[1-9]\d*$/.test(month) ||
            Number(month) > payload.n
          ) {
            throw new Error(
              `${field === "prepayments" ? "Prepayment" : "Late payment"} month must be between 1 and ${payload.n}.`
            );
          }

          if (field === "prepayments") {
            if (
              !Number.isFinite(value) ||
              value <= 0 ||
              !/^\d+(\.\d{1,2})?$/.test(
                String(
                  prepaymentRows.find((row) => row.month === month)?.amount ?? value
                )
              )
            ) {
              throw new Error(
                "Prepayment amounts must be positive and have at most 2 decimal places."
              );
            }
          } else if (
            !Number.isInteger(value) ||
            value < 0 ||
            value > 36500
          ) {
            throw new Error(
              "Late days must be whole numbers from 0 to 36500."
            );
          }
        }
      }

      await action(payload);
    } catch (err) {
      setLocalError(err.message || "Please check the entered values.");
    }
  }

  const monthOptions = Array.from(
    { length: Math.min(Number(form.n) || 0, 600) },
    (_, index) => index + 1
  );

  return (
    <section className="panel loan-form-panel">
      <div className="panel-heading">
        <div className="heading-icon">
          <Calculator size={20} />
        </div>

        <div>
          <h3>Loan details</h3>
          <p>
            Configure the repayment terms and optional adjustments.
          </p>
        </div>
      </div>

      <form onSubmit={(event) => submit(event, onCalculate)}>
        <div className="form-grid">
          <label>
            Principal (LKR)
            <input
              type="number"
              name="principal"
              min="0.01"
              step="0.01"
              max="9999999999999.99"
              value={form.principal}
              onChange={update}
              required
            />
          </label>

          <label>
            Annual interest rate (%)
            <input
              type="number"
              name="annual_rate"
              min="0"
              max="1000"
              step="0.0001"
              value={form.annual_rate}
              onChange={update}
              required
            />
          </label>

          <label>
            Term (months)
            <input
              type="number"
              name="n"
              min="1"
              max="600"
              step="1"
              value={form.n}
              onChange={update}
              required
            />
          </label>
        </div>

        {/* Prepayment inputs */}
        <div className="adjustment-section">
          <div className="adjustment-heading">
            <div className="adjustment-title">
              <div className="adjustment-icon prepayment-icon">
                <Wallet size={19} />
              </div>

              <div>
                <h4>Extra repayments</h4>
                <p>
                  Add optional extra payments to reduce your outstanding
                  balance.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="add-row-button"
              onClick={() =>
                setPrepaymentRows((current) => [
                  ...current,
                  emptyPrepayment(),
                ])
              }
              disabled={busy}
            >
              <Plus size={16} />
              Add payment
            </button>
          </div>

          {prepaymentRows.length === 0 ? (
            <div className="adjustment-empty">
              <Wallet size={20} />
              <span>No extra repayments added.</span>
              <small>Your regular EMI will be calculated without extras.</small>
            </div>
          ) : (
            <div className="adjustment-rows">
              {prepaymentRows.map((row, index) => (
                <div className="adjustment-row" key={row.id}>
                  <div className="adjustment-row-number">
                    {index + 1}
                  </div>

                  <label>
                    Repayment month
                    <select
                      value={row.month}
                      onChange={(event) =>
                        updatePrepayment(
                          row.id,
                          "month",
                          event.target.value
                        )
                      }
                      disabled={busy}
                    >
                      <option value="">Select month</option>
                      {monthOptions.map((month) => (
                        <option key={month} value={month}>
                          Month {month}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Extra amount (LKR)
                    <input
                      type="number"
                      min="0.01"
                      max="9999999999999.99"
                      step="0.01"
                      value={row.amount}
                      onChange={(event) =>
                        updatePrepayment(
                          row.id,
                          "amount",
                          event.target.value
                        )
                      }
                      placeholder="e.g. 5000"
                      disabled={busy}
                    />
                  </label>

                  <button
                    type="button"
                    className="remove-row-button"
                    onClick={() =>
                      setPrepaymentRows((current) =>
                        current.filter((item) => item.id !== row.id)
                      )
                    }
                    disabled={busy}
                    aria-label={`Remove extra repayment ${index + 1}`}
                    title="Remove repayment"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="adjustment-note">
            <Info size={15} />
            <span>
              A 2% fee applies to prepayments in months 1–12. No fee
              applies after month 12. The fee is separate from the
              outstanding loan balance.
            </span>
          </div>
        </div>

        {/* Late payment inputs */}
        <div className="adjustment-section">
          <div className="adjustment-heading">
            <div className="adjustment-title">
              <div className="adjustment-icon late-icon">
                <CalendarClock size={19} />
              </div>

              <div>
                <h4>Late repayments</h4>
                <p>
                  Specify how many days late an instalment is paid.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="add-row-button"
              onClick={() =>
                setLatePaymentRows((current) => [
                  ...current,
                  emptyLatePayment(),
                ])
              }
              disabled={busy}
            >
              <Plus size={16} />
              Add late payment
            </button>
          </div>

          {latePaymentRows.length === 0 ? (
            <div className="adjustment-empty">
              <CalendarClock size={20} />
              <span>No late repayments added.</span>
              <small>No late-payment penalties will be calculated.</small>
            </div>
          ) : (
            <div className="adjustment-rows">
              {latePaymentRows.map((row, index) => (
                <div className="adjustment-row" key={row.id}>
                  <div className="adjustment-row-number">
                    {index + 1}
                  </div>

                  <label>
                    Instalment month
                    <select
                      value={row.month}
                      onChange={(event) =>
                        updateLatePayment(
                          row.id,
                          "month",
                          event.target.value
                        )
                      }
                      disabled={busy}
                    >
                      <option value="">Select month</option>
                      {monthOptions.map((month) => (
                        <option key={month} value={month}>
                          Month {month}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Days late
                    <input
                      type="number"
                      min="0"
                      max="36500"
                      step="1"
                      value={row.days}
                      onChange={(event) =>
                        updateLatePayment(
                          row.id,
                          "days",
                          event.target.value
                        )
                      }
                      placeholder="e.g. 10"
                      disabled={busy}
                    />
                  </label>

                  <button
                    type="button"
                    className="remove-row-button"
                    onClick={() =>
                      setLatePaymentRows((current) =>
                        current.filter((item) => item.id !== row.id)
                      )
                    }
                    disabled={busy}
                    aria-label={`Remove late repayment ${index + 1}`}
                    title="Remove late repayment"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="adjustment-note">
            <Info size={15} />
            <span>
              The first 3 days are a grace period. A penalty applies
              after day 3, subject to a maximum of 5% of that instalment.
            </span>
          </div>
        </div>

        {localError && (
          <div className="error-message" role="alert">
            {localError}
          </div>
        )}

        <div className="button-row">
          <button
            className="primary-button"
            type="submit"
            disabled={busy}
          >
            <Calculator size={18} />
            Calculate schedule
          </button>

          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={(event) => submit(event, onSave)}
          >
            <Save size={18} />
            Save loan
          </button>
        </div>
      </form>
    </section>
  );
}