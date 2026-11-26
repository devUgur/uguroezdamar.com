"""Open LLMs for the agent API on Modal (ADR 0024).

Each model is a vLLM server with an OpenAI-compatible API and tool calling, protected by an API
key from the Modal secret `uguroezdamar-llm` (key LLM_API_KEY; the same value is the GitHub secret
MODAL_LLM_API_KEY that the API Worker sends). GPUs scale to zero after SCALEDOWN of idle time.

Deploy (workspace ugur44ist):  MODAL_PROFILE=ugur44ist modal deploy apps/api/modal/llm.py
URLs:  https://ugur44ist--uguroezdamar-llm-<function>.us-east.modal.run/v1  (function = ministral | gemma)
"""

import os
import subprocess

import modal

MINUTES = 60
PORT = 8000
# Billing stops this long after the last request; the next request pays a cold start.
SCALEDOWN = 5 * MINUTES
# Skip Torch compilation and CUDA graphs: slower tokens, much faster cold starts. Right for an
# assistant that is idle most of the day.
FAST_BOOT = True

vllm_image = (
    modal.Image.from_registry("nvidia/cuda:12.9.0-devel-ubuntu22.04", add_python="3.12")
    .entrypoint([])
    # mistral-common 1.13 changed GrammarFactory.get_lark_from_jinja (new required force_tool_names), which
    # vLLM 0.21 does not pass: every Ministral tool call failed with 400. Pinned to vLLM's minimum.
    .uv_pip_install("vllm==0.21.0", "transformers==5.8.1", "mistral-common[image]==1.11.2")
    .env({"HF_XET_HIGH_PERFORMANCE": "1"})
)

hf_cache = modal.Volume.from_name("huggingface-cache", create_if_missing=True)
vllm_cache = modal.Volume.from_name("vllm-cache", create_if_missing=True)
secret = modal.Secret.from_name("uguroezdamar-llm")

app = modal.App("uguroezdamar-llm")

COMMON = dict(
    image=vllm_image,
    scaledown_window=SCALEDOWN,
    timeout=30 * MINUTES,
    volumes={"/root/.cache/huggingface": hf_cache, "/root/.cache/vllm": vllm_cache},
    secrets=[secret],
)


def serve(model: str, revision: str | None, extra: list[str]) -> None:
    cmd = [
        "vllm", "serve", model,
        *(["--revision", revision] if revision else []),
        "--served-model-name", model, "llm",
        "--host", "0.0.0.0", "--port", str(PORT),
        "--api-key", os.environ["LLM_API_KEY"],
        "--enable-auto-tool-choice",
        "--enforce-eager" if FAST_BOOT else "--no-enforce-eager",
        "--tensor-parallel-size", "1",
        *extra,
    ]
    subprocess.Popen(cmd)


# Small, fast and inexpensive: everyday answers and simple tool use. FP8 weights on an L40S.
@app.function(gpu="L40S", **COMMON)
@modal.concurrent(max_inputs=16)
@modal.web_server(port=PORT, startup_timeout=15 * MINUTES)
def ministral() -> None:
    serve(
        "mistralai/Ministral-3-8B-Instruct-2512",
        None,
        [
            "--tokenizer_mode", "mistral",
            "--config_format", "mistral",
            "--load_format", "mistral",
            "--tool-call-parser", "mistral",
            "--max-model-len", "32768",
            "--gpu-memory-utilization", "0.92",
        ],
    )


# Stronger mixture-of-experts model (4B of 26B active) for multi-step repository work; Modal's own
# reference model with tuned tool calling. BF16 on an H100.
@app.function(gpu="H100", **COMMON)
@modal.concurrent(max_inputs=16)
@modal.web_server(port=PORT, startup_timeout=15 * MINUTES)
def gemma() -> None:
    serve(
        "google/gemma-4-26B-A4B-it",
        "47b6801b24d15ff9bcd8c96dfaea0be9ed3a0301",
        [
            "--tool-call-parser", "gemma4",
            "--reasoning-parser", "gemma4",
            "--limit-mm-per-prompt", '{"image":0,"video":0,"audio":0}',
            "--max-model-len", "32768",
            "--gpu-memory-utilization", "0.92",
        ],
    )
