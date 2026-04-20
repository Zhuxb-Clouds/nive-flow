<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { renderMarkdown, initHighlighter } from "@/utils/markdown";
import type { MetaConfig } from "@/types";
import GlobalNav from "@/components/GlobalNav.vue";
import TableOfContents from "@/components/TableOfContents.vue";
import { showNav, showToc } from "@/stores/sidebar";

defineProps<{
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
  },
);
</script>

<template>
  <div class="doc-layout">
    <div class="doc-shell" :class="{ 'has-nav': showNav, 'has-toc': showToc }">
      <div class="doc-main">
        <div class="doc-content">
          <GlobalNav v-if="showNav" />

          <div class="content-area">
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
        </div>

        <TableOfContents v-if="showToc" :content="content" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.doc-layout {
  min-height: calc(100vh - 70px);
}

.doc-shell {
  max-width: 75ch;
  margin: 0 auto;
  padding: 2rem;
  --nav-reserved-width: 0px;
  --toc-column-width: 0px;
}

.doc-shell.has-nav {
  --nav-reserved-width: 316px;
}

.doc-shell.has-toc {
  --toc-column-width: calc(320px + 1.5rem);
}

.doc-shell.has-nav,
.doc-shell.has-toc,
.doc-shell.has-nav.has-toc {
  max-width: calc(75ch + var(--nav-reserved-width) + var(--toc-column-width));
}

.doc-shell.has-nav .doc-main {
  padding-left: var(--nav-reserved-width);
}

.doc-main {
  position: relative;
}

.doc-shell.has-toc .doc-main {
  display: grid;
  grid-template-columns: minmax(0, 75ch) minmax(220px, 320px);
  column-gap: 1.5rem;
  align-items: start;
}

.doc-content {
  max-width: 75ch;
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

.error {
  text-align: center;
  padding: 4rem 2rem;
}

.error h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--color);
}

.error p {
  color: var(--color-secondary);
  margin-bottom: 1.5rem;
}

.back-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
}

.back-link:hover {
  text-decoration: underline;
}

@media (max-width: 900px) {
  .doc-shell {
    padding: 1rem;
    --nav-reserved-width: 0px;
    --toc-column-width: 0px;
  }

  .doc-shell.has-nav,
  .doc-shell.has-toc,
  .doc-shell.has-nav.has-toc {
    max-width: 75ch;
  }

  .doc-shell.has-nav .doc-main,
  .doc-shell.has-toc .doc-main {
    padding-left: 0;
    display: block;
  }
}
</style>
