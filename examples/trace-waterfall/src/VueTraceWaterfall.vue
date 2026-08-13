<script setup lang="ts">
import { computed, nextTick, ref } from "vue";

const props = defineProps<{ spans: number }>();
const services = ["api", "auth", "catalog", "checkout"];
const service = ref("all");
const zoom = ref(1);
const start = ref(0);
const benchmark = ref<{ median: number; p95: number }>();
const viewport = ref<HTMLElement>();
const trace = computed(() => Array.from({ length: props.spans }, (_, id) => ({
  id, service: services[id % services.length], name: `${services[id % services.length]}.operation.${id % 48}`,
  start: (id * 37) % 1200, duration: 8 + ((id * 29) % 170) + (id === Math.floor(props.spans / 2) ? 760 : 0),
})));
const critical = computed(() => trace.value.reduce((best, span) => span.duration > best.duration ? span : best));
const matching = computed(() => trace.value.filter((span) => service.value === "all" || span.service === service.value));
const visible = computed(() => matching.value.slice(start.value, start.value + 56));
function onScroll(event: Event) { start.value = Math.floor((event.target as HTMLElement).scrollTop / 25); }
async function focusCritical() { service.value = "all"; start.value = Math.max(0, critical.value.id - 7); await nextTick(); if (viewport.value) viewport.value.scrollTop = start.value * 25; }
async function measure() {
  const samples: number[] = [];
  for (const value of ["all", "api", "auth", "catalog"]) {
    const started = performance.now();
    for (let round = 0; round < 12; round += 1) { service.value = value; start.value = 0; await nextTick(); }
    samples.push(performance.now() - started);
  }
  samples.sort((left, right) => left - right);
  service.value = "all"; benchmark.value = { median: samples[2], p95: samples[3] };
}
</script>

<template>
  <section class="vue-trace" data-baseline="trace-waterfall">
    <div class="toolbar"><label>Service <select v-model="service" aria-label="Filter Vue services"><option value="all">All services</option><option v-for="value in services" :key="value" :value="value">{{ value }}</option></select></label><button aria-label="Zoom out" @click="zoom = Math.max(.5, zoom * .75)">−</button><button @click="zoom = 1">Reset zoom</button><button aria-label="Zoom in" @click="zoom = Math.min(3, zoom * 1.25)">+</button><button @click="focusCritical">Focus critical path</button><button @click="measure">Measure workload</button></div>
    <output>{{ matching.length }} matching spans <template v-if="benchmark">| 4 service filters x12: median {{ benchmark.median.toFixed(1) }} ms, p95 {{ benchmark.p95.toFixed(1) }} ms</template><template v-else>| {{ (zoom * 100).toFixed(0) }}% zoom | critical path {{ critical.duration }} ms</template></output>
    <div class="axis"><span>0 ms</span><span>600 ms</span><span>1200 ms</span></div><div ref="viewport" class="viewport" @scroll="onScroll"><div class="spacer" :style="{ height: `${matching.length * 25}px` }"><div class="rows" :style="{ transform: `translateY(${start * 25}px)` }"><div v-for="span in visible" :key="span.id" class="row" :class="{ critical: span.id === critical.id }"><span class="name">{{ span.service }} · {{ span.name }}</span><span class="bar" :style="{ marginLeft: `${span.start / 12 * zoom}%`, width: `${Math.max(2, span.duration / 12 * zoom)}%` }" :title="`${span.duration} ms`"></span></div></div></div></div>
  </section>
</template>

<style scoped>
.vue-trace { background: white; border: 1px solid #d9e1e4; box-shadow: 0 10px 24px rgba(24,47,57,.08); padding: 14px; }.toolbar { display:flex; flex-wrap:wrap; gap:8px; }.toolbar button,.toolbar select { background:#f7fbfb; border:1px solid #b9cdcf; min-height:30px; } output { color:#52616d; display:block; font-size:13px; font-variant-numeric:tabular-nums; margin:10px 0; }.axis { color:#71808a; display:flex; font-size:12px; justify-content:space-between; margin-left:42%; }.viewport { border-top:1px solid #d9e1e4; height:350px; overflow-y:auto; position:relative; }.spacer { min-height:100%; position:relative; }.rows { left:0; position:absolute; right:0; top:0; }.row { align-items:center; display:flex; height:25px; white-space:nowrap; }.row:nth-child(odd) { background:#f7fafb; }.name { font-family:ui-monospace,monospace; font-size:11px; overflow:hidden; text-overflow:ellipsis; width:42%; }.bar { background:#287a76; height:14px; min-width:2px; }.critical .bar { background:#ca5b2c; }
</style>
