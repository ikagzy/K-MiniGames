"""Merges a LoRA adapter into its base model (CPU only) and writes a normal model folder that Ollama can import.

  <venv>/Scripts/python.exe tools/train/merge_adapter.py --model <base> --adapter tools/train/out/k-ai-v1 --out tools/train/out/k-ai-v1-merged

Then (see tools/train/ollama/Modelfile.k-ai): ollama create k-ai -f <Modelfile> --quantize q4_K_M"""
import argparse


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="the base model (a Hugging Face id or a local folder)")
    parser.add_argument("--adapter", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args(argv)

    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(args.model)
    base = AutoModelForCausalLM.from_pretrained(args.model, torch_dtype=torch.float32)   # on the CPU (the card may be busy); float32 because a bfloat16 merge rounds the small adapter changes away
    merged = PeftModel.from_pretrained(base, args.adapter).merge_and_unload()
    merged.save_pretrained(args.out, safe_serialization=True)
    tokenizer.save_pretrained(args.out)
    print("merged model saved to", args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
