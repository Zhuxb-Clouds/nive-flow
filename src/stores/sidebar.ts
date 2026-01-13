import { ref, watch } from "vue";

// 从 localStorage 读取初始状态
const getInitialState = (key: string, defaultValue: boolean): boolean => {
  const saved = localStorage.getItem(key);
  return saved !== null ? saved === "true" : defaultValue;
};

export const showNav = ref(getInitialState("niveflow-show-nav", true));
export const showToc = ref(getInitialState("niveflow-show-toc", true));

// 监听变化并保存到 localStorage
watch(showNav, (value) => {
  localStorage.setItem("niveflow-show-nav", String(value));
});

watch(showToc, (value) => {
  localStorage.setItem("niveflow-show-toc", String(value));
});

export function toggleNav() {
  showNav.value = !showNav.value;
}

export function toggleToc() {
  showToc.value = !showToc.value;
}
