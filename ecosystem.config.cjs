module.exports = {
  apps: [
    {
      name: "nive-flow",
      script: "./scripts/monitor.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      env: {
        GIT_REPO_URL: "https://github.com/nive-studio/docs.git",
        GIT_BRANCH: "main",
        POLL_INTERVAL: "*/30 * * * *",
        BUILD_OUTPUT_DIR: "/var/www/nive-docs-html",
        NODE_ENV: "production",
      },
    },
  ],
};
