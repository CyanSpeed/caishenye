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
    {
      path: '/transaction',
      name: 'Transaction',
      component: () => import('../views/Transaction.vue'),
    },
    {
      path: '/investment',
      name: 'Investment',
      component: () => import('../views/Investment.vue'),
    },
    {
      path: '/physical-assets',
      name: 'PhysicalAssets',
      component: () => import('../views/PhysicalAssets.vue'),
    },
  ],
})

export default router
