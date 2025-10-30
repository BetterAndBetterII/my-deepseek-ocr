import base64
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="token-abc123",
)

img_file = "demo/imgs/image.png"

with open(img_file, "rb") as f:
    # Produce base64 string that OpenAI data URLs accept
    encoded_b64 = base64.b64encode(f.read()).decode("utf-8")

# 1) 发送多模态消息：text + image
#    注意 content 用 "多分片" 格式（OpenAI 新格式）
# 2) 通过 extra_body 传递 vLLM 特有参数与 logits_processor
resp = client.chat.completions.create(
    model="deepseek-ai/DeepSeek-OCR",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Free OCR, output markdown."},
                # Encode local image as base64 data URL for OpenAI-compatible endpoint
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{encoded_b64}"}}
            ],
        }
    ],
    extra_body={
        "vllm_xargs": {
            "ngram_size": 30,
            "window_size": 90,
        },
        "skip_special_tokens": False,
    },
)

print(resp.choices[0].message.content)
