
import { useState } from "react";
import { Eye, EyeOff, Wallet, LogIn, UserPlus } from "lucide-react";
import { api, getApiError } from "../api/client";

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function update(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "register" ? "/register" : "/login";

      const payload = mode === "register"
        ? form
        : {
            email: form.email,
            password: form.password,
          };

      const { data } = await api.post(endpoint, payload);

      if (!data.token || !data.user || !data.expires_at) {
        throw new Error("The API did not return a valid session.");
      }

      await onAuthenticated(data.token, data.user, data.expires_at);
    } catch (err) {
      setError(err.response ? getApiError(err) : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-icon"><Wallet size={24} /></div>
          <div>
            <h1>Fintara Loans</h1>
            <p>Loan calculation workspace</p>
          </div>
        </div>

        <div className="auth-intro">
          <p className="eyebrow">SECURE ACCESS</p>
          <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p>
            {mode === "login"
              ? "Sign in to manage your loans and repayment schedules."
              : "Register to start calculating and managing loan schedules."}
          </p>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <label>
              Full name
              <input
                name="name"
                value={form.name}
                onChange={update}
                autoComplete="name"
                maxLength={120}
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={update}
              autoComplete="email"
              maxLength={255}
              required
            />
          </label>

          <label>
            Password
            <span className="password-input-wrap">
              <input
                type={mode === "login" && showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={update}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={mode === "register" ? 12 : undefined}
                maxLength={128}
                required
              />
              {mode === "login" && (
                <button
                  type="button"
                  className="password-visibility-button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              )}
            </span>
          </label>

          {mode === "register" && (
            <label>
              Confirm password
              <input
                type="password"
                name="password_confirmation"
                value={form.password_confirmation}
                onChange={update}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
          )}

          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          <button className="primary-button full-width" disabled={loading}>
            {mode === "login"
              ? <LogIn size={18} />
              : <UserPlus size={18} />}
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "login"
            ? "Don't have an account?"
            : "Already registered?"}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </section>
    </main>
  );
}
