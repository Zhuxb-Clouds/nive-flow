<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { renderMarkdown, initHighlighter } from "@/utils/markdown";
import type { MetaConfig } from "@/types";

const props = defineProps<{
  meta: MetaConfig;
}>();

const content = ref("");
const loading = ref(true);

const indexPath = computed(() => props.meta.indexPath || "README.md");

onMounted(async () => {
  await initHighlighter();

  try {
    // 尝试加载首页文档
    const response = await fetch(`/docs/${indexPath.value}`);
    if (response.ok) {
      const markdown = await response.text();
      content.value = await renderMarkdown(markdown);
    } else {
      content.value = "<p>欢迎使用 NiveFlow！请配置您的文档仓库。</p>";
    }
  } catch (error) {
    content.value = "<p>欢迎使用 NiveFlow！请配置您的文档仓库。</p>";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="home-view">
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>正在加载文档...</p>
    </div>

    <article v-else class="markdown-body" v-html="content"></article>
  </div>
</template>

<style scoped>
.home-view {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
