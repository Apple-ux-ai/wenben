import { net, app } from 'electron';
import * as path from 'path';
import * as child_process from 'child_process';
import * as fs from 'fs';

export interface UpdateCheckResult {
  has_update: boolean;
  version?: string;
  update_log?: string;
  download_url?: string;
  package_hash?: string;
  is_mandatory?: boolean;
}

export class UpdateService {
  // 这里的 URL 来自 "更新/API使用指南.md"
  private static readonly UPDATE_API_URL = 'http://software.kunqiongai.com:8000/api/v1/updates/check/';
  private static readonly SOFTWARE_ID = '10027'; // 与 AuthService 中的 SOFT_NUMBER 保持一致，或根据 API 要求

  /**
   * 检查更新
   */
  static async checkUpdate(): Promise<UpdateCheckResult> {
    try {
      const currentVersion = app.getVersion();
      const url = new URL(this.UPDATE_API_URL);
      url.searchParams.append('software', this.SOFTWARE_ID);
      url.searchParams.append('version', currentVersion);

      console.log(`UpdateService: Checking for updates at ${url.toString()}`);

      const response = await net.fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Update check failed: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();
      console.log('UpdateService: Update check result:', data);

      return {
        has_update: data.has_update,
        version: data.version,
        update_log: data.update_log,
        download_url: data.download_url,
        package_hash: data.package_hash,
        is_mandatory: data.is_mandatory
      };
    } catch (error) {
      console.error('UpdateService: Check update error:', error);
      return { has_update: false };
    }
  }

  /**
   * 启动独立更新程序
   * @param downloadUrl 更新包下载地址
   * @param hash 更新包哈希
   */
  static startUpdater(downloadUrl: string, hash?: string) {
    // 1. 确定 updater.exe 路径
    // 在开发环境，可能在项目根目录
    // 在生产环境，通常在安装根目录 (跟主程序同级)
    let updaterPath = path.join(path.dirname(app.getPath('exe')), 'updater.exe');
    
    // 开发环境兼容 (如果是在 electron-vite dev 模式下)
    if (!app.isPackaged) {
        // 尝试在上层目录寻找 (根据实际情况调整)
        const devPath = path.join(app.getAppPath(), '../../updater.exe'); // 假设 main.js 在 out/main/，appPath 在 out/.. ? 
        // 实际上 electron-vite dev 时 app.getAppPath() 通常指向项目根目录或 src
        // 我们刚才把 updater.exe 复制到了项目根目录 c:\Users\admin\Desktop\wenben （ui优化1.0）\wenben\updater.exe
        if (fs.existsSync(path.join(process.cwd(), 'updater.exe'))) {
            updaterPath = path.join(process.cwd(), 'updater.exe');
        }
    }

    if (!fs.existsSync(updaterPath)) {
      console.error(`UpdateService: Updater not found at ${updaterPath}`);
      throw new Error('Updater not found');
    }

    const appDir = path.dirname(app.getPath('exe'));
    const exeName = path.basename(app.getPath('exe'));
    const pid = process.pid;

    const args = [
      '--url', downloadUrl,
      '--dir', appDir,
      '--exe', exeName,
      '--pid', pid.toString()
    ];

    if (hash) {
      args.push('--hash', hash);
    }

    console.log(`UpdateService: Spawning updater: ${updaterPath} ${args.join(' ')}`);

    // 2. 启动 updater
    const subprocess = child_process.spawn(updaterPath, args, {
      detached: true,
      stdio: 'ignore'
    });

    subprocess.unref();

    // 3. 退出主程序
    app.quit();
  }
}
