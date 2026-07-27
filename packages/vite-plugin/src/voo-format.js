import { parseVooComponent } from "./voo-parser.js";

export function formatVooComponent(source, id = "<anonymous>.voo") {
  const component = parseVooComponent(source, id);
  if (component.format !== "source") {
    throw new Error(`Cannot format transitional Voo manifest ${id}.`);
  }

  const componentBlock = extractBlock(source, "component", true, id);
  const rustBlock = extractBlock(source, "rust", true, id);
  const styleBlock = extractBlock(source, "style", false, id);
  assertNoTopLevelContent(source, [componentBlock, rustBlock, styleBlock].filter(Boolean), id);

  const sections = [
    `<component name=${JSON.stringify(component.name)}>`,
    ...formatContract(componentBlock.content, component),
    "</component>",
    "",
    "<rust>",
    normalizeBlockContent(component.rust.content),
    "</rust>",
  ];
  if (component.style) {
    sections.push(
      "",
      `<style${component.style.scoped ? " scoped" : ""}>`,
      normalizeBlockContent(component.style.content),
      "</style>",
    );
  }
  return `${sections.join("\n")}\n`;
}

function formatContract(source, component) {
  const lines = [];
  let section;
  let propIndex = 0;
  let eventIndex = 0;

  for (const rawLine of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      appendBlank(lines);
      continue;
    }
    if (line.startsWith("//")) {
      lines.push(`${section ? "  " : ""}${line}`);
      continue;
    }
    if (line === "props:" || line === "events:") {
      if (lines.length > 0) appendBlank(lines);
      section = line.slice(0, -1);
      lines.push(line);
      continue;
    }

    const commentAt = line.indexOf("//");
    const comment = commentAt === -1 ? "" : ` ${line.slice(commentAt).trim()}`;
    if (section === "props") {
      const prop = component.props[propIndex++];
      lines.push(
        `  ${prop.name}: ${prop.rustType}${
          prop.defaultValue === undefined ? "" : ` = ${prop.defaultValue}`
        }${comment}`,
      );
      continue;
    }
    if (section === "events") {
      const event = component.events[eventIndex++];
      const parameters = event.parameters
        .map((parameter) => `${parameter.name}: ${parameter.rustType}`)
        .join(", ");
      lines.push(`  ${event.name}(${parameters})${comment}`);
    }
  }

  while (lines[0] === "") lines.shift();
  while (lines.at(-1) === "") lines.pop();
  return lines;
}

function extractBlock(source, tag, required, id) {
  const expression = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
  const matches = [...source.matchAll(expression)];
  if (matches.length === 0) {
    if (!required) return undefined;
    throw new Error(`Missing <${tag}> block in ${id}.`);
  }
  if (matches.length > 1) throw new Error(`Duplicate <${tag}> block in ${id}.`);
  const [match] = matches;
  return { content: match[1], start: match.index, end: match.index + match[0].length };
}

function assertNoTopLevelContent(source, blocks, id) {
  let remaining = source;
  for (const block of [...blocks].sort((left, right) => right.start - left.start)) {
    remaining = `${remaining.slice(0, block.start)}${remaining.slice(block.end)}`;
  }
  if (remaining.trim()) {
    throw new Error(`Cannot safely format top-level content in ${id}.`);
  }
}

function normalizeBlockContent(source) {
  return source.replace(/\r\n/g, "\n");
}

function appendBlank(lines) {
  if (lines.length > 0 && lines.at(-1) !== "") lines.push("");
}
