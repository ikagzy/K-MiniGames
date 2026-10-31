"""Puts a trained adapter into Ollama as a model (merge into the base, GGUF, ollama create). CPU only; nothing here uses the card.

  python tools/train/install_kai.py --adapter k-ai-v2 --name k-ai-v2

What it needs: the training venv (it has torch, transformers, peft, gguf), llama.cpp's convert_hf_to_gguf.py (tag b6000, downloaded once into
<train env>/llamacpp, see docs/DEVIR-NOTU.md) and a running Ollama. The Modelfile's FROM path is relative to the Modelfile, so a
temporary Modelfile is written next to the GGUF."""
import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TRAIN_ENV = Path(os.environ.get("LOCALAPPDATA", "")) / "K-MiniGames-train"
BASE = next((Path.home() / ".cache/huggingface/hub/models--Qwen--Qwen2.5-Coder-1.5B-Instruct/snapshots").glob("*"), None)
_FILE = (ROOT / "tools/train/ollama/Modelfile.k-ai").read_text(encoding="utf-8")
TEMPLATE = _FILE[_FILE.index("TEMPLATE"):]   # everything from TEMPLATE on; the FROM line is written for each model


def run(cmd, env=None):
    print(">", " ".join(str(c) for c in cmd))
    subprocess.run([str(c) for c in cmd], check=True, env={**os.environ, **(env or {})})


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--adapter", required=True, help="a folder name under tools/train/out, for example k-ai-v2")
    parser.add_argument("--name", required=True, help="the Ollama model name, for example k-ai or k-ai-v2")
    args = parser.parse_args(argv)
    python = TRAIN_ENV / "venv/Scripts/python.exe"
    convert = TRAIN_ENV / "llamacpp/convert_hf_to_gguf.py"
    out = ROOT / "tools/train/out"
    adapter, merged, gguf = out / args.adapter, out / f"{args.adapter}-merged", out / f"{args.adapter}-q8.gguf"
    if not adapter.is_dir() or not python.exists() or not convert.exists() or BASE is None:
        print("missing:", [str(p) for p in (adapter, python, convert) if not p.exists()] + ([] if BASE else ["the base model in the Hugging Face cache"]))
        return 1
    if "K-MiniGames patch" not in convert.read_text(encoding="utf-8"):   # without it the GGUF gets rope base 10000 instead of 1000000 and the model is badly wrong
        print("convert_hf_to_gguf.py lacks the rope_theta patch (see docs/DEVIR-NOTU.md, k-ai Ollama kurulumu); not converting.")
        return 1
    cpu = {"CUDA_VISIBLE_DEVICES": "", "HF_HUB_OFFLINE": "1", "PYTHONIOENCODING": "utf-8", "NO_LOCAL_GGUF": "1"}
    run([python, ROOT / "tools/train/merge_adapter.py", "--model", BASE, "--adapter", adapter, "--out", merged], cpu)
    run([python, "-I", convert, merged, "--outfile", gguf, "--outtype", "q8_0"], cpu)
    modelfile = out / f"Modelfile.{args.adapter}"
    modelfile.write_text(f"FROM ./{gguf.name}\n{TEMPLATE}", encoding="utf-8")
    run(["ollama", "create", args.name, "-f", modelfile])
    print(f"done: ollama model '{args.name}'. The app uses it when settings game_model is '{args.name}'.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
