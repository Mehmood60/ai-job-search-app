import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '../api/client';

const routes = [
  { path: '/login', component: () => import('../views/Login.vue'), meta: { public: true } },
  { path: '/register', component: () => import('../views/Register.vue'), meta: { public: true } },
  { path: '/', redirect: '/generate' },
  { path: '/generate', component: () => import('../views/Generate.vue') },
  { path: '/evaluate', component: () => import('../views/Evaluate.vue') },
  { path: '/profile', component: () => import('../views/Profile.vue') },
  { path: '/settings', component: () => import('../views/Settings.vue') },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  if (!to.meta.public && !getToken()) return '/login';
  if (to.meta.public && getToken()) return '/generate';
  return true;
});

export default router;
