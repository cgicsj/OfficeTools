#!/usr/bin/env python3
"""OfficeTools audio-file transcription helper.

The TypeScript main process invokes this helper with one audio path and reads a
single JSON object from stdout. In development, set OFFICE_TOOLS_SPEECH_FAKE=1
for deterministic no-model output.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any


def _success(payload: dict[str, Any]) -> None:
    print(json.dumps({"success": True, **payload}, ensure_ascii=False), flush=True)


def _failure(error: str, code: str = "TRANSCRIPTION_FAILED") -> None:
    print(json.dumps({"success": False, "error": error, "code": code}, ensure_ascii=False), flush=True)


def _duration_seconds(audio_path: str) -> float:
    fake_duration = os.environ.get("OFFICE_TOOLS_SPEECH_FAKE_DURATION_SECONDS")
    if fake_duration:
        try:
            return float(fake_duration)
        except ValueError:
            return 0.0

    try:
        import librosa

        return float(librosa.get_duration(path=audio_path))
    except Exception:
        return 0.0


def _extract_text(asr_result: Any) -> str:
    if isinstance(asr_result, list) and asr_result:
        first_item = asr_result[0]
        if isinstance(first_item, dict) and "text" in first_item:
            return str(first_item["text"])
        if isinstance(first_item, dict) and "preds" in first_item:
            preds = first_item["preds"]
            if isinstance(preds, tuple) and preds:
                return str(preds[0])
            return str(preds)
        return str(first_item)

    return str(asr_result)


def _model_dir_from_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"缺少环境变量 {name}，请指向已下载的 FunASR ONNX 模型目录")

    model_dir = Path(value).expanduser()
    if not model_dir.exists():
        raise RuntimeError(f"{name} 指向的模型目录不存在: {model_dir}")

    if not (model_dir / "model.onnx").exists() and not (model_dir / "model_quant.onnx").exists():
        raise RuntimeError(f"{name} 模型目录缺少 model.onnx 或 model_quant.onnx: {model_dir}")

    return str(model_dir)


def _transcribe_with_funasr(audio_path: str) -> dict[str, Any]:
    try:
        from funasr_onnx.paraformer_bin import Paraformer
    except Exception as exc:
        raise RuntimeError(
            "缺少 funasr_onnx 依赖，请安装 Python ASR 运行环境或等待 Debian arm64 单安装包交付"
        ) from exc

    asr_model_dir = _model_dir_from_env("OFFICE_TOOLS_FUNASR_ASR_MODEL_DIR")
    use_quantize = (Path(asr_model_dir) / "model_quant.onnx").exists()
    num_threads = int(os.environ.get("OMP_NUM_THREADS", "4"))
    start = time.time()
    model = Paraformer(
        asr_model_dir,
        batch_size=1,
        device_id=-1,
        quantize=use_quantize,
        intra_op_num_threads=num_threads,
    )
    raw_text = _extract_text(model([audio_path]))
    text = raw_text

    punc_model_dir = os.environ.get("OFFICE_TOOLS_FUNASR_PUNC_MODEL_DIR")
    if punc_model_dir and raw_text.strip():
        try:
            from funasr_onnx.punc_bin import CT_Transformer

            punc_dir = _model_dir_from_env("OFFICE_TOOLS_FUNASR_PUNC_MODEL_DIR")
            punc_quantize = (Path(punc_dir) / "model_quant.onnx").exists()
            punc_model = CT_Transformer(
                punc_dir,
                batch_size=1,
                quantize=punc_quantize,
                intra_op_num_threads=num_threads,
            )
            punc_result = punc_model(raw_text)
            if isinstance(punc_result, tuple) and punc_result:
                text = str(punc_result[0])
            else:
                text = str(punc_result)
        except Exception:
            text = raw_text

    return {
        "text": text,
        "raw_text": raw_text,
        "duration": _duration_seconds(audio_path),
        "inference_latency": time.time() - start,
        "confidence": 0.0,
        "model_type": "funasr_onnx",
    }


def main() -> int:
    probe_duration = len(sys.argv) == 3 and sys.argv[1] == "--probe-duration"
    if len(sys.argv) != 2 and not probe_duration:
        _failure("Usage: transcribe_file.py [--probe-duration] <audio-path>", "INVALID_ARGUMENTS")
        return 2

    audio_path = sys.argv[2] if probe_duration else sys.argv[1]
    if not Path(audio_path).exists():
        _failure(f"音频文件不存在: {audio_path}", "FILE_NOT_FOUND")
        return 1

    if probe_duration:
        _success({"duration": _duration_seconds(audio_path)})
        return 0

    if os.environ.get("OFFICE_TOOLS_SPEECH_FAKE") == "1":
        name = Path(audio_path).name
        _success(
            {
                "text": f"这是 {name} 的测试转写结果。",
                "raw_text": f"这是 {name} 的测试转写结果。",
                "duration": _duration_seconds(audio_path),
                "inference_latency": 0.0,
                "confidence": 1.0,
                "model_type": "fake",
            }
        )
        return 0

    try:
        _success(_transcribe_with_funasr(audio_path))
        return 0
    except Exception as exc:
        _failure(str(exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
