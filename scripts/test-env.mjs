const required = process.argv.slice(2);
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  process.stderr.write(`Missing environment variables: ${missing.join(", ")}\n`);
  process.exitCode = 1;
}

