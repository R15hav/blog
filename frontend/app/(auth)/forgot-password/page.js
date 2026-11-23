import { getSiteName } from "../../_lib/theme";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  const siteName = await getSiteName();

  return (
    <div className="auth-shell">
      <div className="auth-marketing">
        <a className="wordmark" href="/">
          {siteName}
          <span className="dot" />
        </a>
        <footer className="auth-footer">
          <a href="/">Home</a>
        </footer>
      </div>

      <div className="auth-form">
        <div className="auth-mobile-brand">
          <a className="wordmark" href="/">
            {siteName}
            <span className="dot" />
          </a>
        </div>

        <h1>Forgot your password?</h1>
        <p className="lede">
          Password resets are handled by the administrator of {siteName}.
        </p>
        <p>
          Contact the person who runs this site and ask them to reset your
          password. Once they have, sign in with the new password.
        </p>

        <div className="auth-divider">
          <a href="/login">Back to sign in</a>
        </div>
      </div>
    </div>
  );
}
