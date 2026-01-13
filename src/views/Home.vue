<script setup lang="ts">
import { ref, onMounted } from "vue";
import { renderMarkdown, initHighlighter } from "@/utils/markdown";
import type { MetaConfig } from "@/types";
import GlobalNav from "@/components/GlobalNav.vue";
import TableOfContents from "@/components/TableOfContents.vue";
import { showNav, showToc } from "@/stores/sidebar";

const props = defineProps<{
  meta: MetaConfig;
}>();

const content = ref("");
const loading = ref(true);

onMounted(async () => {
  await initHighlighter();

  try {
    const indexPath = props.meta.indexPath || "README.md";
    const response = await fetch(`/docs/${indexPath}`);
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
  <div class="doc-layout">
    <div class="doc-content">
      <GlobalNav v-if="showNav" />

      <div class="content-area">
        <div v-if="loading" class="loading">
          <div class="spinner"></div>
          <p>正在加载文档...</p>
        </div>

        <article v-else class="markdown-body" v-html="content"></article>
      </div>

      <TableOfContents v-if="showToc" :content="content" />
    </div>
  </div>
</template>

<style scoped>
.doc-layout {
  min-height: calc(100vh - 70px);
}

.doc-content {
  max-width: 75ch;
  margin: 0 auto;
  padding: 2rem;
  position: relative;
}

.content-area {
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

/* 响应式 */
@media (max-width: 900px) {
  .doc-content {
    padding: 1rem;
  }
}
</style>
