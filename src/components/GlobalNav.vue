<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";

interface NavTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: NavTreeNode[];
}

const route = useRoute();
const navTree = ref<NavTreeNode[]>([]);
const expandedFolders = ref<Set<string>>(new Set());

// 从 nav-tree.json 加载导航树
async function loadNavTree() {
  try {
    const response = await fetch("/nav-tree.json");
    if (response.ok) {
      navTree.value = await response.json();
      // 默认展开当前路径所在的文件夹
      expandCurrentPath();
    }
  } catch (err) {
    console.warn("无法加载导航树:", err);
  }
}

// 展开当前路径所在的所有父文件夹
function expandCurrentPath() {
  const currentPath = (route.params.path as string) || "";
  if (!currentPath) return;

  const parts = currentPath.split("/");
  let accumulated = "";
  for (let i = 0; i < parts.length - 1; i++) {
    accumulated = accumulated ? `${accumulated}/${parts[i]}` : parts[i];
    expandedFolders.value.add(accumulated);
  }
}

function toggleFolder(path: string) {
  if (expandedFolders.value.has(path)) {
    expandedFolders.value.delete(path);
  } else {
    expandedFolders.value.add(path);
  }
}

function isExpanded(path: string): boolean {
  return expandedFolders.value.has(path);
}

function getDocPath(itemPath: string): string {
  // README 路径直接返回首页
  if (itemPath === "README") return "/";
  return `/doc/${itemPath}`;
}

onMounted(() => {
  loadNavTree();
});

// 监听路由变化，自动展开当前路径
watch(
  () => route.params.path,
  () => {
    expandCurrentPath();
  },
);
</script>

<template>
  <aside class="global-nav">
    <div class="nav-header">📚 文档导航</div>

    <nav class="nav-tree">
      <ul class="nav-list">
        <template v-for="item in navTree" :key="item.path">
          <!-- 文件夹 -->
          <li v-if="item.type === 'folder'" class="nav-item">
            <div class="folder-header" @click="toggleFolder(item.path)">
              <span class="folder-icon">{{ isExpanded(item.path) ? "📂" : "📁" }}</span>
              <span class="folder-name">{{ item.name }}</span>
              <span class="folder-arrow" :class="{ expanded: isExpanded(item.path) }">▸</span>
            </div>
            <Transition name="tree-expand">
              <TreeNode
                v-if="isExpanded(item.path) && item.children"
                :items="item.children"
                :depth="1"
                :expanded-folders="expandedFolders"
                @toggle="toggleFolder"
              />
            </Transition>
          </li>
          <!-- 文件 -->
          <li v-else class="nav-item">
            <router-link :to="getDocPath(item.path)" class="nav-link">
              <span class="file-icon">📄</span>
              <span class="file-name">{{ item.name }}</span>
            </router-link>
          </li>
        </template>
      </ul>
    </nav>
  </aside>
</template>

<!-- 递归树节点组件 -->
<script lang="ts">
import { defineComponent, h, PropType, Transition, VNode } from "vue";
import { RouterLink } from "vue-router";

