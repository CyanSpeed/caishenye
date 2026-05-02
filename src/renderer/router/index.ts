import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'Dashboard',
      component: () => import('../views/Dashboard.vue'),
    },
    {
      path: '/accounts',
      name: 'Accounts',
      component: () => import('../views/Accounts.vue'),
    },
  ],
})

export default router
