import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import "./styles/main.css";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "Home",
      component: () => import("./views/Home.vue"),
    },
    {
      path: "/doc/:path(.*)",
      name: "Doc",
      component: () => import("./views/DocView.vue"),
    },
  ],
});

const app = createApp(App);
app.use(router);
app.mount("#app");