interface TreeNodeItem {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeNodeItem[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TreeNode: any = defineComponent({
  name: "TreeNode",
  props: {
    items: {
      type: Array as PropType<TreeNodeItem[]>,
      required: true,
    },
    depth: {
      type: Number,
      default: 0,
    },
    expandedFolders: {
      type: Object as PropType<Set<string>>,
      required: true,
    },
  },
  emits: ["toggle"],
  setup(props, { emit }) {
    const isExpanded = (path: string): boolean => props.expandedFolders.has(path);

    const getDocPath = (itemPath: string): string => {
      if (itemPath === "README") return "/";
      return `/doc/${itemPath}`;
    };

    const toggle = (path: string): void => {
      emit("toggle", path);
    };

    return (): VNode => {
      return h(
        "ul",
        { class: "sub-tree" },
        props.items.map((item): VNode => {
          const indentStyle = { paddingLeft: `${Math.min(props.depth, 4) * 0.6}rem` };

          if (item.type === "folder") {
            return h("li", { key: item.path, class: "nav-item nested-item", style: indentStyle }, [
              h(
                "div",
                {
                  class: "folder-header",
                  onClick: () => toggle(item.path),
                },
                [
                  h("span", { class: "folder-icon" }, isExpanded(item.path) ? "📂" : "📁"),
                  h("span", { class: "folder-name" }, item.name),
                  h("span", { class: ["folder-arrow", { expanded: isExpanded(item.path) }] }, "▸"),
                ],
              ),
              h(Transition, { name: "tree-expand" }, (): VNode | null =>
                isExpanded(item.path) && item.children
                  ? h(TreeNode, {
                      items: item.children,
                      depth: props.depth + 1,
                      expandedFolders: props.expandedFolders,
                      onToggle: toggle,
                    })
                  : null,
              ),
            ]);
          } else {
            return h("li", { key: item.path, class: "nav-item nested-item", style: indentStyle }, [
              h(RouterLink, { to: getDocPath(item.path), class: "nav-link" }, () => [
                h("span", { class: "file-icon" }, "📄"),
                h("span", { class: "file-name" }, item.name),
              ]),
            ]);
          }
        }),
      );
    };
  },
});

export default {
  components: { TreeNode },
};
</script>

<style scoped>
.global-nav {
  width: min(300px, 24vw);
  min-width: 240px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  position: absolute;
  right: 100%;
  top: 0;
  margin-right: 1rem;
  padding: 1rem;
  background: color-mix(in srgb, var(--bg-color) 92%, transparent);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 18px 40px -28px var(--shadow-color);
  backdrop-filter: blur(10px);
  animation: slideIn 0.3s ease-out;
  z-index: 20;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.nav-header {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color);
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.nav-tree :deep(ul) {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-item {
  margin-bottom: 0.1rem;
}

.nested-item {
  padding-left: 0;
}

:deep(.folder-header) {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  padding: 0.35rem 0.5rem;
  cursor: pointer;
  border-radius: 6px;
  transition:
    background 0.2s ease,
    transform 0.15s ease;
  gap: 0.45rem;
}

:deep(.folder-header:hover) {
  background: var(--hover-bg);
}

:deep(.folder-header:active) {
  transform: scale(0.98);
}

:deep(.folder-icon),
:deep(.file-icon),
:deep(.folder-arrow) {
  font-size: 0.85rem;
  flex-shrink: 0;
  line-height: 1.4;
}

:deep(.folder-icon) {
  transition: transform 0.2s ease;
}

:deep(.folder-name) {
  font-weight: 500;
  color: var(--color);
  font-size: 0.85rem;
  flex: 1;
  min-width: 0;
  line-height: 1.45;
  overflow-wrap: break-word;
}

:deep(.folder-arrow) {
  font-size: 0.7rem;
  color: var(--color-secondary);
  flex-shrink: 0;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-block;
}

:deep(.folder-arrow.expanded) {
  transform: rotate(90deg);
}

:deep(.sub-tree) {
  margin-top: 0.1rem;
  margin-left: 0.25rem;
  padding-left: 0.35rem;
  border-left: 1px solid var(--border-color);
  overflow: hidden;
}

:deep(.nav-link) {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  padding: 0.35rem 0.5rem;
  color: var(--color-secondary);
  text-decoration: none;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-size: 0.8rem;
  gap: 0.45rem;
  min-width: 0;
}

:deep(.nav-link:hover) {
  background: var(--hover-bg);
  color: var(--color);
  transform: translateX(2px);
}

:deep(.nav-link.router-link-active),
:deep(.nav-link.router-link-exact-active) {
  background: var(--primary-color);
  color: white;
}

:deep(.file-name) {
  min-width: 0;
  line-height: 1.45;
  overflow-wrap: break-word;
}

/* 树展开/折叠动画 */
.tree-expand-enter-active {
  animation: treeExpand 0.25s ease-out;
}

.tree-expand-leave-active {
  animation: treeExpand 0.2s ease-in reverse;
}

@keyframes treeExpand {
  from {
    opacity: 0;
    max-height: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    max-height: 1000px;
    transform: translateY(0);
  }
}

/* 深层动画适配 */
:deep(.tree-expand-enter-active) {
  animation: treeExpand 0.25s ease-out;
}

:deep(.tree-expand-leave-active) {
  animation: treeExpand 0.2s ease-in reverse;
}

/* 滚动条样式 */
.global-nav::-webkit-scrollbar {
  width: 4px;
}

.global-nav::-webkit-scrollbar-track {
  background: transparent;
}

.global-nav::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 2px;
  transition: background 0.2s;
}

.global-nav::-webkit-scrollbar-thumb:hover {
  background: var(--color-secondary);
}

@media (max-width: 1200px) {
  .global-nav {
    position: fixed;
    top: 78px;
    left: 0.75rem;
    right: auto;
    width: min(82vw, 320px);
    min-width: 0;
    max-height: calc(100vh - 94px);
    margin-right: 0;
    background: color-mix(in srgb, var(--bg-color) 97%, transparent);
    box-shadow: 0 24px 48px -28px var(--shadow-color);
  }
}

@media (max-width: 640px) {
  .global-nav {
    top: 74px;
    left: 0.5rem;
    width: calc(100vw - 1rem);
    border-radius: 12px;
  }

  :deep(.folder-header),
  :deep(.nav-link) {
    padding: 0.45rem 0.5rem;
  }
}
</style>
