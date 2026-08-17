#!/usr/bin/env node
import { formatToolchainReport, inspectToolchain } from "../dist/doctor.js";

const parsed = parseDoctorArguments(process.argv.slice(2));
if (parsed.help) {
  console.log("Usage: vooya doctor [--cargo-path <path>]");
} else if (parsed.error) {
  console.error(parsed.error);
  console.error("Usage: vooya doctor [--cargo-path <path>]");
  process.exitCode = 1;
} else {
  const report = inspectToolchain({ cargoPath: parsed.cargoPath });
  console.log(formatToolchainReport(report));
  if (!report.ok) process.exitCode = 1;
}

export function parseDoctorArguments(args) {
  if (args[0] === "--help" || args[0] === "-h") return { help: true };
  if (args[0] !== "doctor") return { error: "Unknown command." };

  let cargoPath;
  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--cargo-path") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) return { error: "--cargo-path requires a path." };
      if (cargoPath !== undefined) return { error: "--cargo-path may be specified only once." };
      cargoPath = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--cargo-path=")) {
      const value = argument.slice("--cargo-path=".length);
      if (!value) return { error: "--cargo-path requires a path." };
      if (cargoPath !== undefined) return { error: "--cargo-path may be specified only once." };
      cargoPath = value;
      continue;
    }
    return { error: `Unknown argument: ${argument}` };
  }
  return { command: "doctor", cargoPath };
}
