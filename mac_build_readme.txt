Mac build package notes

Project type
- Electron + React + TypeScript
- Build tool: electron-vite
- Packager: electron-builder

Current status
- Windows: `npm run build:win`（`updater.exe` 已通过 `build.win.extraFiles` 打入安装目录；图标需 `build/icon.ico`）。
- macOS 便携版：分两包 zip — **Apple Silicon (arm64)**：`wenben-mac-portable-<version>-arm64.zip`；**Intel (x64)**：`wenben-mac-portable-<version>-x64.zip`。解压后为 `文本文件处理工具.app`。

无本机 Mac 时：用 GitHub Actions 打包
1. 将本目录作为仓库根推送到 GitHub（例如 `Apple-ux-ai/wenben`）。
2. 打开仓库 **Actions**，选择工作流 **macOS 便携版 zip**。
3. 推送至 `main` 会自动运行；也可手动 **Run workflow**。
4. 运行结束后在 **Artifacts** 分别下载 `wenben-mac-arm64` 与 `wenben-mac-x64`（各含对应架构 zip）。

本地在 macOS 上打包
1. `npm ci` 或 `npm install`
2. `npm run build:mac`
3. 在 `dist_102_v2/` 查看 zip。

Important note
- 当前 CI 为未公证（notarize）的便携包；首次打开时用户可能需在「隐私与安全性」中允许运行。
- 若需 Apple 公证与分发签名，需在 Apple Developer 配置证书并在 workflow 中接入签名步骤。
