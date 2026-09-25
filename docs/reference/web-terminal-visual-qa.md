# Web Terminal Visual QA

This reference covers visual QA for retained OpenCode terminal surfaces.

## Evidence

Record the command, environment, and observed output in the task evidence
directory. Attach screenshots such as `terminal.png` only when they are needed
to explain a visual result; do not commit temporary images.

## Runtime requirements

The visual driver needs `node-pty` and a system Chrome or Chromium. Set
`CHROME_BIN` or pass `--chrome-bin` when the browser is not on the default path.

Validate observable behavior rather than relying on unit tests alone: expected
text must be present, colors must be correct, and the terminal must not overflow
or misalign borders and CJK-width text.
