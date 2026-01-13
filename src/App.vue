<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { MetaConfig } from "./types";
import ThemeToggle from "./components/ThemeToggle.vue";
import { showNav, showToc, toggleNav, toggleToc } from "./stores/sidebar";

const meta = ref<MetaConfig>({
  title: "NiveFlow Docs",
  logo: "NiveFlow",
  indexPath: "README.md",
  avatar: "",
});

onMounted(async () => {
  // 初始化主题
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);

  try {
    const response = await fetch("/meta.json");
    if (response.ok) {
      meta.value = await response.json();
      document.title = meta.value.title;
    }
  } catch (error) {
    console.warn("无法加载 meta.json，使用默认配置");
  }
});
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-left">
        <button
          class="sidebar-toggle"
          @click="toggleNav"
          :class="{ active: showNav }"
          title="文档导航"
        ></button>
        <div class="header-title">
          <a v-if="meta.avatar" href="/" target="_blank" class="menu-link">
            <img :src="meta.avatar" class="avatar" />
          </a>
          <router-link to="/">{{ meta.logo || meta.title }}</router-link>
        </div>
      </div>
      <nav class="header-menu">
        <ThemeToggle />
        <button
          class="sidebar-toggle"
          @click="toggleToc"
          :class="{ active: showToc }"
          title="本文目录"
        >
          📑
        </button>
      </nav>
    </header>

    <main class="app-main">
      <router-view :meta="meta" />
    </main>

    <footer class="app-footer">
      <p>Powered by NiveFlow · Built with 💙</p>
    </footer>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: fixed;
  width: 100%;
  padding: 0 15%;
  top: 0;
  left: 0;
  right: 0;
  font-size: 1.5rem;
  background-color: var(--bg-color);
  color: var(--color);
  transition: all 0.2s;
  font-family: "Lora", serif;
  z-index: 100;
  max-height: 70px;
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-title {
  cursor: pointer;
  font-family: "Afacad Flux", "Mi Sans", sans-serif;
  font-weight: 500;
  display: flex;
  align-items: center;
}

.header-title a {
  color: inherit;
  text-decoration: none;
  transition: opacity 0.2s;
}

.header-title a:hover {
  opacity: 0.8;
}

.header-menu {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sidebar-toggle {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  opacity: 0.5;
  transition: all 0.2s;
}

.sidebar-toggle:hover {
  opacity: 0.8;
  background: var(--hover-bg);
}

.sidebar-toggle.active {
  opacity: 1;
}

.menu-link {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  transition: transform 0.2s;
}

.menu-link:hover {
  transform: scale(1.1);
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}

.app-main {
  flex: 1;
  margin-top: 70px;
  width: 100%;
  box-sizing: border-box;
}

.app-footer {
  background-color: var(--blockquote-background-color);
  padding: 1.5rem;
  text-align: center;
  color: var(--color);
  font-size: 0.85rem;
  font-family: "Noto Serif SC", serif;
  border-top: 1px solid var(--border-color);
  transition: all 0.2s;
}

/* 响应式 */
@media (max-width: 768px) {
  .app-header {
    padding: 0 5%;
    font-size: 1.2rem;
  }
}
</style>
