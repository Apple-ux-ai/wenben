import { net } from 'electron';

export interface Advertisement {
  soft_number: number;
  adv_position: string;
  adv_url: string;
  target_url: string;
  width: number;
  height: number;
}

export class AdvService {
  private static readonly API_BASE_URL = 'https://api-web.kunqiongai.com';
  private static readonly SOFT_NUMBER = '10019';

  /**
   * 获取指定位置的广告
   */
  static async getAdvertisement(position: string): Promise<Advertisement[]> {
    console.log(`Fetching ads for position: ${position}, soft_number: ${this.SOFT_NUMBER}`);
    const params = new URLSearchParams();
    params.append('soft_number', this.SOFT_NUMBER);
    params.append('adv_position', position);

    try {
      const response = await net.fetch(`${this.API_BASE_URL}/soft_desktop/get_adv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const result: any = await response.json();
      console.log(`Ads response for ${position}:`, JSON.stringify(result));
      if (result.code === 1) {
        return result.data || [];
      } else {
        console.error(`获取广告失败 [${position}]: ${result.msg}`);
        return [];
      }
    } catch (error) {
      console.error(`获取广告异常 [${position}]:`, error);
      return [];
    }
  }
}
