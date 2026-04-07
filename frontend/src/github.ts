/**
 * GitHub Device Flow authentication and API helpers.
 *
 * Device Flow works from static sites (no server needed):
 * 1. App requests a device code from GitHub
 * 2. User visits github.com/login/device and enters the code
 * 3. App polls GitHub until the user completes auth
 * 4. App receives an access token, stores it in localStorage
 *
 * Requires a GitHub OAuth App (not GitHub App) with Device Flow enabled.
 * The client_id is public — it's safe to embed in frontend code.
 */

const GH_TOKEN_KEY = "gh-device-token";
const GH_USER_KEY = "gh-user";

// This should be replaced with your own OAuth App client_id.
// Create one at https://github.com/settings/applications/new
// Enable "Device Flow" in the app settings.
const CLIENT_ID = "REPLACE_WITH_YOUR_CLIENT_ID";

// -------------------------------------------------------------------
// Token management
// -------------------------------------------------------------------

export function getGitHubToken(): string | null {
  return localStorage.getItem(GH_TOKEN_KEY);
}

export function getGitHubUser(): string | null {
  return localStorage.getItem(GH_USER_KEY);
}

export function clearGitHubAuth() {
  localStorage.removeItem(GH_TOKEN_KEY);
  localStorage.removeItem(GH_USER_KEY);
}

export function isGitHubAuthenticated(): boolean {
  return !!getGitHubToken();
}

// -------------------------------------------------------------------
// Device Flow
// -------------------------------------------------------------------

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
}

/**
 * Step 1: Request a device code.
 * Returns the user_code and verification_uri for the user to visit.
 */
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const res = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      scope: "repo",
    }),
  });
  if (!res.ok) throw new Error(`GitHub device code request failed: ${res.status}`);
  return res.json();
}

/**
 * Step 2: Poll for the access token.
 * Resolves when user completes auth; rejects on expiry or error.
 */
export async function pollForToken(
  deviceCode: string,
  interval: number,
  expiresIn: number,
  onStatus?: (status: string) => void
): Promise<string> {
  const deadline = Date.now() + expiresIn * 1000;
  const pollInterval = Math.max(interval, 5) * 1000; // GitHub minimum is 5s

  while (Date.now() < deadline) {
    await sleep(pollInterval);

    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    if (!res.ok) continue;
    const data: TokenResponse = await res.json();

    if (data.access_token) {
      localStorage.setItem(GH_TOKEN_KEY, data.access_token);
      // Fetch username
      try {
        const userRes = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (userRes.ok) {
          const user = await userRes.json();
          localStorage.setItem(GH_USER_KEY, user.login);
        }
      } catch { /* ok */ }
      return data.access_token;
    }

    if (data.error === "authorization_pending") {
      onStatus?.("Waiting for authorization...");
      continue;
    }
    if (data.error === "slow_down") {
      onStatus?.("Slowing down...");
      await sleep(5000);
      continue;
    }
    if (data.error === "expired_token") {
      throw new Error("Device code expired. Please try again.");
    }
    if (data.error === "access_denied") {
      throw new Error("Authorization denied by user.");
    }
    if (data.error) {
      throw new Error(`GitHub auth error: ${data.error}`);
    }
  }

  throw new Error("Device code expired. Please try again.");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// -------------------------------------------------------------------
// GitHub API: commit files
// -------------------------------------------------------------------

interface GitHubTreeEntry {
  path: string;
  mode: "100644";
  type: "blob";
  content: string;
}

/**
 * Commit multiple files to a GitHub repo in a single commit.
 * Uses the Git Data API (create tree + create commit + update ref).
 */
export async function commitFiles(opts: {
  owner: string;
  repo: string;
  branch: string;
  message: string;
  files: { path: string; content: string }[];
}): Promise<string> {
  const token = getGitHubToken();
  if (!token) throw new Error("Not authenticated. Please sign in with GitHub first.");

  const { owner, repo, branch, message, files } = opts;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const api = `https://api.github.com/repos/${owner}/${repo}`;

  // 1. Get the current commit SHA of the branch
  const refRes = await fetch(`${api}/git/ref/heads/${branch}`, { headers });
  if (!refRes.ok) throw new Error(`Failed to get branch ref: ${refRes.status}`);
  const refData = await refRes.json();
  const parentSha: string = refData.object.sha;

  // 2. Get the tree SHA of the current commit
  const commitRes = await fetch(`${api}/git/commits/${parentSha}`, { headers });
  if (!commitRes.ok) throw new Error(`Failed to get commit: ${commitRes.status}`);
  const commitData = await commitRes.json();
  const baseTreeSha: string = commitData.tree.sha;

  // 3. Create a new tree with the file changes
  const tree: GitHubTreeEntry[] = files.map((f) => ({
    path: f.path,
    mode: "100644",
    type: "blob",
    content: f.content,
  }));

  const treeRes = await fetch(`${api}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  });
  if (!treeRes.ok) {
    const err = await treeRes.text();
    throw new Error(`Failed to create tree: ${treeRes.status} ${err}`);
  }
  const treeData = await treeRes.json();

  // 4. Create the commit
  const newCommitRes = await fetch(`${api}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message,
      tree: treeData.sha,
      parents: [parentSha],
    }),
  });
  if (!newCommitRes.ok) throw new Error(`Failed to create commit: ${newCommitRes.status}`);
  const newCommitData = await newCommitRes.json();

  // 5. Update the branch ref
  const updateRefRes = await fetch(`${api}/git/refs/heads/${branch}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ sha: newCommitData.sha }),
  });
  if (!updateRefRes.ok) throw new Error(`Failed to update ref: ${updateRefRes.status}`);

  return newCommitData.html_url || newCommitData.sha;
}
