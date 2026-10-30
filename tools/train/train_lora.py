"""LoRA fine-tuning of a small coder model to write game specs (GPU; run it only when the user agrees: it fills the card).

  <venv>/Scripts/python.exe tools/train/train_lora.py --model Qwen/Qwen2.5-Coder-1.5B-Instruct --out tools/train/out/pilot \
      --epochs 2 --limit 300

The loss is on the answer only (the long system prompt and the user text are masked), so the model learns to write the
spec, not to repeat the guide. Needs the training venv (torch, transformers, peft, accelerate). Writes the LoRA adapter."""
import argparse
import json
import random
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"


def load_examples(tokenizer, limit: int | None, max_len: int, seed: int):
    rows = [json.loads(line)["messages"] for line in (DATA / "train.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    random.Random(seed).shuffle(rows)
    if limit:
        rows = rows[:limit]
    examples, skipped = [], 0
    for messages in rows:
        prompt = tokenizer.apply_chat_template(messages[:-1], tokenize=False, add_generation_prompt=True)
        answer = messages[-1]["content"] + tokenizer.eos_token
        prompt_ids = tokenizer(prompt, add_special_tokens=False)["input_ids"]
        answer_ids = tokenizer(answer, add_special_tokens=False)["input_ids"]
        if len(prompt_ids) + len(answer_ids) > max_len:
            skipped += 1
            continue
        examples.append({"input_ids": prompt_ids + answer_ids, "labels": [-100] * len(prompt_ids) + answer_ids})
    print(f"{len(examples)} examples ({skipped} skipped as too long)")
    return examples


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="a Hugging Face id or a local folder")
    parser.add_argument("--out", required=True)
    parser.add_argument("--epochs", type=float, default=2)
    parser.add_argument("--limit", type=int, default=0, help="use only this many examples (a quick pilot)")
    parser.add_argument("--max-len", type=int, default=4096)
    parser.add_argument("--rank", type=int, default=16)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--accum", type=int, default=8)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args(argv)

    import torch
    from peft import LoraConfig, get_peft_model
    from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments

    tokenizer = AutoTokenizer.from_pretrained(args.model)
    examples = load_examples(tokenizer, args.limit or None, args.max_len, args.seed)
    model = AutoModelForCausalLM.from_pretrained(args.model, torch_dtype=torch.bfloat16, attn_implementation="sdpa").to("cuda")
    model.gradient_checkpointing_enable()
    model.enable_input_require_grads()
    model = get_peft_model(model, LoraConfig(r=args.rank, lora_alpha=2 * args.rank, lora_dropout=0.05, task_type="CAUSAL_LM",
                                              target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]))
    model.print_trainable_parameters()

    def collate(batch):
        longest = max(len(b["input_ids"]) for b in batch)
        pad = tokenizer.pad_token_id if tokenizer.pad_token_id is not None else tokenizer.eos_token_id
        ids = torch.tensor([b["input_ids"] + [pad] * (longest - len(b["input_ids"])) for b in batch])
        labels = torch.tensor([b["labels"] + [-100] * (longest - len(b["labels"])) for b in batch])
        mask = torch.tensor([[1] * len(b["input_ids"]) + [0] * (longest - len(b["input_ids"])) for b in batch])
        return {"input_ids": ids, "labels": labels, "attention_mask": mask}

    trainer = Trainer(
        model=model, train_dataset=examples, data_collator=collate,
        args=TrainingArguments(output_dir=args.out, per_device_train_batch_size=1, gradient_accumulation_steps=args.accum,
                               num_train_epochs=args.epochs, learning_rate=args.lr, lr_scheduler_type="cosine", warmup_ratio=0.05,
                               bf16=True, logging_steps=5, save_strategy="no", report_to=[], remove_unused_columns=False,
                               seed=args.seed, optim="adamw_torch"))
    trainer.train()
    model.save_pretrained(args.out)
    tokenizer.save_pretrained(args.out)
    print("adapter saved to", args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
