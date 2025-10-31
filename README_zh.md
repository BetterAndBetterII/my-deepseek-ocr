# My OCR

一个开箱即用的 OCR 演示项目：
- 后端：FastAPI（OpenAI 兼容推理接口）+ 流式 NDJSON 返回
- 前端：React + Vite + Nginx（内置上传/预览/流式展示/用量面板）
- OCR 引擎：vLLM DeepSeek-OCR（容器化，OpenAI API 兼容）
- 运维：Prometheus 指标采集 + Grafana 预置仪表盘

本 README 介绍如何启动、使用与排障，并列出关键接口与监控指标。

---

## 快速开始（Docker Compose）

前置条件：
- 已安装 Docker 与 Docker Compose
- 机器具备 NVIDIA GPU（用于 vLLM）；若无 GPU，可将后端直连外部 LLM 服务，或只跑前后端而不跑引擎

1) 准备 vLLM 模板与模型缓存目录（宿主机）
- 确认存在：`~/vllm/template_deepseek_ocr.jinja`
- 模型缓存目录使用 `~/.cache/huggingface`（默认）

2) 启动所有服务
```
# 首次/更新后建议带 --build
docker compose up -d --build
```
- 前端： http://localhost:3000
- 后端（FastAPI 文档）： http://localhost:9000/api/docs
- Prometheus： http://localhost:9090
- Grafana： http://localhost:3001（默认用户名/密码见 compose 环境变量）

3) 仅启动/重启某些服务（可选）
```
# 仅启动引擎
docker compose up -d --build engine

# 重新加载 Prometheus 配置
docker compose restart prometheus
# 或（已启用 lifecycle）
curl -X POST http://localhost:9090/-/reload
```

---

## 服务说明（Compose）

- api（后端）
  - 监听容器端口 `8000`，宿主机暴露为 `9000`（`9000:8000`）
  - 暴露指标：`/metrics` 与 `/api/metrics`
  - 默认直连引擎：`LLM_BASE_URL=http://engine:8000/v1`
  - DB 使用 SQLite，持久化目录挂载至卷 `db-data:/app/_data`

- web（前端）
  - Nginx 静态服务，运行时通过 `BACKEND_URL=http://api:8000` 反向代理到后端 `/api/*`
  - 生产构建产物由 Vite 生成

- engine（vLLM）
  - 镜像：`vllm/vllm-openai:nightly`
  - 端口：`8000:8000`
  - GPU：`gpus: "all"` + `NVIDIA_VISIBLE_DEVICES=0,1`（仅用 0、1 两张卡）
  - 卷：
    - `~/.cache/huggingface:/root/.cache/huggingface`
    - `~/vllm:/root/vllm`（含 `template_deepseek_ocr.jinja`）
  - 启动参数（节选）：
    - `--model deepseek-ai/DeepSeek-OCR`
    - `--tensor-parallel-size 2`
    - `--logits-processors vllm.model_executor.models.deepseek_ocr:NGramPerReqLogitsProcessor`
    - `--chat-template /root/vllm/template_deepseek_ocr.jinja`
  - Prometheus 指标：通常在 `http://engine:8000/metrics`（不同镜像可能差异）

- prometheus（指标抓取）
  - 抓取任务：
    - `my-ocr-api` → `api:8000/metrics`
    - `vllm-engine` → `engine:8000/metrics`
  - 配置文件：`monitoring/prometheus.yml`

- grafana（可视化）
  - 已预置数据源（Prometheus）与仪表盘 Provider
  - 默认首页：`Compose Jobs Overview`
  - 预置仪表盘在 `monitoring/grafana/provisioning/dashboards`（随启动自动加载）

---

## 本地 Docker 部署（vLLM 快速运行）

在无需 Compose 的情况下，本地快速启动 vLLM（使用 GPU 0、1；开启共享内存；挂载缓存与模板目录）：

```
docker run --rm --gpus '"device=0,1"' \
  --ipc=host --shm-size=16g \
  -p 8000:8000 \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  -v ~/vllm:/root/vllm \
  vllm/vllm-openai:nightly \
  --model deepseek-ai/DeepSeek-OCR \
  --tensor-parallel-size 2 \
  --distributed-executor-backend mp \
  --logits-processors "vllm.model_executor.models.deepseek_ocr:NGramPerReqLogitsProcessor" \
  --chat-template "/root/vllm/template_deepseek_ocr.jinja"
```

说明：
- 需要将模板文件拷贝到本地（放到 `~/vllm/template_deepseek_ocr.jinja`）：
  - 模板源码路径：vllm/vllm/transformers_utils/chat_templates/template_deepseek_ocr.jinja（main 分支）
    https://github.com/vllm-project/vllm/blob/main/vllm/transformers_utils/chat_templates/template_deepseek_ocr.jinja
- 参考：vLLM 社区讨论 “Usage: How to request DeepSeek-OCR with http request”（Issue #27463）
  https://github.com/vllm-project/vllm/issues/27463

---

## 环境变量（后端）
配置文件：`app/core/config.py`（读取 `app/.env`）

- 安全
  - `SECRET_KEY`（必改）、`ALGORITHM`、`ACCESS_TOKEN_EXPIRE_MINUTES`
