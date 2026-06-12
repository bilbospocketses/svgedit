# svgedit — 0b Launcher Design

**Date:** 2026-06-12
**Status:** Approved (design) — pending implementation plan
**Roadmap item:** #7 foundation step **0b** (the Velopack `--mainExe` launcher), following 0a (server skeleton, PR #127).

## Context & motivation

0a gave svgedit a real Node server (`src/server/` → `dist/server/index.js`, run via `npm run serve`) with port and data-root resolution. The next #7 foundation step is the **launcher**: a statically-linked native binary that Velopack designates as `--mainExe`, which brings the server up under a real install.

Velopack installs a payload and runs exactly one executable. For a Node app that executable cannot be `node` directly — `process.execPath` pointed at a service drops into a REPL-exit, there is no place to handle Velopack lifecycle hooks, no hidden-window spawn, and no PerMachine ACL grant. The launcher is that one executable: it wraps `node`, owns the Velopack handshake, and supervises the server.

Binding decision (#7, user 2026-06-11): a full architectural mirror of `ws-scrcpy-web`'s installer stack — same Velopack apparatus, same PerMachine model, same Rust-launcher-wraps-Node shape, same bundled-dependency discipline. 0b ports the **core launcher**. The service layer (#27) and the in-app updater (a later #7 milestone) are deferred, but their module seams are preserved so the later ports line up.

## Goals

- A statically-linked Rust launcher crate at `launcher/` building for `x86_64-pc-windows-msvc` and `x86_64-unknown-linux-musl`, serving as Velopack's `--mainExe`.
- Correct Velopack lifecycle: handle every `--veloapp-*` hook (including the undocumented `--veloapp-obsolete`) and disable auto-apply, so a normal install/update never enters a UAC, restart, or respawn loop.
- Spawn the bundled Node server hidden, with `SVGEDIT_DATA_ROOT` set to the install's writable root; supervise it (crash-restart with capped backoff); enforce single-instance.
- Windows: a one-time, first-run, elevated PerMachine ACL grant on the install root.
- Minimal launch UX: open the default browser once to the served URL after `/healthz` is healthy.
- Unit-tested pure logic, a documented dev integration smoke, and the authoritative VM smoke tracked as OWED.

## Non-goals (explicitly deferred — keeps 0b the core launcher)

- **In-app updater** — `UpdateService`, update download/apply, the supervisor's `exit 75` / `.restart` update-relaunch marker protocol, Linux `linux_apply`, `unzip_handler`. → a later #7 updater milestone.
- **Service layer** — `elevated_runner`, `linux_service` (systemd), `operation_server` (uninstall-handoff), `linux_app_uninstall`, `tray_supervisor`. → #27.
- **Packaging** — `vpk pack` / `--msi` / `--mainExe` wiring, `fetch-node` seed-Node bundling, `fetch-servy`, `stage-publish`, the release / auto-release workflows. → the Windows-MSI and Linux-AppImage milestones.
- **The real-install VM smoke** — code-green ≠ installable; tracked OWED, closed at the packaging milestone.
- **Device machinery** (adb / scrcpy / node-pty) — svgedit is a pure web server; these are absent by construction, not stripped work.

## Architecture

Mirrors `ws-scrcpy-web/launcher/`, stripped to the core modules. Cross-platform via `#[cfg]` gating (faithful to the sibling), not platform submodules.

```text
launcher/
  Cargo.toml          # bin crate `svgedit`; deps velopack + windows + an error crate (sibling minus device deps)
  build.rs            # version / icon / manifest embed; manifest asInvoker (self-elevates only for the ACL grant)
  .cargo/config.toml  # static CRT: win target-feature=+crt-static; linux musl target
  src/
    main.rs           # entry: veloapp-hook guard -> VelopackApp.run (auto-apply OFF) -> single-instance -> [win] ACL grant -> spawn+supervise -> browser-open
    hooks.rs          # --veloapp-{install,updated,uninstall,obsolete} + unknown-catch-all -> exit 0  (reduced: no update-apply)
    spawn.rs          # resolve bundled node + dist/server/index.js; set SVGEDIT_DATA_ROOT; spawn hidden ([win] CREATE_NO_WINDOW)
    supervisor.rs     # reduced: crash-restart with capped backoff; NO exit-75/.restart update protocol
    job_object.rs     # [win] child joins a job (dies with launcher); clear KILL_ON_JOB_CLOSE before graceful exit
    install_acl.rs    # [win] first-run elevated icacls grant on the install root (one-shot marker)
    uac_requester.rs  # [win] ShellExecuteExW verb=runas self-elevation + result detection
    paths.rs          # install_root / data_root / deps_path on win + linux
    single_instance.rs# per-user named mutex [win] / lockfile [nix]; 2nd launch re-opens browser then exits
    browser.rs        # open default browser: [win] ShellExecuteW("open", url) / [nix] xdg-open
  tests/              # cargo unit tests (pure logic)
```

The sibling reference is the working template: `ws-scrcpy-web/launcher/src/{main,hooks,spawn,supervisor,job_object,install_acl,uac_requester,paths,single_instance}.rs`, `launcher/Cargo.toml`, `launcher/build.rs`, plus `.github/workflows/release.yml` (the `cargo build` invocation + target triples). Each kept module is ported per the sibling, dropping every device / service / updater branch.

### Launch flow

```text
launcher start
  -> parse argv: any unknown --veloapp-* -> log + exit 0          (--veloapp-obsolete respawn-loop guard)
  -> VelopackApp.build().run()  with setAutoApplyOnStartup(false) (no UAC / restart loop)
       hooks: install/updated -> first-run dirs + log; uninstall -> cleanup; (no update download/apply)
  -> single_instance acquire -> if already running: open browser to existing port (config.json) + exit 0
  -> [win] first run after install (marker absent): self-elevate -> icacls grant -> write marker
  -> resolve paths (install/data/deps) -> spawn `node dist/server/index.js` hidden, env SVGEDIT_DATA_ROOT=<data_root>
  -> [win] child joins the job object
  -> poll <data_root>/config.json for webPort -> poll http://localhost:<port>/healthz -> open browser once
  -> supervise: child exits unexpectedly -> restart (capped backoff);
                SIGINT/SIGTERM -> graceful stop child, clear job kill-on-close, exit
```

## Velopack lifecycle & hooks

`VelopackApp.build().run()` must run in every process that touches Velopack APIs (per the per-process locator rule). In 0b only the **launcher** does — the Node child never calls Velopack until the updater lands — so the launcher is the sole site, and it calls `setAutoApplyOnStartup(false)` there.

Two failure modes are designed out up front, both inherited from the sibling and the consumer-side Velopack memory:

- **Auto-apply default = true** on the Rust SDK → UAC / restart loop on every launch. Disabled explicitly.
- **Undocumented `--veloapp-obsolete`** fires on the old binary before a swap; unhandled it respawns the launcher in a tight loop. A catch-all for any unrecognized `--veloapp-*` flag logs and exits 0.

`install`/`updated` hooks do first-run directory setup and log; `uninstall` cleans up. No update is downloaded or applied in 0b.

**Locator:** the launcher's own `current_exe` is the install-root / AppImage-mount mainExe, so VelopackApp's default auto-locate works on both platforms for 0b. The hand-built bundle-`__dirname`-anchored `VelopackLocatorConfig` (needed because the Node child's exe is *not* under `/usr/bin`) is an updater concern and is deferred with it. Install-detection (is this a Velopack install at all) keys off `Update.exe` existence next to the launcher.

## Spawn contract & data flow

0a defined the server's two environment seams; the launcher drives them:

- `SVGEDIT_DATA_ROOT` — the writable state root. The launcher **sets it** to the install's `data_root`, so the server skips its `<repo>/.svgedit-data` dev fallback.
- `SVGEDIT_WEB_PORT` — exact-port override. The launcher **does not set it** in 0b: it lets the server's `resolveWebPort()` own selection (auto-shift within `8100..8199`) and **persist** the bound port to `<data_root>/config.json`, then reads it back. (A future caller — #5 Control Menu, #27 service — may pass an exact port; the seam is ready, 0b just does not use it, avoiding a pick-then-taken race.)

Node-binary and server-entry resolution go through `paths.rs` against the install's own folder — **Local-Dependencies-Only**: never `PATH`, never an env-var tool lookup. The `velopack` crate is statically compiled into the launcher (compiled-in, so compliant); the bundled `node` is a separate binary resolved from `deps_path` under the install root. The production `deps_path` layout is finalized by `fetch-node` at the packaging milestone; 0b fixes the *resolution contract* and exposes dev-override envs (e.g. a node-path and server-entry override) so unit and dev-integration tests run without a real bundle.

The Windows spawn is hidden (`CREATE_NO_WINDOW`) so no console flashes on launch.

## Supervision, single-instance, job object

- `single_instance.rs` — a per-user named mutex `[win]` / lockfile `[nix]`. A second launch detects the running instance, opens the browser to its port (from `config.json`), and exits 0, so the app shortcut always surfaces the editor.
- `supervisor.rs` (reduced) — on an *unexpected* child exit, restart with capped backoff (N attempts within a window, then give up and surface the error). The `exit 75` / `.restart` update-relaunch marker protocol is **not** ported (updater territory).
- `job_object.rs` `[win]` — the child joins a Job Object so it dies with the launcher (no orphaned `node`). The launcher **clears `KILL_ON_JOB_CLOSE` before a graceful exit** — inert in 0b (nothing else is in the job yet) but the load-bearing discipline once the updater spawns `Update.exe`, where the flag otherwise reaps it mid-extract.

## PerMachine ACL grant + elevation (Windows)

Part of the breadcrumb's explicit 0b definition. On the first run after an install — gated by a one-shot marker under `data_root` — if the install is PerMachine (install root under Program Files, not writable), the launcher self-elevates via `ShellExecuteExW` verb `runas` (`uac_requester.rs`) and runs `icacls "<install_root>" /grant *S-1-5-11:(OI)(CI)M /T /C /Q` (`install_acl.rs`), then writes the marker. One UAC prompt per install.

This pre-grants install-root writability so Velopack's working state does not silently fall back to `%LocalAppData%` once the updater lands. The grant cannot be done from the `--veloapp-install` hook itself — the MSI component-permission step runs ~3s later and resets it — hence the first-launch timing. If the user declines or the grant fails, the launcher logs and continues: the server still runs entirely off `%PROGRAMDATA%`.

## Paths / install layout

`paths.rs` resolves three roots:

- `install_root` — from `current_exe` plus the Velopack locator. Win `%ProgramFiles%\svgedit`; Linux `/opt/svgedit` (machine-wide) or the AppImage mount / XDG (per-user).
- `data_root` — Win `%PROGRAMDATA%\svgedit`; Linux `/var/lib/svgedit` (machine) or `~/.local/share/svgedit` (`$XDG_DATA_HOME`, per-user). Passed to the child as `SVGEDIT_DATA_ROOT`.
- `deps_path` — the bundled `node` location under the install root. The resolution contract is fixed here; the staged layout is finalized by `fetch-node` at packaging.

The exact Linux machine-vs-`/var/opt` FHS split for the system service is a #27 concern; 0b uses the data-root convention above, which #27/#7 refine.

## Build & static linking

- `launcher/Cargo.toml` — a `bin` crate producing `svgedit.exe` / `svgedit`. Dependencies: `velopack`, the `windows` crate (Job Object, `ShellExecuteExW`, `CreateMutex`, `CREATE_NO_WINDOW`), and an error crate — the sibling's set minus the device ones.
- `.cargo/config.toml` — Win `target-feature=+crt-static`; Linux target `x86_64-unknown-linux-musl` (static by default). **Non-negotiable:** skip it and release #1 dies `VCRUNTIME140.dll not found`.
- `npm run build:launcher` → `cargo build --release` (per target). **Kept out of `npm run build`** so JS contributors do not need a Rust toolchain for the editor build; the packaging job invokes it.

## CI

A new `launcher` job (its own workflow or a job in the existing CI workflow), matrix `windows-latest` → msvc and `ubuntu-latest` → musl, running `cargo fmt --check` + `clippy -D warnings` + `cargo test` + `cargo build --release`. It gates the launcher green on both targets every push. No `vpk pack` here — that is the packaging milestone.

## Files touched

- **New:** `launcher/{Cargo.toml, build.rs, .cargo/config.toml}`, `launcher/src/{main,hooks,spawn,supervisor,job_object,install_acl,uac_requester,paths,single_instance,browser}.rs`, `launcher/tests/**`, and the launcher CI job (new workflow or an added job).
- **Edit:** `package.json` (`build:launcher` script), `.gitignore` (`launcher/target/`), docs (`AGENTS.md` + `README.md` launcher-build note), `CHANGELOG.md` (`## [Unreleased]` entry).

## Testing strategy

- **Unit (cargo, pure):** hook-flag parse, including the unknown-`--veloapp-*` catch-all; path resolution on both platforms via injectable env; child env/arg construction; the **icacls argument string asserted by value, never executed** (verification-trust: validate privileged/destructive commands by metadata, do not run-to-test); `config.json` port parse; browser-URL construction; single-instance acquire / contend.
- **Dev integration smoke (documented, not a CI gate):** stage a dev `node` + the repo `dist/` into the expected layout via the override envs, run the launcher, assert `/healthz` is ok and the browser opens. Needs no real bundle.
- **Authoritative VM smoke (Win11 Hyper-V + Fedora):** deferred to the MSI / AppImage milestones. Code-green ≠ installable; 0b carries **"VM smoke OWED"** forward until packaging closes it.

## Release / changelog

Per the repo's `## [Unreleased]`-only convention, this work adds an `## [Unreleased]` entry and **no version bump** — release mechanics are 0c, and releases begin only once packaging produces artifacts. There is no user-facing artifact in 0b.

## Relationship to roadmap (for future sessions)

- **#7 Windows MSI** consumes this launcher as `--mainExe` (`vpk pack --msi --instLocation PerMachine`) and adds `fetch-node` + `stage-publish`.
- **#7 Linux AppImage** adds the musl launcher to the AppImage (+ `swap-appimage-runtime`); the later updater milestone adds `UpdateService`, `linux_apply`, and the supervisor's update-relaunch protocol.
- **#27 services** wrap this launcher — Win servy `--path <launcher>`, Linux systemd `ExecStart` — the launcher exe is the stable `0755` entrypoint a service points at.
- **#5 Control Menu** launches the installed app via this launcher as a supervisable sidecar, optionally assigning a port through `SVGEDIT_WEB_PORT`.
