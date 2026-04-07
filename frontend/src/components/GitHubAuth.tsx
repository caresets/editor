import { useState } from "react";
import {
  clearGitHubAuth,
  getGitHubUser,
  isGitHubAuthenticated,
  requestDeviceCode,
  pollForToken,
} from "../github";

interface Props {
  onAuthChange: () => void;
}

export function GitHubAuth({ onAuthChange }: Props) {
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [userCode, setUserCode] = useState("");
  const [verificationUri, setVerificationUri] = useState("");
  const [error, setError] = useState("");

  const authenticated = isGitHubAuthenticated();
  const user = getGitHubUser();

  async function handleSignIn() {
    setStatus("pending");
    setError("");
    try {
      const dc = await requestDeviceCode();
      setUserCode(dc.user_code);
      setVerificationUri(dc.verification_uri);

      // Open GitHub in a new tab for the user
      window.open(dc.verification_uri, "_blank");

      await pollForToken(dc.device_code, dc.interval, dc.expires_in, setError);
      setStatus("idle");
      setUserCode("");
      onAuthChange();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Auth failed");
    }
  }

  function handleSignOut() {
    clearGitHubAuth();
    setStatus("idle");
    onAuthChange();
  }

  if (authenticated) {
    return (
      <div className="gh-auth">
        <span className="gh-auth-user">{user || "Signed in"}</span>
        <button className="gh-auth-btn" onClick={handleSignOut}>Sign out</button>
      </div>
    );
  }

  if (status === "pending" && userCode) {
    return (
      <div className="gh-auth gh-auth-pending">
        <div className="gh-auth-instructions">
          Enter code at{" "}
          <a href={verificationUri} target="_blank" rel="noopener noreferrer">
            github.com/login/device
          </a>
        </div>
        <div className="gh-auth-code">{userCode}</div>
        <button
          className="gh-auth-copy"
          onClick={() => navigator.clipboard.writeText(userCode)}
        >
          Copy code
        </button>
        <div className="gh-auth-waiting">Waiting for authorization...</div>
      </div>
    );
  }

  return (
    <div className="gh-auth">
      <button className="gh-auth-btn" onClick={handleSignIn} disabled={status === "pending"}>
        Sign in with GitHub
      </button>
      {error && <div className="gh-auth-error">{error}</div>}
    </div>
  );
}
