import {createRouter, createWebHashHistory} from 'vue-router';
import AppView from './views/AppView.vue';

export default createRouter({
  history: createWebHashHistory(),
  routes: [{path: '/', component: AppView}],
});
