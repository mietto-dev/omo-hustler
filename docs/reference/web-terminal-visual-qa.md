# Web Terminal Visual QA

This reference covers visual QA for retained OpenCode terminal surfaces.

## Evidence

Record the command, environment, and observed output in the task evidence
directory. Attach screenshots such as `terminal.png` only when they are needed
to explain a visual result; do not commit temporary images. For GitHub PR
attachments, follow the [GitHub attachment upload guidance](github-attachment-upload.md)
in `docs/reference/github-attachment-upload.md`.

## Driver

Run `script/qa/web-terminal-visual-qa.mjs` to capture terminal evidence through
the retained xterm.js browser path. Use `--redact` for literal secrets and
`--redact-regex` for pattern-based secrets. The raw --command value is never
written to metadata.

## Runtime requirements

The visual driver needs `node-pty` and a system Chrome or Chromium. Set
`CHROME_BIN` or pass `--chrome-bin` when the browser is not on the default path.

Validate observable behavior rather than relying on unit tests alone: expected
text must be present, colors must be correct, and the terminal must not overflow
or misalign borders and CJK-width text.
