<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

const props = defineProps<{
  content: string;
}>();

const tocItems = ref<TocItem[]>([]);
const activeId = ref("");
const showBackToTop = ref(false);

// 从 HTML 内容中提取标题
function extractHeadings(html: string): TocItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const headings = doc.querySelectorAll("h1, h2, h3, h4");
  const items: TocItem[] = [];

  headings.forEach((heading, index) => {
    const text = heading.textContent || "";
    let id =
      heading.id ||
      text
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
        .replace(/^-|-$/g, "");
    if (!id) id = `heading-${index}`;

    items.push({
      id,
      text,
      level: parseInt(heading.tagName[1]),
    });
  });

  return items;
}

// 滚动到指定标题
function scrollToHeading(id: string) {
  const element = document.getElementById(id);
  if (element) {
    const headerOffset = 90;
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });
    activeId.value = id;
  }
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// 监听滚动，高亮当前章节
function handleScroll() {
  const headings = tocItems.value;
  showBackToTop.value = window.scrollY > 360;

  if (headings.length === 0) return;

  const scrollTop = window.scrollY + 100;

  for (let i = headings.length - 1; i >= 0; i--) {
    const element = document.getElementById(headings[i].id);
    if (element && element.offsetTop <= scrollTop) {
      activeId.value = headings[i].id;
      return;
    }
  }

  activeId.value = headings[0]?.id || "";
}

// 监听内容变化，重新提取标题
watch(
  () => props.content,
  (newContent) => {
    if (newContent) {
      tocItems.value = extractHeadings(newContent);
      setTimeout(() => {
        const article = document.querySelector(".markdown-body");
        if (article) {
          const headings = article.querySelectorAll("h1, h2, h3, h4");
          headings.forEach((heading, index) => {
            if (!heading.id) {
              const text = heading.textContent || "";
              heading.id =
                text
                  .toLowerCase()
                  .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
                  .replace(/^-|-$/g, "") || `heading-${index}`;
            }
          });
        }
        handleScroll();
      }, 100);
    }
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener("scroll", handleScroll);
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});
</script>

<template>
  <aside class="toc" v-if="tocItems.length > 0">
    <div class="toc-header">📑 本文目录</div>
    <ul class="toc-list">
      <li
        v-for="item in tocItems"
        :key="item.id"
        :class="['toc-item', `level-${item.level}`, { active: activeId === item.id }]"
        :style="{ '--toc-indent': `${Math.min(Math.max(item.level - 1, 0), 2) * 0.7}rem` }"
        @click="scrollToHeading(item.id)"
      >
        <span class="toc-text">{{ item.text }}</span>
      </li>
    </ul>
    <button v-if="showBackToTop" class="back-to-top" type="button" @click="scrollToTop">
      回到顶部
    </button>
  </aside>
</template>

<style scoped>
.toc {
  width: 100%;
  min-width: 0;
  position: sticky;
  top: 92px;
  padding: 1rem;
  background: color-mix(in srgb, var(--bg-color) 92%, transparent);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 18px 40px -28px var(--shadow-color);
  backdrop-filter: blur(10px);
  z-index: 20;
  max-height: calc(100vh - 108px);
  overflow-y: auto;
}

.toc-header {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color);
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-item {
  display: grid;
  grid-template-columns: var(--toc-indent, 0rem) minmax(0, 1fr);
  align-items: start;
  column-gap: 0.45rem;
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
  color: var(--color-secondary);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  border-left: 2px solid transparent;
  margin-bottom: 0.1rem;
}

.toc-text {
  grid-column: 2;
  min-width: 0;
  line-height: 1.45;
  overflow-wrap: break-word;
}

.toc-item:hover {
  color: var(--color);
  background: var(--hover-bg);
}

.toc-item.active {
  color: var(--primary-color);
  border-left-color: var(--primary-color);
  background: var(--hover-bg);
  font-weight: 500;
}

/* 层级缩进 */
.toc-item.level-1 {
  font-weight: 600;
  font-size: 0.85rem;
}

.toc-item.level-3 {
  font-size: 0.75rem;
}

.toc-item.level-4 {
  font-size: 0.75rem;
}

.back-to-top {
  width: 100%;
  margin-top: 0.85rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--bg-color);
  color: var(--color);
  font-size: 0.8rem;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.15s ease;
}

.back-to-top:hover {
  background: var(--hover-bg);
  border-color: color-mix(in srgb, var(--primary-color) 32%, var(--border-color));
}

.back-to-top:active {
  transform: translateY(1px);
}

@media (max-width: 1200px) {
  .toc {
    position: fixed;
    top: 78px;
    right: 0.75rem;
    left: auto;
    width: min(82vw, 360px);
    min-width: 0;
    max-height: calc(100vh - 94px);
    background: color-mix(in srgb, var(--bg-color) 97%, transparent);
    box-shadow: 0 24px 48px -28px var(--shadow-color);
  }
}

@media (max-width: 640px) {
  .toc {
    top: 74px;
    right: 0.5rem;
    width: calc(100vw - 1rem);
    border-radius: 12px;
  }

  .toc-item {
    padding: 0.45rem 0.5rem;
  }
}
</style>
