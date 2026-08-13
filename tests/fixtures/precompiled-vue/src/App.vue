<script setup>
import { ref } from "vue";
import PortableCounter from "./generated-artifact/index.js";

const value = ref(7);
</script>

<template>
  <main>
    <PortableCounter :initial="value" />
    <button @click="value = 12">Update</button>
  </main>
</template>
