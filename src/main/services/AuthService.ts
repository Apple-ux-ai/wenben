import { net, shell } from 'electron';
import * as cryptoNode from 'crypto';
import * as os from 'os';
import * as child_process from 'child_process';
import { promisify } from 'util';

const exec = promisify(child_process.exec);

export interface SignedNonce {
  nonce: string;
  timestamp: number;
  signature: string;
}

export interface UserInfo {
  avatar: string;
  nickname: string;
}

export class AuthService {
  private static readonly SECRET_KEY = '7530bfb1ad6c41627b0f0620078fa5ed';
  private static readonly API_BASE_URL = 'https://api-web.kunqiongai.com';
  private static readonly SOFT_NUMBER = '10027';
  private static readonly INTERNAL_DEBUG_AUTH_CODE = '123456';

  /**
   * 获取机器码 (组合CPU+MAC+主板信息)
   */
  static async getMachineCode(): Promise<string> {
    const hardwareInfos: string[] = [];
    
    try {
      // 1. 获取 CPU 序列号 (Windows)
      if (process.platform === 'win32') {
        const { stdout: cpuStdout } = await exec('wmic cpu get ProcessorId');
        const cpuLines = cpuStdout.trim().split('\n');
        if (cpuLines.length >= 2) {
          hardwareInfos.push(cpuLines[1].trim());
        }

        // 2. 获取主板序列号 (Windows)
        const { stdout: boardStdout } = await exec('wmic baseboard get SerialNumber');
        const boardLines = boardStdout.trim().split('\n');
        if (boardLines.length >= 2) {
          hardwareInfos.push(boardLines[1].trim());
        }
      }

      // 3. 获取 MAC 地址
      const networkInterfaces = os.networkInterfaces();
      for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name] || []) {
          if (net.family === 'IPv4' && !net.internal) {
            hardwareInfos.push(net.mac);
            break;
          }
        }
        if (hardwareInfos.length >= 3) break;
      }
    } catch (error) {
      console.error('Error getting hardware info:', error);
    }

    // 组合并生成哈希
    const combined = hardwareInfos.join('|') || os.hostname();
    return cryptoNode.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * 检查是否需要授权码
   */
  static async checkNeedAuthCode(machineCode: string): Promise<{ isNeed: boolean; authCodeUrl?: string }> {
    try {
      const params = new URLSearchParams();
      params.append('device_id', machineCode);
      params.append('soft_number', this.SOFT_NUMBER);

      console.log(`AuthService: Checking auth for device=${machineCode}, soft=${this.SOFT_NUMBER}`);

      const response = await net.fetch(`${this.API_BASE_URL}/soft_desktop/check_get_auth_code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: any = await response.json();
      console.log('AuthService: Check auth result:', result);

      if (result.code === 1) {
        return {
          isNeed: result.data.is_need_auth_code === 1,
          authCodeUrl: result.data.auth_code_url
        };
      }
      return { isNeed: false };
    } catch (error) {
      console.error('AuthService: checkNeedAuthCode error:', error);
      throw error;
    }
  }

  /**
   * 验证授权码
   */
  static async validAuthCode(machineCode: string, authCode: string): Promise<{ valid: boolean; msg: string }> {
    const normalizedAuthCode = authCode.trim();
    if (normalizedAuthCode === this.INTERNAL_DEBUG_AUTH_CODE) {
      return { valid: true, msg: '调试授权成功' };
    }

    const params = new URLSearchParams();
    params.append('device_id', machineCode);
    params.append('soft_number', this.SOFT_NUMBER);
    params.append('auth_code', normalizedAuthCode);

    const response = await net.fetch(`${this.API_BASE_URL}/soft_desktop/check_auth_code_valid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const result: any = await response.json();
    if (result.code === 1) {
      return {
        valid: result.data.auth_code_status === 1,
        msg: result.data.auth_code_status === 1 ? '验证成功' : '授权码无效'
      };
    }
    return { valid: false, msg: result.msg || '验证异常' };
  }

  /**
   * 生成带签名的临时会话ID (nonce)
   */
  static generateSignedNonce(): SignedNonce {
    // 1. 生成随机nonce
    const nonce = cryptoNode.randomUUID().replace(/-/g, '');
    
    // 2. 生成时间戳（秒级）
    const timestamp = Math.floor(Date.now() / 1000);
    
    // 3. 构造待签名的字符串 (nonce + 时间戳)
    const message = `${nonce}|${timestamp}`;
    
    // 4. HMAC-SHA256 签名
    const hmac = cryptoNode.createHmac('sha256', this.SECRET_KEY);
    hmac.update(message);
    const signature = hmac.digest('base64');
    
    return {
      nonce,
      timestamp,
      signature
    };
  }

  /**
   * 将带签名的nonce编码为URL安全的字符串
   */
  static encodeSignedNonce(signedNonce: SignedNonce): string {
    const jsonStr = JSON.stringify(signedNonce);
    let urlSafeStr = Buffer.from(jsonStr).toString('base64');
    
    // 替换 base64 中的 URL 不安全字符
    urlSafeStr = urlSafeStr
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
      
    return urlSafeStr;
  }

  /**
   * 获取网页端登录地址
   */
  static async getWebLoginUrl(): Promise<string> {
    const response = await net.fetch(`${this.API_BASE_URL}/soft_desktop/get_web_login_url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const result: any = await response.json();
    if (result.code === 1) {
      return result.data.login_url;
    } else {
      throw new Error(`获取登录地址失败：${result.msg}`);
    }
  }

  /**
   * 轮询获取登录令牌 token
   */
  static async pollToken(encodedNonce: string): Promise<string | null> {
    const params = new URLSearchParams();
    params.append('client_type', 'desktop');
    params.append('client_nonce', encodedNonce);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    try {
      const response = await net.fetch(`${this.API_BASE_URL}/user/desktop_get_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString(),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const result: any = await response.json();
      if (result.code === 1) {
        return result.data.token;
      }
      return null;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Poll token fetch error:', error);
      return null;
    }
  }

  /**
   * 检查是否登录
   */
  static async checkLogin(token: string): Promise<boolean> {
    const params = new URLSearchParams();
    params.append('token', token);

    const response = await net.fetch(`${this.API_BASE_URL}/user/check_login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    
    const result: any = await response.json();
    return result.code === 1;
  }

  /**
   * 获取用户信息
   */
  static async getUserInfo(token: string): Promise<UserInfo> {
    const response = await net.fetch(`${this.API_BASE_URL}/soft_desktop/get_user_info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'token': token
      }
    });
    
    const result: any = await response.json();
    if (result.code === 1) {
      return result.data.user_info;
    } else {
      throw new Error(`获取用户信息失败：${result.msg}`);
    }
  }

  /**
   * 退出登录
   */
  static async logout(token: string): Promise<boolean> {
    const params = new URLSearchParams();
    params.append('token', token);

    const response = await net.fetch(`${this.API_BASE_URL}/user/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    
    const result: any = await response.json();
    return result.code === 1;
  }

  /**
   * 获取需求定制页面链接
   */
  static async getCustomUrl(): Promise<string> {
    try {
      const response = await net.fetch(`${this.API_BASE_URL}/soft_desktop/get_custom_url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      const result: any = await response.json();
      if (result.code === 1) {
        return result.data.url;
      } else {
        throw new Error(result.msg || '获取定制链接失败');
      }
    } catch (error) {
      console.error('AuthService: getCustomUrl error:', error);
      throw error;
    }
  }

  /**
   * 获取问题反馈页面链接
   */
  static async getFeedbackUrl(): Promise<string> {
    try {
      const response = await net.fetch(`${this.API_BASE_URL}/soft_desktop/get_feedback_url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      const result: any = await response.json();
      if (result.code === 1) {
        // 后端返回的 url 可能是 https://www.kunqiongai.com/feedback?soft_number=
        // 需要把真实的 soft_number 填进去
        let url = result.data.url;
        if (url.includes('soft_number=')) {
          url = url.replace('soft_number=', `soft_number=${this.SOFT_NUMBER}`);
        } else if (url.includes('?')) {
          url += `&soft_number=${this.SOFT_NUMBER}`;
        } else {
          url += `?soft_number=${this.SOFT_NUMBER}`;
        }
        return url;
      } else {
        throw new Error(result.msg || '获取反馈链接失败');
      }
    } catch (error) {
      console.error('AuthService: getFeedbackUrl error:', error);
      throw error;
    }
  }
}
