<script setup lang="ts">
import { ref, onMounted } from "vue";

const theme = ref("dark");

onMounted(() => {
  theme.value =
    document.documentElement.getAttribute("data-theme") || localStorage.getItem("theme") || "dark";
});

function toggleTheme() {
  const newTheme = theme.value === "dark" ? "light" : "dark";
  theme.value = newTheme;
  localStorage.setItem("theme", newTheme);
  document.documentElement.setAttribute("data-theme", newTheme);
}
</script>

<template>
  <button
    class="theme-toggle"
    @click="toggleTheme"
    :title="theme === 'dark' ? '切换到亮色模式' : '切换到深色模式'"
  >
    <!-- Sun Icon -->
    <svg
      v-if="theme === 'dark'"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
    <!-- Moon Icon -->
    <svg
      v-else
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  </button>
</template>

<style scoped>
.theme-toggle {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color);
  transition: transform 0.2s, opacity 0.2s;
  border-radius: 8px;
}

.theme-toggle:hover {
  transform: scale(1.1);
  opacity: 0.8;
}

.theme-toggle svg {
  width: 24px;
  height: 24px;
}
</style>
