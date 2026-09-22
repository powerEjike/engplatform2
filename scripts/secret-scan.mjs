import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ignoredDirectories = new Set([".git", ".next", "coverage", "node_modules"]);
const files = [];
function collectFiles(directory = ".") {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) collectFiles(join(directory, entry.name));
    } else if (entry.isFile()) {
      files.push(join(directory, entry.name));
    }
  }
}
collectFiles();

const patterns = [
  { name: "Resend API key", expression: /\bre_[A-Za-z0-9_]{20,}\b/ },
  { name: "GitHub personal access token", expression: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: "OpenAI API key", expression: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "AWS access key", expression: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Private key", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

const findings = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const pattern of patterns) {
    if (pattern.expression.test(content)) findings.push(`${pattern.name} pattern found in ${file}`);
  }
}

if (findings.length) {
  console.error("Potential committed secrets detected:\n" + findings.join("\n"));
  process.exit(1);
}

console.log(`Secret scan passed for ${files.length} repository files.`);
