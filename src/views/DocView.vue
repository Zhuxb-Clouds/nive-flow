<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { renderMarkdown, initHighlighter } from "@/utils/markdown";
import type { MetaConfig } from "@/types";

const props = defineProps<{
  meta: MetaConfig;
}>();

const route = useRoute();
const content = ref("");
const loading = ref(true);
const error = ref("");

async function loadDocument(path: string) {
  loading.value = true;
  error.value = "";

  await initHighlighter();

  try {
    const docPath = path.endsWith(".md") ? path : `${path}.md`;
    const response = await fetch(`/docs/${docPath}`);

    if (response.ok) {
      const markdown = await response.text();
      content.value = await renderMarkdown(markdown);
    } else {
      error.value = `文档 "${path}" 未找到`;
      content.value = "";
    }
  } catch (err) {
    error.value = "加载文档时发生错误";
    content.value = "";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  const path = route.params.path as string;
  if (path) {
    loadDocument(path);
  }
});

watch(
  () => route.params.path,
  (newPath) => {
    if (newPath) {
      loadDocument(newPath as string);
    }
  }
);
</script>

<template>
  <div class="doc-view">
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>正在加载文档...</p>
    </div>

    <div v-else-if="error" class="error">
      <h2>😕 文档未找到</h2>
      <p>{{ error }}</p>
      <router-link to="/" class="back-link">← 返回首页</router-link>
    </div>

    <article v-else class="markdown-body" v-html="content"></article>
  </div>
</template>

<style scoped>
.doc-view {
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

.error {
  text-align: center;
  padding: 4rem 2rem;
  color: #666;
}

.error h2 {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: #333;
}

.back-link {
  display: inline-block;
  margin-top: 1.5rem;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-decoration: none;
  border-radius: 8px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.back-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}
</style>
