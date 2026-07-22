<script setup lang="ts">
import { computed, ref } from "vue";

const rows = Array.from({ length: 100_000 }, (_, id) => ({
  id,
  name: `item-${String(id).padStart(6, "0")}`,
  score: (id * 17) % 100_003,
}));
const query = ref("");
const descending = ref(false);
const start = ref(0);

const matching = computed(() => {
  const values = rows.filter((row) => row.name.includes(query.value));
  values.sort((left, right) => left.score - right.score);
  return descending.value ? values.reverse() : values;
});
const visible = computed(() => matching.value.slice(start.value, start.value + 24));

function onScroll(event: Event) {
  start.value = Math.floor((event.target as HTMLElement).scrollTop / 28);
}
</script>

<template>
  <section class="vue-data-grid">
    <div class="grid-toolbar">
      <input v-model="query" aria-label="Filter rows" placeholder="Filter rows">
      <button @click="descending = !descending">Sort score</button>
      <output>{{ matching.length }} matching rows</output>
    </div>
    <div class="grid-viewport" @scroll="onScroll">
      <div class="grid-spacer" :style="{ height: `${matching.length * 28}px` }"></div>
      <div class="grid-rows" :style="{ transform: `translateY(${start * 28}px)` }">
        <div v-for="row in visible" :key="row.id" class="grid-row">
          <span>{{ row.name }}</span><span>{{ row.score }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
