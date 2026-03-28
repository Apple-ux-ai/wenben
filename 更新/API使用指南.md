# 软件版本管理平台 - API 使用指南

本文档说明如何获取上传的软件安装包和更新包。

---

## 一、获取下载链接的方式

### 方式1：通过管理后台查看

1. 登录管理后台：`http://software.kunqiongai.com:8000/admin/`
2. 进入「软件」或「版本」页面
3. 点击已上传的文件，查看下载链接

### 方式2：通过 API 接口获取（推荐）

平台提供以下 API 接口：

| 接口 | 功能 | 示例 |
|------|------|------|
| 检查更新 | 获取最新版本下载信息 | `/api/v1/updates/check/` |
| 获取安装包 | 获取软件安装包信息 | `/api/v1/updates/installer/` |
| 软件列表 | 获取所有软件信息 | `/api/v1/software/` |

---

## 二、API 详细说明

### 2.1 检查更新（客户端自动升级用）

**请求：**
```http
GET http://software.kunqiongai.com:8000/api/v1/updates/check/?software=demo-app&version=1.0.0
```

**参数：**
- `software`: 软件标识符（如 `demo-app`）
- `version`: 当前版本号（如 `1.0.0`）

**成功响应（有更新）：**
```json
{
    "has_update": true,
    "version": "2.0.0",
    "update_log": "- 修复了XX问题\n- 新增YY功能",
    "download_url": "http://software.kunqiongai.com:8000/media/packages/demo-app/2.0.0/update.zip",
    "package_size": 15728640,
    "package_hash": "a1b2c3d4e5f6...",
    "is_mandatory": false,
    "release_date": "2024-01-31"
}
```

**成功响应（无更新）：**
```json
{
    "has_update": false
}
```

---

### 2.2 获取安装包（新用户下载用）

**请求：**
```http
GET http://software.kunqiongai.com:8000/api/v1/updates/installer/?software=demo-app
```

**参数：**
- `software`: 软件标识符

**响应：**
```json
{
    "has_installer": true,
    "version": "2.0.0",
    "download_url": "http://software.kunqiongai.com:8000/media/installers/demo-app/setup_v2.0.0.exe",
    "package_size": 52428800,
    "package_hash": "a1b2c3d4e5f6...",
    "platform": "windows"
}
```

---

### 2.3 获取软件列表

**请求：**
```http
GET http://software.kunqiongai.com:8000/api/v1/software/
```

**响应：**
```json
{
    "count": 2,
    "results": [
        {
            "identifier": "demo-app",
            "name": "Demo应用",
            "platform": "windows",
            "description": "示例应用程序"
        }
    ]
}
```

---

## 三、测试 API

### 浏览器测试

直接在浏览器地址栏输入：
```
http://software.kunqiongai.com:8000/api/v1/updates/check/?software=demo-app&version=1.0.0
```

### PowerShell 测试

```powershell
# 检查更新
Invoke-RestMethod -Uri "http://software.kunqiongai.com:8000/api/v1/updates/check/?software=demo-app&version=1.0.0" | ConvertTo-Json

# 获取安装包
Invoke-RestMethod -Uri "http://software.kunqiongai.com:8000/api/v1/updates/installer/?software=demo-app" | ConvertTo-Json
```

### curl 测试

```bash
# 检查更新
curl "http://software.kunqiongai.com:8000/api/v1/updates/check/?software=demo-app&version=1.0.0"

# 获取安装包
curl "http://software.kunqiongai.com:8000/api/v1/updates/installer/?software=demo-app"
```

---

## 四、客户端下载示例

### Python 客户端

```python
import requests

# 检查更新
response = requests.get(
    "http://software.kunqiongai.com:8000/api/v1/updates/check/",
    params={"software": "demo-app", "version": "1.0.0"}
)
data = response.json()

if data.get("has_update"):
    download_url = data["download_url"]
    print(f"发现新版本: {data['version']}")
    print(f"下载地址: {download_url}")
    
    # 下载文件
    r = requests.get(download_url, stream=True)
    with open("update.zip", "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
    print("下载完成!")
```

### JavaScript/浏览器

```javascript
// 检查更新
fetch('http://software.kunqiongai.com:8000/api/v1/updates/check/?software=demo-app&version=1.0.0')
    .then(response => response.json())
    .then(data => {
        if (data.has_update) {
            console.log('发现新版本:', data.version);
            console.log('下载地址:', data.download_url);
            
            // 自动跳转下载
            window.location.href = data.download_url;
        }
    });
```

---

## 五、常见问题

### Q1: 下载链接返回 404

**原因：**
- 文件使用本地存储，但服务器未启动
- 文件路径错误

**解决：**
```
确保服务器运行中: 启动服务器.bat
检查文件是否存在: 检查存储位置.bat
```

### Q2: 使用 COS 后下载链接格式

**本地存储：**
```
http://software.kunqiongai.com:8000/media/packages/demo-app/2.0.0/update.zip
```

**COS 存储：**
```
https://bucket-name.cos.ap-guangzhou.myqcloud.com/packages/demo-app/2.0.0/update.zip
```

### Q3: 如何获取软件标识符

```http
GET http://software.kunqiongai.com:8000/api/v1/software/
```

响应中的 `identifier` 字段就是软件标识符。

---

## 六、完整测试流程

```
1. 上传安装包/更新包
   ↓
2. 记录软件标识符（如：demo-app）
   ↓
3. 调用 API 获取下载链接
   GET /api/v1/updates/check/?software=demo-app&version=1.0.0
   ↓
4. 提取 download_url
   ↓
5. 客户端下载文件
```

---

**API 文档**: 启动服务器后访问 http://software.kunqiongai.com:8000/api/docs/
