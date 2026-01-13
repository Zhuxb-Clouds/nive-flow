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

// 监听滚动，高亮当前章节
function handleScroll() {
  const headings = tocItems.value;
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
  { immediate: true }
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
        @click="scrollToHeading(item.id)"
      >
        {{ item.text }}
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.toc {
  width: 180px;
  position: absolute;
  left: 100%;
  top: 0;
  margin-left: 1rem;
  padding: 1rem;
  background: transparent;
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
  padding: 0.3rem 0.5rem;
  font-size: 0.8rem;
  color: var(--color-secondary);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  border-left: 2px solid transparent;
  margin-bottom: 0.1rem;
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

.toc-item.level-2 {
  padding-left: 0.75rem;
}

.toc-item.level-3 {
  padding-left: 1.25rem;
  font-size: 0.75rem;
}

.toc-item.level-4 {
  padding-left: 1.75rem;
  font-size: 0.75rem;
}

/* 响应式隐藏 */
@media (max-width: 1200px) {
  .toc {
    display: none;
  }
}
</style>
