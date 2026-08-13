// The bridge exchanges JSON-RPC payloads with rust-analyzer, whose wire shape
// is intentionally tolerant across supported server releases.
// @ts-nocheck
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const extensionRoot = fileURLToPath(new URL("..", import.meta.url));
const bundledRuntimeRoot = join(extensionRoot, "runtime", "vooya-core");
export function extractEmbeddedRust(source, sourceUri) {
    const opening = /<rust\b[^>]*>/.exec(source);
    if (!opening)
        return undefined;
    const contentStart = opening.index + opening[0].length;
    const closing = source.indexOf("</rust>", contentStart);
    if (closing === -1)
        return undefined;
    const raw = source.slice(contentStart, closing);
    const leadingNewline = /^\r?\n/.test(raw);
    const content = raw.replace(/^\r?\n/, "").replace(/\r?\n\s*$/, "");
    const contract = parseContract(source);
    return {
        sourceUri,
        content,
        contract,
        // Rust-analyzer positions are zero-based; this is the original zero-based
        // line at which extracted Rust line 0 appears.
        sourceLineOffset: source.slice(0, contentStart).split(/\r?\n/).length - 1 + (leadingNewline ? 1 : 0),
    };
}
export function mapDiagnostic(diagnostic, sourceLineOffset) {
    const range = diagnostic.range;
    if (!range)
        return undefined;
    return {
        ...diagnostic,
        range: {
            start: { ...range.start, line: range.start.line + sourceLineOffset },
            end: { ...range.end, line: range.end.line + sourceLineOffset },
        },
    };
}
export async function prepareBridgeWorkspace(storageRoot, extracted, { runtimeCrateRoot = bundledRuntimeRoot } = {}) {
    const key = createHash("sha256").update(extracted.sourceUri).digest("hex").slice(0, 16);
    const root = join(storageRoot, "vooya-rust-bridge", key);
    const sourcePath = join(root, "src", "lib.rs");
    await rm(root, { force: true, recursive: true });
    await mkdir(dirname(sourcePath), { recursive: true });
    const prelude = generatedHarnessPrelude(extracted.contract);
    await writeFile(join(root, "Cargo.toml"), generatedCargoManifest(runtimeCrateRoot), "utf8");
    const sourceText = `${prelude}${extracted.content}\n`;
    await writeFile(sourcePath, sourceText, "utf8");
    return { root, sourcePath, sourceUri: pathToFileUri(sourcePath), sourceText, generatedLineOffset: prelude.split(/\r?\n/).length - 1 };
}
export async function cleanupBridgeStorage(storageRoot) {
    await rm(join(storageRoot, "vooya-rust-bridge"), { force: true, recursive: true });
}
export async function collectRustAnalyzerDiagnostics(workspace, extracted, { command = "rust-analyzer", timeoutMs = 10_000 } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, [], { cwd: workspace.root, stdio: ["pipe", "pipe", "pipe"] });
        let buffer = Buffer.alloc(0);
        let diagnosticsTimer;
        const timer = setTimeout(() => finish(new Error(`rust-analyzer did not publish diagnostics within ${timeoutMs}ms`)), timeoutMs);
        const send = (message) => child.stdin.write(`Content-Length: ${Buffer.byteLength(JSON.stringify(message))}\r\n\r\n${JSON.stringify(message)}`);
        const finish = (error, result = []) => {
            clearTimeout(timer);
            clearTimeout(diagnosticsTimer);
            child.kill();
            error ? reject(error) : resolve(result);
        };
        child.on("error", (error) => finish(error));
        child.stdout.on("data", (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            while (true) {
                const boundary = buffer.indexOf("\r\n\r\n");
                if (boundary < 0)
                    return;
                const header = buffer.slice(0, boundary).toString();
                const length = Number(/Content-Length: (\d+)/i.exec(header)?.[1]);
                if (!Number.isFinite(length) || buffer.length < boundary + 4 + length)
                    return;
                const message = JSON.parse(buffer.slice(boundary + 4, boundary + 4 + length).toString());
                buffer = buffer.slice(boundary + 4 + length);
                if (message.id === 1) {
                    send({ jsonrpc: "2.0", method: "initialized", params: {} });
                    send({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: workspace.sourceUri, languageId: "rust", version: 1, text: workspace.sourceText } } });
                }
                if (message.method === "textDocument/publishDiagnostics" &&
                    message.params?.uri === workspace.sourceUri &&
                    Array.isArray(message.params.diagnostics)) {
                    // rust-analyzer may first publish diagnostics from the on-disk file,
                    // then replace them after didOpen. Wait for the short quiet period
                    // so a stale pre-didOpen range cannot be mapped to .voo.
                    clearTimeout(diagnosticsTimer);
                    const diagnostics = message.params.diagnostics;
                    diagnosticsTimer = setTimeout(() => finish(undefined, diagnostics), 1_000);
                }
            }
        });
        send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { processId: process.pid, rootUri: pathToFileUri(workspace.root), capabilities: {} } });
    });
}
export function mapWorkspaceDiagnostic(diagnostic, extracted, workspace) {
    if (!diagnostic.range || diagnostic.range.start.line < workspace.generatedLineOffset)
        return undefined;
    return mapDiagnostic({
        ...diagnostic,
        range: {
            start: { ...diagnostic.range.start, line: diagnostic.range.start.line - workspace.generatedLineOffset },
            end: { ...diagnostic.range.end, line: diagnostic.range.end.line - workspace.generatedLineOffset },
        },
    }, extracted.sourceLineOffset);
}
function parseContract(source) {
    const block = /<component\b[^>]*>([\s\S]*?)<\/component>/.exec(source)?.[1];
    if (block === undefined)
        throw new Error("Vooya bridge requires a <component> contract before <rust>.");
    const props = [];
    const events = [];
    let section;
    for (const raw of block.split(/\r?\n/)) {
        const line = raw.replace(/\/\/.*$/, "").trim();
        if (!line)
            continue;
        if (line === "props:" || line === "events:") {
            section = line.slice(0, -1);
            continue;
        }
        if (section === "props") {
            const match = /^([A-Za-z_]\w*)\s*:\s*(.+?)(?:\s*=\s*.+)?$/.exec(line);
            if (!match)
                throw new Error(`Unsupported Vooya prop contract: ${line}`);
            props.push({ name: match[1], type: match[2].trim() });
        }
        else if (section === "events") {
            const match = /^([A-Za-z_]\w*)\s*\((.*)\)$/.exec(line);
            if (!match)
                throw new Error(`Unsupported Vooya event contract: ${line}`);
            const parameters = match[2].trim() ? match[2].split(",").map((part) => {
                const parameter = /^\s*([A-Za-z_]\w*)\s*:\s*(.+?)\s*$/.exec(part);
                if (!parameter)
                    throw new Error(`Unsupported Vooya event parameter: ${part}`);
                return { name: parameter[1], type: parameter[2] };
            }) : [];
            events.push({ name: match[1], parameters });
        }
    }
    return { props, events };
}
function generatedCargoManifest(runtimeCrateRoot) {
    return `[package]\nname = "vooya_editor_bridge"\nversion = "0.0.0"\nedition = "2024"\n\n[workspace]\n\n[dependencies]\nvooya-core = { path = ${JSON.stringify(runtimeCrateRoot)} }\njs-sys = "=0.3.92"\nwasm-bindgen = "=0.2.115"\nweb-sys = { version = "=0.3.92", features = ["CustomEvent", "CustomEventInit", "Document", "Element", "Event", "EventTarget", "HtmlCollection", "HtmlElement", "HtmlInputElement", "Node", "Window"] }\n`;
}
function generatedHarnessPrelude(contract) {
    const props = contract.props.map(({ name, type }) => `    pub ${name}: ${type},`).join("\n");
    const methods = contract.events.map(({ name, parameters }) => `    pub fn ${name}(&self${parameters.map(({ name: parameter, type }) => `, ${parameter}: ${type}`).join("")}) -> Result<(), wasm_bindgen::JsValue> { Ok(()) }`).join("\n");
    return `// Generated by Vooya VS Code diagnostics bridge.\npub use vooya_core::*;\npub struct Props {\n${props}\n}\n#[derive(Clone)]\npub struct Events;\nimpl Events {\n${methods}\n}\npub struct Context {\n    pub host: web_sys::Element,\n    pub props: Props,\n    pub events: Events,\n    pub cleanup: vooya_core::MountCleanup,\n}\n`;
}
function pathToFileUri(path) {
    return new URL(`file://${path}`).toString();
}
