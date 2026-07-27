<script setup lang="ts">
import { ref } from "vue";
import Counter from "./Counter.voo";

const initial = ref(1);
const lastChange = ref<number>();
const visible = ref(true);
</script>

<template>
  <main>
    <h1>Voya inside Vue</h1>
    <Counter
      v-if="visible"
      :initial="initial"
      class="counter-host"
      @change="lastChange = $event"
    />
    <p>Vue received: {{ lastChange ?? "no event" }}</p>
    <button @click="initial = 10">Set Vue prop to 10</button>
    <button @click="visible = !visible">Toggle Voya island</button>
  </main>
</template>

<style>
main { font-family: system-ui, sans-serif; margin: 2rem; }
.counter-host { margin-block: 1rem; }
</style>
