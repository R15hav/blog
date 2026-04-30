import { getAllowRegistration } from "../../_lib/theme";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage() {
  const allowRegistration = await getAllowRegistration();

  if (!allowRegistration) {
    return (
      <div className="auth-shell">
        <div className="auth-marketing">
          <a className="wordmark" href="/">
            Blog<span className="dot" />
          </a>
          <blockquote style={{ margin: 0 }}>
            <p className="auth-quote">
              &ldquo;A writer only begins a book. A reader finishes it.&rdquo;
            </p>
            <p className="auth-quote-cite">— Samuel Johnson</p>
          </blockquote>
          <footer className="auth-footer">
            <a href="/">Home</a>
          </footer>
        </div>
        <div className="auth-form">
          <h1>Registration closed</h1>
          <p className="lede">New accounts are not being accepted at this time.</p>
          <a className="btn btn-ghost" href="/login" style={{ alignSelf: "flex-start" }}>
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return <RegisterForm />;
}
