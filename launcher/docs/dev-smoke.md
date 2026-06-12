# 0b launcher — dev integration smoke

Proves: launcher → spawns node → 0a server → `/healthz` ok → browser opens once.
This is a manual dev check. The authoritative install smoke is the Win11/Fedora
VM pass at the packaging milestone (still **OWED** after 0b).

## Setup

1. Build the web app: `npm run build` (produces `dist/server/` + `dist/editor/`).
2. Build the launcher: `npm run build:launcher`.
3. Stage a layout the launcher expects (it resolves `node` + `dist/` relative to
   its own exe dir, with `current/` as the exe dir and install root its parent):

   ```text
   smoke/
     current/
       svgedit(.exe)          # copy from launcher/target/release/
       dist/  -> copy of the repo's dist/
       seed/node/node(.exe)   # copy your local node binary here
   ```

   On Windows PowerShell:

   ```powershell
   $S = "smoke/current"
   New-Item -ItemType Directory -Force "$S/seed/node" | Out-Null
   Copy-Item launcher/target/release/svgedit.exe "$S/"
   Copy-Item -Recurse dist "$S/dist"
   Copy-Item (Get-Command node).Source "$S/seed/node/node.exe"
   $env:SVGEDIT_DATA_ROOT = (Resolve-Path .).Path + "/smoke/data"
   & "$S/svgedit.exe"
   ```

## Expected

- A hidden node process starts (no console window flashes).
- `smoke/data/config.json` appears with a `webPort` (8100 or a shifted port).
- The default browser opens to `http://localhost:<port>/` showing the editor.
- `smoke/data/logs/svgedit-launcher.log` shows: server started → server healthy → opening.
- Launching `svgedit.exe` a second time opens a browser tab and exits (no 2nd server).
- Ctrl+C / closing the launcher stops the node child (no orphan in Task Manager).
