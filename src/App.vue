<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { MetaConfig } from "./types";

const meta = ref<MetaConfig>({
  title: "NiveFlow Docs",
  logo: "NiveFlow",
  indexPath: "README.md",
  avatar: "",
});

onMounted(async () => {
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
      <div class="header-content">
        <img v-if="meta.avatar" :src="meta.avatar" alt="Logo" class="logo-img" />
        <h1 class="logo-text">{{ meta.logo }}</h1>
      </div>
    </header>

    <main class="app-main">
      <router-view :meta="meta" />
    </main>

    <footer class="app-footer">
      <p>Powered by NiveFlow</p>
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1rem 2rem;
  color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.logo-img {
  width: 40px;
  height: 40px;
  border-radius: 8px;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.app-main {
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  width: 100%;
  box-sizing: border-box;
}

.app-footer {
  background: #f5f5f5;
  padding: 1rem;
  text-align: center;
  color: #666;
  font-size: 0.9rem;
}
</style>
