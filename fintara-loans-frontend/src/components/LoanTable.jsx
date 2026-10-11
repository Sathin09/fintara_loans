
import { AlertCircle, CheckCircle2 } from "lucide-react";

const money = (value) =>
  `LKR ${Number(value ?? 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export { money };

export default function LoanTable({ schedule }) {
  if (!schedule) return null;

  const totals = schedule.totals;

  return (
    <section className="panel">
      <div className="panel-heading schedule-heading">
        <div>
          <h3>Repayment schedule</h3>
          <p>
            {schedule.instalments} instalments · EMI {money(schedule.emi)}
          </p>
        </div>

        <div className="legend">
          <span><i className="dot prepaid" /> Prepaid</span>
          <span><i className="dot late" /> Late</span>
        </div>
      </div>

      <div className="summary-grid">
        <Summary label="EMI" value={money(schedule.emi)} />
        <Summary label="Total interest" value={money(totals.total_interest)} />
        <Summary label="Penalties" value={money(totals.total_penalties)} />
        <Summary label="Fees" value={money(totals.total_fees)} />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Opening balance</th>
              <th>Interest</th>
              <th>Principal</th>
              <th>Payment</th>
              <th>Prepayment</th>
              <th>Fee</th>
              <th>Penalty</th>
              <th>Closing balance</th>
            </tr>
          </thead>

          <tbody>
            {schedule.rows.map((row) => (
              <tr
                key={row.month}
                className={[
                  row.prepayment > 0 ? "row-prepaid" : "",
                  row.late_days > 3 ? "row-late" : "",
                ].filter(Boolean).join(" ")}
              >
                <td>{row.month}</td>
                <td>{money(row.opening_balance)}</td>
                <td>{money(row.interest)}</td>
                <td>{money(row.principal)}</td>
                <td className="numeric-strong">{money(row.payment)}</td>
                <td>{money(row.prepayment)}</td>
                <td>{money(row.fee)}</td>
                <td>{money(row.penalty)}</td>
                <td>{money(row.closing_balance)}</td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <th colSpan="4">Instalment total</th>
              <th>{money(totals.instalments)}</th>
              <th>{money(totals.total_prepayments)}</th>
              <th>{money(totals.total_fees)}</th>
              <th>{money(totals.total_penalties)}</th>
              <th>{money(schedule.rows.at(-1)?.closing_balance)}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="table-note">
        <CheckCircle2 size={17} />
        Prepayments, fees and penalties are separate from instalment payments.
      </div>

      <p className="small-note">
        <AlertCircle size={15} />
        This schedule is a calculation, not a record of payments actually received.
      </p>
    </section>
  );
}

function Summary({ label, value }) {
  return (
    <article className="summary-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
