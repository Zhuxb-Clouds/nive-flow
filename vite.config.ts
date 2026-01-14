import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: process.env.OUT_PUT || "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 500, // 警告阈值 500KB
    rollupOptions: {
      output: {
        // 手动分割代码块
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // 将 vue 相关库单独打包
            if (id.includes("vue") || id.includes("@vue")) {
              return "vue-vendor";
            }
            // shiki 代码高亮库较大，单独打包
            if (id.includes("shiki")) {
              return "shiki-vendor";
            }
            // 将 markdown-it 单独打包
            if (id.includes("markdown-it") || id.includes("katex")) {
              return "markdown-vendor";
            }
            // 其他 node_modules 打包到 vendor
            return "vendor";
          }
        },
        // 用于从入口点创建的块的打包输出格式
        entryFileNames: "assets/[name]-[hash].js",
        // 用于代码分割生成的共享块的打包输出格式
        chunkFileNames: "assets/[name]-[hash].js",
        // 用于静态资源的打包输出格式
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
