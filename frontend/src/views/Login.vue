<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiError } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    router.push('/generate');
  } catch (e) {
    error.value = apiError(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto mt-16 max-w-sm">
    <h1 class="mb-1 text-2xl font-bold text-brand">AI Job Search</h1>
    <p class="mb-6 text-sm text-gray-500">Sign in to your application assistant.</p>
    <form class="card space-y-4" @submit.prevent="submit">
      <div>
        <label class="label">Email</label>
        <input v-model="email" type="email" class="input" required />
      </div>
      <div>
        <label class="label">Password</label>
        <input v-model="password" type="password" class="input" required />
      </div>
      <p v-if="error" class="text-sm text-brand">{{ error }}</p>
      <button class="btn-primary w-full" :disabled="loading">{{ loading ? 'Signing in…' : 'Sign in' }}</button>
      <p class="text-center text-sm text-gray-500">
        No account?
        <RouterLink to="/register" class="font-medium text-brand">Create one</RouterLink>
      </p>
    </form>
  </div>
</template>
