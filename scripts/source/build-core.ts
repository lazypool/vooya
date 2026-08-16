// The package build is an explicit prerequisite of the root build:core command.
// @ts-ignore -- dist is generated and intentionally absent from source control.
import { buildCore } from "../../packages/vite-plugin/dist/build-core.js";

buildCore();
