import { describe, it, expect } from 'vitest';
import { AuthService } from './AuthService';
import * as cryptoNode from 'crypto';

describe('AuthService', () => {
  it('should generate a valid signed nonce', () => {
    const signedNonce = AuthService.generateSignedNonce();
    
    expect(signedNonce.nonce).toBeDefined();
    expect(signedNonce.nonce.length).toBeGreaterThan(0);
    expect(signedNonce.timestamp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    expect(signedNonce.signature).toBeDefined();
    
    // 验证签名算法
    const message = `${signedNonce.nonce}|${signedNonce.timestamp}`;
    const hmac = cryptoNode.createHmac('sha256', '7530bfb1ad6c41627b0f0620078fa5ed');
    hmac.update(message);
    const expectedSignature = hmac.digest('base64');
    
    expect(signedNonce.signature).toBe(expectedSignature);
  });

  it('should encode signed nonce to a URL-safe base64 string', () => {
    const signedNonce = {
      nonce: 'testnonce',
      timestamp: 1234567890,
      signature: 'test+signature/with=equals'
    };
    
    const encoded = AuthService.encodeSignedNonce(signedNonce);
    
    // 检查不安全字符是否被替换
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
    
    // 尝试解码回来
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const decoded = JSON.parse(Buffer.from(base64, 'base64').toString());
    
    expect(decoded).toEqual(signedNonce);
  });

  it('should pass internal debug auth code directly', async () => {
    const result = await AuthService.validAuthCode('machine-debug', '123456');
    expect(result.valid).toBe(true);
    expect(result.msg).toBe('调试授权成功');
  });
});