- 数据库
  - `DATABASE_URL`（Compose 中默认挂载到 `/app/_data` 目录）
- OCR/LLM（OpenAI 兼容）
  - `LLM_BASE_URL`（默认 `http://engine:8000/v1`）
  - `LLM_API_KEY`（默认占位，不做鉴权，仅兼容 SDK）
  - `LLM_MODEL`（默认 `deepseek-ai/DeepSeek-OCR`）
  - `LLM_PROMPT`（默认兜底提示词）
- 认证
  - `AUTH_ENABLED`（默认 false）
  - `BOOTSTRAP_USER`/`BOOTSTRAP_PASS`（演示账号）

---

## API 使用

- 上传并流式返回（NDJSON）：
  - `POST /api/ocr/image`（`multipart/form-data`，字段：`file`，可选 `prompt`）
  - `POST /api/ocr/pdf`（同上）
- 认证（如开启）：
  - `POST /api/auth/register`、`POST /api/auth/token`

示例（image）：
```
curl -N -F "file=@/path/to/img.png" \
     -F "prompt=请将图片内容转为 Markdown。" \
     http://localhost:9000/api/ocr/image
```

### NDJSON 帧格式

- image
  - `{"type":"start","kind":"image"}`
  - 多条 `{"type":"delta","delta":"..."}`
  - `{"type":"end","usage":{prompt_tokens,completion_tokens,prompt_chars,completion_chars,input_bytes}}`

- pdf（页级并行）
  - `{"type":"start","kind":"pdf","pages":N}`
  - 对每页：
    - `{"type":"page_start","page":i}`
    - 多条 `{"type":"page_delta","page":i,"delta":"..."}`
    - `{"type":"page_end","page":i,"usage":{prompt_tokens,completion_tokens,completion_chars}}`
  - 最终 `end` 同 image，并附加 `pages`

---

## 监控与仪表盘

- Prometheus 指标（后端，摘录，详见 `app/metrics.py`）
  - HTTP：`http_requests_total{method,path,status}`、`http_request_duration_seconds_bucket{method,path}`、`http_in_flight_requests`
  - OCR：`ocr_requests_total{kind}`、`ocr_processing_seconds_bucket{kind}`、`ocr_in_progress{kind}`、`ocr_input_bytes_total{kind}`、`image_requests_total`、`pdf_requests_total`
  - 业务：`users_total`、`prompt_tokens_total`、`completion_tokens_total`、`tokens_total`
- vLLM 指标
  - 取决于镜像/版本，通常 `/metrics` 可见；若不可见，请查阅所用镜像的启用方式

- 预置 Grafana 仪表盘（可在“Compose”文件夹找到）：
  - Compose Jobs Overview：目标健康、抓取耗时、样本量等
  - API HTTP Overview：RPS/错误率/延迟/In‑flight
  - OCR Overview：OCR RPS、处理时延、输入字节速率、进行中、Token 速率、用户总数
  - vLLM Overview：HTTP 路由统计、错误率、延迟分位、进行中请求、Token 相关、队列与在飞、进程资源

将 Grafana 默认首页切换为某仪表盘：
- 在 `docker-compose.yml` 的 grafana 服务中设置
```
GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH=/etc/grafana/provisioning/dashboards/ocr-overview.json
```

---

## 开发模式

- 后端（本地）：
```
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- 前端（本地）：
```
cd frontend
pnpm install
pnpm dev
# 开发环境下，前端默认请求 /api（建议用 Nginx 或开发代理转发到后端）
```

---

## 常见问题（FAQ）

- Prometheus 报错 connect refused：
  - Compose 内部应抓容器端口。已配置为 `api:8000/metrics`，请确保 Prometheus 已 reload/重启
- Grafana 看不到 vLLM 目标：
  - 先在 Prometheus Targets 页面检查是否存在 `vllm-engine`；没有则 Prometheus 未加载配置或引擎未启动
  - 若 `/metrics` 404/无数据，检查 vLLM 镜像是否启用了指标端点
- GPU 配置校验失败：
  - 某些 Compose 版本不支持 `gpus: device=0,1`。本项目使用 `gpus: "all"` + `NVIDIA_VISIBLE_DEVICES=0,1`
  - 或按需改为 `device_requests` 方式
- 引擎启动失败：
  - 确认模板文件存在：`~/vllm/template_deepseek_ocr.jinja`
  - 确认模型能从 `~/.cache/huggingface` 读取/下载
- PDF 解析失败：
  - 后端已包含 `pypdfium2`，但若容器运行时缺依赖或 PDF 异常，可能报错；日志可在 `api` 容器查看

---

## 目录导览（关键文件）
- `docker-compose.yml`：服务编排
- `Dockerfile`：后端镜像构建（Uvicorn, 8000 端口）
- `frontend/`：前端源码与运行时（Nginx 反代 `/api`）
- `monitoring/prometheus.yml`：Prometheus 抓取配置
- `monitoring/grafana/provisioning/`：数据源与仪表盘自动加载
- `app/routers/ocr.py`：OCR 接口（NDJSON 流）
- `app/metrics.py`：Prometheus 指标定义

欢迎根据实际部署环境调整端口、鉴权与持久化策略。
