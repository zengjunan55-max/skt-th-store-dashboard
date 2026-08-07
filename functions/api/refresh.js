const RUNNING_STATUSES = new Set(["queued", "in_progress", "pending", "waiting", "requested"]);
const COMPLETED_STATUSES = new Set(["completed"]);

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });
}

function getConfig(env) {
  return {
    owner: env.GITHUB_OWNER || "zengjunan55-max",
    repo: env.GITHUB_REPO || "skt-th-store-dashboard",
    workflowId: env.GITHUB_WORKFLOW_ID || "refresh-dashboard.yml",
    ref: env.GITHUB_REF || "main",
    token: env.GITHUB_TOKEN || "",
  };
}

async function githubRequest(config, path, init = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "skt-th-store-dashboard-refresh",
      ...(init.headers || {}),
    },
  });
}

async function listWorkflowRuns(config) {
  const path = `/repos/${config.owner}/${config.repo}/actions/workflows/${encodeURIComponent(config.workflowId)}/runs?per_page=10&branch=${encodeURIComponent(config.ref)}&event=workflow_dispatch`;
  const response = await githubRequest(config, path);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`list_workflow_runs_failed:${response.status}:${text}`);
  }
  const data = await response.json();
  return Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
}

async function getWorkflowRun(config, runId) {
  const path = `/repos/${config.owner}/${config.repo}/actions/runs/${runId}`;
  const response = await githubRequest(config, path);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`get_workflow_run_failed:${response.status}:${text}`);
  }
  return response.json();
}

async function dispatchWorkflow(config, payload) {
  const path = `/repos/${config.owner}/${config.repo}/actions/workflows/${encodeURIComponent(config.workflowId)}/dispatches`;
  const response = await githubRequest(config, path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`dispatch_failed:${response.status}:${text}`);
  }
}

async function waitForNewRun(config, previousRunId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const runs = await listWorkflowRuns(config);
    const latest = runs[0];
    if (latest && latest.id !== previousRunId) {
      return latest;
    }
  }
  return null;
}

async function waitForRunCompletion(config, runId) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const run = await getWorkflowRun(config, runId);
    if (COMPLETED_STATUSES.has(run.status)) {
      return run;
    }
    if (!RUNNING_STATUSES.has(run.status)) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return null;
}

export async function onRequestPost(context) {
  const config = getConfig(context.env);
  if (!config.token) {
    return json(
      {
        ok: false,
        message: "GITHUB_TOKEN is not configured.",
        detail: "Cloudflare Pages environment variable GITHUB_TOKEN is missing.",
      },
      { status: 500 },
    );
  }

  try {
    const runs = await listWorkflowRuns(config);
    const activeRun = runs.find((run) => RUNNING_STATUSES.has(run.status));
    if (activeRun) {
      return json(
        {
          ok: false,
          message: "Refresh is already running. Please try again later.",
          runUrl: activeRun.html_url || "",
          runId: activeRun.id || null,
        },
        { status: 409 },
      );
    }

    const previousRunId = runs[0] ? runs[0].id : null;
    await dispatchWorkflow(config, {
      ref: config.ref,
      inputs: {
        source: "cloudflare-pages",
        requested_at: new Date().toISOString(),
      },
    });

    const newRun = await waitForNewRun(config, previousRunId);
    if (!newRun || !newRun.id) {
      return json(
        {
          ok: true,
          message: "Refresh triggered, but the run record was not available yet.",
          runUrl: "",
          runId: null,
        },
        { status: 202 },
      );
    }

    const completedRun = await waitForRunCompletion(config, newRun.id);
    if (completedRun && completedRun.status === "completed" && completedRun.conclusion === "success") {
      return json({
        ok: true,
        message: "Refresh completed. Reload the page to see the latest data.",
        runUrl: completedRun.html_url || newRun.html_url || "",
        runId: completedRun.id || newRun.id,
        status: completedRun.status,
        conclusion: completedRun.conclusion,
      });
    }

    if (completedRun && completedRun.status === "completed") {
      return json(
        {
          ok: false,
          message: "Refresh completed, but the workflow failed.",
          runUrl: completedRun.html_url || newRun.html_url || "",
          runId: completedRun.id || newRun.id,
          status: completedRun.status,
          conclusion: completedRun.conclusion || "",
        },
        { status: 500 },
      );
    }

    return json(
      {
        ok: true,
        message: "Refresh triggered and is still running.",
        runUrl: newRun.html_url || "",
        runId: newRun.id,
        status: newRun.status || "queued",
      },
      { status: 202 },
    );
  } catch (error) {
    return json(
      {
        ok: false,
        message: "Failed to trigger refresh.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function onRequestGet() {
  return json(
    {
      ok: true,
      message: "Use POST to trigger refresh.",
    },
    { status: 405 },
  );
}
