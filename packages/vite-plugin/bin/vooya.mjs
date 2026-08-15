#!/usr/bin/env node
import { formatToolchainReport, inspectToolchain } from "../dist/doctor.js";

const [command] = process.argv.slice(2);
if (command !== "doctor") {
  console.error("Usage: vooya doctor");
  process.exitCode = 1;
} else {
  const report = inspectToolchain();
  console.log(formatToolchainReport(report));
  if (!report.ok) process.exitCode = 1;
}
