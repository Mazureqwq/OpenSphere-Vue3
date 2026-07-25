import { createRouter, createWebHistory } from "vue-router";
import AppView from "./views/AppView.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [{ path: "/", component: AppView }],
});
