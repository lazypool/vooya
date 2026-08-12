<script setup>
import { ref } from "vue";
import PortableCounter from "@vooya/artifact-vue-counter";

const value = ref(7);
</script>

<template>
  <main>
    <PortableCounter :initial="value" />
    <button @click="value = 12">Update</button>
  </main>
</template>
