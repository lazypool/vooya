import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPrecompiledVueArtifact } from "@vooya/vite-plugin/build";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = resolve(root, "component/PortableCounter.voo");
buildPrecompiledVueArtifact({ packageRoot: root, source });
