<script setup lang="ts">
import { computed, nextTick, ref } from "vue";

const rows = Array.from({ length: 100_000 }, (_, id) => ({
  id,
  name: `item-${String(id).padStart(6, "0")}`,
  score: (id * 17) % 100_003,
}));
const query = ref("");
const descending = ref(false);
const start = ref(0);
const benchmark = ref<{ median: number; p95: number }>();

const queries = [
  "item-000", "item-001", "item-010", "item-011", "item-020", "item-021", "item-030",
  "item-031", "item-040", "item-041", "item-050", "item-051", "item-060", "item-061",
  "item-070", "item-071", "item-080", "item-081", "item-090", "item-091",
];

const matching = computed(() => {
  const values = rows.filter((row) => row.name.includes(query.value));
  values.sort((left, right) => left.score - right.score);
  return descending.value ? values.reverse() : values;
});
const visible = computed(() => matching.value.slice(start.value, start.value + 24));

function onScroll(event: Event) {
  start.value = Math.floor((event.target as HTMLElement).scrollTop / 28);
}

async function runBenchmark() {
  const samples: number[] = [];
  for (let round = 0; round < 20; round += 1) {
    const started = performance.now();
    for (const value of queries) {
      query.value = value;
      await nextTick();
    }
    samples.push(performance.now() - started);
  }
  samples.sort((left, right) => left - right);
  benchmark.value = { median: samples[10], p95: samples[19] };
}
</script>

<template>
  <section class="vue-data-grid">
    <div class="grid-toolbar">
      <input v-model="query" aria-label="Filter rows" placeholder="Filter rows">
      <button @click="descending = !descending">Sort score</button>
      <button @click="runBenchmark">Run filter benchmark</button>
      <output>
        {{ matching.length }} matching
        <template v-if="benchmark">
          | 20 filter/sort ops x20: median {{ benchmark.median.toFixed(1) }} ms,
          p95 {{ benchmark.p95.toFixed(1) }} ms
        </template>
      </output>
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
