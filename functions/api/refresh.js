const RUNNING_STATUSES = new Set(["queued", "in_progress", "pending", "waiting", "requested"]);

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
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "skt-th-store-dashboard-refresh",
      ...(init.headers || {}),
    },
  });
  return response;
}

async function listWorkflowRuns(config) {
  const path = `/repos/${config.owner}/${config.repo}/actions/workflows/${encodeURIComponent(config.workflowId)}/runs?per_page=5&branch=${encodeURIComponent(config.ref)}&event=workflow_dispatch`;
  const response = await githubRequest(config, path);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`list_workflow_runs_failed:${response.status}:${text}`);
  }
  const data = await response.json();
  return Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
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
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const runs = await listWorkflowRuns(config);
    const latest = runs[0];
    if (latest && latest.id !== previousRunId) {
      return latest;
    }
  }
  return null;
}

export async function onRequestPost(context) {
  const config = getConfig(context.env);
  if (!config.token) {
    return json(
      {
        ok: false,
        message: "未配置令牌",
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
          message: "刷新进行中",
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
    return json({
      ok: true,
      message: "已触发刷新",
      runUrl: newRun && newRun.html_url ? newRun.html_url : "",
      runId: newRun && newRun.id ? newRun.id : null,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "触发失败",
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
