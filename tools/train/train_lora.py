"""LoRA fine-tuning of a small coder model to write game specs (GPU; run it only when the user agrees: it fills the card).

  <venv>/Scripts/python.exe tools/train/train_lora.py --model Qwen/Qwen2.5-Coder-1.5B-Instruct --out tools/train/out/pilot \
      --epochs 2 --limit 300

Checkpoints (--save-every, default 25 steps) let a stopped run go on with --resume.
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


def answer_loss(model, input_ids, attention_mask, labels, num_items=None):
    """The same loss as the model's own, but the vocabulary-wide logits are only made for the answer (the tail of the sequence,
    batch of one): the full table is more than 1 GB for a 1900-token example and made an 8 GB card page to RAM and crawl."""
    import torch
    n = int((labels[0] != -100).sum())
    out = model(input_ids=input_ids, attention_mask=attention_mask, logits_to_keep=n + 1)
    logits = out.logits[:, :-1].float()
    total = torch.nn.functional.cross_entropy(logits.reshape(-1, logits.size(-1)), labels[:, -n:].reshape(-1), ignore_index=-100, reduction="sum")
    return total / (num_items if num_items is not None else n), out


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
    parser.add_argument("--save-every", type=int, default=25, help="a checkpoint every this many steps (0: none)")
    parser.add_argument("--init-adapter", help="start from this trained adapter instead of a fresh one (a short extra round on corrected data)")
    parser.add_argument("--resume", action="store_true", help="continue from the newest checkpoint in --out")
    args = parser.parse_args(argv)

    import torch
    from peft import LoraConfig, get_peft_model
    from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments

    tokenizer = AutoTokenizer.from_pretrained(args.model)
    examples = load_examples(tokenizer, args.limit or None, args.max_len, args.seed)
    model = AutoModelForCausalLM.from_pretrained(args.model, torch_dtype=torch.bfloat16, attn_implementation="sdpa").to("cuda")
    model.gradient_checkpointing_enable()
    model.enable_input_require_grads()
    if args.init_adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, args.init_adapter, is_trainable=True)
    else:
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

    class AnswerTrainer(Trainer):
        def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
            loss, out = answer_loss(model, inputs["input_ids"], inputs["attention_mask"], inputs["labels"], num_items_in_batch)
            return (loss, out) if return_outputs else loss

    trainer = AnswerTrainer(
        model=model, train_dataset=examples, data_collator=collate,
        args=TrainingArguments(output_dir=args.out, per_device_train_batch_size=1, gradient_accumulation_steps=args.accum,
                               num_train_epochs=args.epochs, learning_rate=args.lr, lr_scheduler_type="cosine", warmup_steps=0.05,
                               bf16=True, logging_steps=5, save_strategy="steps" if args.save_every else "no", save_steps=max(1, args.save_every),
                               save_total_limit=2, report_to=[], remove_unused_columns=False,
                               seed=args.seed, optim="adamw_torch"))
    trainer.train(resume_from_checkpoint=True if args.resume else None)
    model.save_pretrained(args.out)
    tokenizer.save_pretrained(args.out)
    print("adapter saved to", args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
