# 英文语言包「替换缺失」问题分析

## 现象

- 运行 `translate_locales.py` 只映射英文（`--langs en`）时，终端输出：`[skip] en already exists`
- 打开 `en.json` 后，**键和值仍是中文**（如 `"全部功能":"全部功能"`），没有变成英文
- 部分条目出现异常嵌套（如 `"": { "": { " 等更多文件": "..." } }`）

## 原因分析

### 1. 直接原因：脚本因「文件已存在」而跳过，未执行翻译

脚本逻辑（`translate_locales.py` 第 344-347 行）：

```python
output_path = output_dir / f"{lang}.json"
if output_path.exists() and not force:
    print(f"[skip] {lang} already exists ({output_path})")
    return
```

- 只要 **未加 `--force`**，且 `en.json` 已存在，就会直接 `return`，**不会调用翻译 API，也不会写新文件**
- 当前仓库里的 `en.json` 可能是早期从 `zh_CN.json` 复制来的，或某次失败/未完成留下的，所以内容仍是中文

### 2. 次要问题：现有 en.json 结构异常

- 存在空键或带点的键导致的异常嵌套（如 `"": { "": { ... } }`、`"仅支持 ": { "txt, ": { ... } }`）
- 可能与某次模型返回的 JSON 结构异常、或 flatten/unflatten 对特殊键的处理有关

## 解决方案

### 步骤一：加 `--force` 强制覆盖并重新翻译

在 **wenben** 目录下执行（注意加上 `--force`）：

```bash
cd wenben
python translate_locales.py --source src/renderer/i18n/locales/zh_CN.json --output-dir src/renderer/i18n/locales --langs en --model qwen-mt-turbo --api-key <你的API-KEY> --force
```

- `--force` 会覆盖已存在的 `en.json`，脚本才会真正去调用模型翻译
- 翻译后：**键** 保持与 zh_CN 一致（中文键），**值** 会变为英文

### 步骤二：若仍出现嵌套错乱

若执行后 `en.json` 里仍有类似 `"": { "": { ... } }` 的异常结构，可能是模型返回的 JSON 中键名含有 `.` 或空字符串，被 `unflatten_object` 误拆成多层。此时需要：

1. 检查模型返回的原始 JSON 是否键与源一致、无空键
2. 或在脚本里对 flatten/unflatten 做防护（例如跳过空键、或对键中的 `.` 做转义）

---

**结论**：当前「替换缺失」主要是因为 **没有加 `--force`，脚本跳过了 en，没有对 en.json 做任何翻译**。先按上面命令加上 `--force` 重新跑一遍即可。
