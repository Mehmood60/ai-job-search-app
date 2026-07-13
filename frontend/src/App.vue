<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const showNav = computed(() => !route.meta.public && auth.isAuthenticated());

function logout() {
  auth.logout();
  router.push('/login');
}

const links = [
  { to: '/apply', label: 'Apply' },
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' },
];
</script>

<template>
  <div class="min-h-screen">
    <header v-if="showNav" class="border-b border-gray-200 bg-white">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div class="flex items-center gap-6">
          <span class="text-lg font-bold text-brand">AI Job Search</span>
          <nav class="flex gap-1">
            <RouterLink
              v-for="l in links"
              :key="l.to"
              :to="l.to"
              class="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
              active-class="bg-brand/10 text-brand"
              >{{ l.label }}</RouterLink
            >
          </nav>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-gray-500">{{ auth.user?.email }}</span>
          <button class="btn-ghost" @click="logout">Log out</button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-8">
      <RouterView />
    </main>
  </div>
</template>
