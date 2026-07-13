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
    await auth.register(email.value, password.value);
    router.push('/profile');
  } catch (e) {
    error.value = apiError(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto mt-16 max-w-sm">
    <h1 class="mb-1 text-2xl font-bold text-brand">Create your account</h1>
    <p class="mb-6 text-sm text-gray-500">Then fill in your profile and add an AI provider key.</p>
    <form class="card space-y-4" @submit.prevent="submit">
      <div>
        <label class="label">Email</label>
        <input v-model="email" type="email" class="input" required />
      </div>
      <div>
        <label class="label">Password</label>
        <input v-model="password" type="password" class="input" minlength="8" required />
        <p class="mt-1 text-xs text-gray-400">At least 8 characters.</p>
      </div>
      <p v-if="error" class="text-sm text-brand">{{ error }}</p>
      <button class="btn-primary w-full" :disabled="loading">{{ loading ? 'Creating…' : 'Create account' }}</button>
      <p class="text-center text-sm text-gray-500">
        Already have an account?
        <RouterLink to="/login" class="font-medium text-brand">Sign in</RouterLink>
      </p>
    </form>
  </div>
</template>
