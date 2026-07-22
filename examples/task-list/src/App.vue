<script setup lang="ts">
import TaskList from "./TaskList.voya";
</script>

<template>
  <main>
    <h1>Voya task list inside Vue</h1>
    <TaskList />
  </main>
</template>

<style>
main { font-family: system-ui, sans-serif; margin: 2rem; max-width: 42rem; }
.voya-task-compose, .voya-task-filters, .voya-task-row { display: flex; gap: .5rem; margin-block: .5rem; }
.voya-task-compose input { flex: 1; }
.voya-task-row span { flex: 1; }
.voya-task-row.is-done span { text-decoration: line-through; }
[data-voya-error] { color: #a01414; min-height: 1.2rem; }
</style>
