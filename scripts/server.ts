import express from "express";
import fs from "fs-extra";
import path from "path";
import { randomUUID } from "crypto";
import { syncAndBuild, parseDocsRepos, isLocalPath } from "./monitor.js";

const port = parseInt(process.env.WEBHOOK_PORT || "3001", 10);
const maxRetryAttempts = Math.max(1, parseInt(process.env.BUILD_RETRY_ATTEMPTS || "3", 10));
const retryDelayMs = Math.max(0, parseInt(process.env.BUILD_RETRY_DELAY_MS || "3000", 10));
const failureLogLimit = Math.max(1, parseInt(process.env.FAILURE_LOG_LIMIT || "200", 10));
const failureLogFile = path.resolve(
  process.cwd(),
  process.env.FAILURE_LOG_FILE || "logs/build-failures.jsonl",
);

// 构建锁，防止并发构建
let isBuilding = false;

type BuildTriggerType = "init" | "webhook";

interface BuildFailureLog {
  id: string;
  timestamp: string;
  trigger: BuildTriggerType;
  repo: string;
  attempt: number;
  maxAttempts: number;
  error: string;
  method?: string;
  endpoint?: string;
  retryInMs?: number;
}

const failureLogs: BuildFailureLog[] = [];

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadFailureLogs() {
  try {
    if (!fs.existsSync(failureLogFile)) {
      return;
    }

    const lines = fs
      .readFileSync(failureLogFile, "utf-8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const parsed = lines
      .slice(-failureLogLimit)
      .map((line) => {
        try {
          return JSON.parse(line) as BuildFailureLog;
        } catch {
          return null;
        }
      })
      .filter((item): item is BuildFailureLog => item !== null)
      .reverse();

    failureLogs.splice(0, failureLogs.length, ...parsed);
    if (failureLogs.length > 0) {
      console.log(`[Log] 已加载 ${failureLogs.length} 条失败日志`);
    }
  } catch (error) {
    console.error("[Log] 失败日志加载失败:", error);
  }
}

function recordFailureLog(log: BuildFailureLog) {
  failureLogs.unshift(log);
  if (failureLogs.length > failureLogLimit) {
    failureLogs.length = failureLogLimit;
  }

  try {
    fs.ensureDirSync(path.dirname(failureLogFile));
    fs.appendFileSync(failureLogFile, `${JSON.stringify(log)}\n`, "utf-8");
  } catch (error) {
    console.error("[Log] 写入失败日志文件失败:", error);
  }
}

async function runBuildWithRetry(options: {
  force: boolean;
  repoName?: string;
  trigger: BuildTriggerType;
  method?: string;
  endpoint?: string;
}): Promise<{ success: boolean; attempts: number; error?: string }> {
  let lastError = "";

  for (let attempt = 1; attempt <= maxRetryAttempts; attempt += 1) {
    try {
      console.log(`[Build] 开始执行第 ${attempt}/${maxRetryAttempts} 次构建`);
      await syncAndBuild(options.force, options.repoName);
      return { success: true, attempts: attempt };
    } catch (error) {
      lastError = normalizeErrorMessage(error);
      const retryInMs = attempt < maxRetryAttempts ? retryDelayMs : undefined;

      recordFailureLog({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        trigger: options.trigger,
        repo: options.repoName || "all",
        attempt,
        maxAttempts: maxRetryAttempts,
        error: lastError,
        method: options.method,
        endpoint: options.endpoint,
        retryInMs,
      });

      console.error(`[Build] 第 ${attempt}/${maxRetryAttempts} 次构建失败: ${lastError}`);

      if (retryInMs !== undefined) {
        console.log(`[Build] ${retryInMs}ms 后重试...`);
        await sleep(retryInMs);
      }
    }
  }

  return {
    success: false,
    attempts: maxRetryAttempts,
    error: lastError,
  };
}

async function startServer() {
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║             🌊 NiveFlow Webhook 服务已启动                ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  loadFailureLogs();

  const repos = await parseDocsRepos();
  if (repos.length > 0) {
    console.log(`[Config] 文档源 (${repos.length} 个):`);
    repos.forEach((repo, index) => {
      const type = isLocalPath(repo.url) ? "📁 本地" : "🌐 Git";
      const branch = isLocalPath(repo.url) ? "" : ` (${repo.branch})`;
      const output = repo.outputPath || `./dist/${repo.name}`;
      console.log(`  ${index + 1}. [${type}] ${repo.name}: ${repo.url}${branch}`);
      console.log(`      📤 输出: ${output}`);
    });
  } else {
    console.log("[Config] 文档源: 未配置");
  }
  console.log(`[Config] Webhook 端口: ${port}`);
  console.log(`[Config] 构建失败重试: 最多 ${maxRetryAttempts} 次，间隔 ${retryDelayMs}ms`);
  console.log(`[Config] 失败日志文件: ${failureLogFile}`);
  console.log("");

  // 初始构建
  console.log("[Init] 执行初始构建...");
  const initResult = await runBuildWithRetry({
    force: false,
    trigger: "init",
  });
  if (initResult.success) {
    console.log(`[Init] 初始构建完成 (尝试 ${initResult.attempts} 次)\n`);
  } else {
    console.error(`[Init] 初始构建失败，已达到最大重试次数: ${initResult.error}\n`);
  }

  // 创建 Express 应用
  const app = express();

  // CORS 中间件
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  // 健康检查接口
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      building: isBuilding,
      retry: {
        maxAttempts: maxRetryAttempts,
        delayMs: retryDelayMs,
      },
      failures: {
        count: failureLogs.length,
        logFile: failureLogFile,
      },
    });
  });

  // 失败日志查询接口
  app.get("/failures", (req, res) => {
    const repo = (req.query.repo as string | undefined)?.trim();
    const trigger = (req.query.trigger as BuildTriggerType | undefined)?.trim();

    const rawLimit = parseInt((req.query.limit as string) || "20", 10);
    const rawOffset = parseInt((req.query.offset as string) || "0", 10);

    const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), failureLogLimit);
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

    let filtered = failureLogs;
    if (repo) {
      filtered = filtered.filter((item) => item.repo === repo);
    }
    if (trigger === "init" || trigger === "webhook") {
      filtered = filtered.filter((item) => item.trigger === trigger);
    }

    const total = filtered.length;
    const logs = filtered.slice(offset, offset + limit);

    res.json({
      success: true,
      total,
      offset,
      limit,
      count: logs.length,
      logs,
    });
  });

  // Webhook 触发构建接口
  app.all(["/webhook", "/build", "/webhook/:name", "/build/:name"], (req, res) => {
    if (isBuilding) {
      res.status(429).json({ success: false, message: "构建正在进行中，请稍后再试" });
      return;
    }

    // 获取 repo name：路径参数 > 查询参数
    const repoName = req.params.name || (req.query.name as string) || undefined;

    console.log(
      `\n[Webhook] ${new Date().toLocaleString()} 收到构建请求${
        repoName ? ` (repo: ${repoName})` : " (全部)"
      }`,
    );

    // 立即返回响应，异步执行构建
    res.status(202).json({
      success: true,
      message: "构建任务已触发",
      repo: repoName || "all",
      retry: {
        maxAttempts: maxRetryAttempts,
        delayMs: retryDelayMs,
      },
    });

    // 异步执行拉取和强制构建
    isBuilding = true;
    runBuildWithRetry({
      force: true,
      repoName: repoName?.toString(),
      trigger: "webhook",
      method: req.method,
      endpoint: req.path,
    })
      .then((result) => {
        if (result.success) {
          console.log(`[Webhook] 构建完成 (尝试 ${result.attempts} 次)`);
        } else {
          console.error(`[Webhook] 构建失败，已达到最大重试次数: ${result.error}`);
        }
      })
      .finally(() => {
        isBuilding = false;
      });
  });

  // 404 处理
  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  app.listen(port, () => {
    console.log(`[Server] HTTP 服务已启动，监听端口 ${port}`);
    console.log(`[Server] 触发构建: POST/GET http://localhost:${port}/webhook[/:name]`);
    console.log(`[Server] 健康检查: GET http://localhost:${port}/health`);
    console.log(`[Server] 失败日志查询: GET http://localhost:${port}/failures`);
  });
}

// 启动服务
startServer().catch((err) => {
  console.error("服务无法启动:", err);
  process.exit(1);
});
