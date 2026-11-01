"""The shared maker of training and evaluation data for a kit, the same way specdata_fps.py does it for the first person shooter (CPU only):
the spec is built first, the description is written from it, so the label is right by construction. The answers carry only what the
description asks for (the kit fills the rest) and never a seed. Messages are exactly what the app sends (Generator.create_spec / edit_spec).

A kit's file (specdata_race.py, specdata_football.py) gives a Config and takes the functions it needs from `make(config)`."""
import json
import random
from dataclasses import dataclass, field
from typing import Callable

import specdata
from specdata import ASCII_FOLD_KEEP_CASE, MOODS, MOODS_TR, PREFIXES, SUFFIXES, TEMPOS_TR


@dataclass
class Config:
    kit: str
    fields: tuple                       # the order fields are named in a description
    probs: dict                         # how often a field is asked for
    sample: Callable                    # (rng, field, spec_so_far) -> value
    phrase: Callable                    # (rng, field, spec) -> words (None: use `words`)
    words: dict                         # field -> value -> [phrases] for the plain fields
    heads: list
    vague: list
    edit: Callable                      # (rng, spec) -> (request, new_spec, field) or None
    defaults: dict
    hand: list
    list_fields: tuple = ()             # fields whose value is a list compared without order
    seed_base: int = 3000
    edit_share: float = 0.15


def make(cfg: Config):
    def _spec(rng, fields):
        spec = {"kit": cfg.kit}
        for f in cfg.fields:
            if f not in fields:
                continue
            if f == "musicStyle":
                style = {"mood": rng.choice(MOODS)}
                if rng.random() < 0.4:
                    style["tempo"] = rng.choice(("slow", "fast"))
                spec["musicStyle"] = style
            else:
                spec[f] = cfg.sample(rng, f, spec)
        return spec

    def _fields(rng):
        if rng.random() < 0.05:
            return set()
        return {f for f, p in cfg.probs.items() if rng.random() < p} or {cfg.fields[1]}

    def _phrase(rng, f, spec):
        if f == "musicStyle":
            style = spec["musicStyle"]
            return rng.choice(MOODS_TR[style["mood"]]) + (", " + rng.choice(TEMPOS_TR[style["tempo"]]) if "tempo" in style else "")
        text = cfg.phrase(rng, f, spec)
        if text is not None:
            return text
        value = spec[f]
        if f in cfg.list_fields:
            return ", ".join(rng.choice(cfg.words[f][v]) for v in value)
        return rng.choice(cfg.words[f][value])

    def _mentioned(spec):
        return [f for f in cfg.fields if f in spec]

    def _describe(rng, fields, spec):
        if not fields:
            return rng.choice(cfg.vague)
        clauses = [_phrase(rng, f, spec) for f in fields]
        rng.shuffle(clauses)
        style = rng.random()
        if style < 0.4:
            text = f"{rng.choice(cfg.heads)} {', '.join(clauses)}."
        elif style < 0.7:
            body = clauses[0] if len(clauses) == 1 else f"{', '.join(clauses[:-1])} ve {clauses[-1]}"
            text = f"{rng.choice(PREFIXES)} {body}{rng.choice(SUFFIXES)}"
            text = text if text.endswith(("?", "!")) else text + "."
        elif style < 0.85:
            text = ", ".join(clauses) + rng.choice(["", " olsun", " istiyorum"]) + "."
        else:
            text = "\n".join(f"- {c}" for c in clauses)
        if rng.random() < 0.1:
            text = text[0].lower() + text[1:]
        if rng.random() < 0.12:
            text = text.translate(ASCII_FOLD_KEEP_CASE)
        return text

    class _Capture:
        messages = None

        def chat(self, model, messages, **kwargs):
            self.messages = messages
            return json.dumps({"kit": cfg.kit})

    def messages(kind, text, spec, before):
        cap = _Capture()
        gen = specdata.Generator(cap, "m")
        if kind == "create":
            gen.create_spec(text, cfg.kit)
        else:
            gen.edit_spec(before, text, cfg.kit)
        return cap.messages + [{"role": "assistant", "content": json.dumps(spec, ensure_ascii=False)}]

    def build(n_train=600, n_eval=100, seed=0):
        rng = random.Random(seed + cfg.seed_base)
        train, held = [], []

        def one(index):
            if rng.random() < cfg.edit_share:
                base = _spec(rng, _fields(rng))
                made = cfg.edit(rng, base)
                if made is None or made[1] == base:
                    return one(index)
                request, new, f = made
                return {"id": index, "kit": cfg.kit, "kind": "edit", "lang": "tr", "request": request, "description": request, "before": base, "spec": new,
                        "mentioned": [f], "messages": messages("edit", request, new, base)}
            spec = _spec(rng, _fields(rng))
            fields = _mentioned(spec)
            description = _describe(rng, fields, spec)
            return {"id": index, "kit": cfg.kit, "kind": "create", "lang": "tr", "description": description, "spec": spec, "mentioned": fields,
                    "messages": messages("create", description, spec, None)}

        for i in range(n_train):
            train.append(one(i))
        for i in range(n_eval):
            held.append(one(200000 + i))
        seen = {e["description"] for e in train}
        held = [e for e in held if e["description"] not in seen]
        return train, held

    def _value(f, spec):
        if f in cfg.list_fields:
            return sorted(spec.get(f) or cfg.defaults.get(f) or [])
        if f == "musicStyle":
            style = spec.get("musicStyle") or {}
            return (style.get("mood"), style.get("tempo", "medium"))
        if f == "title":
            return spec.get("title")
        return spec.get(f, cfg.defaults.get(f))

    def score(pred, target, mentioned):
        if not isinstance(pred, dict) or pred.get("kit") != cfg.kit:
            return {"valid": False, "accuracy": 0.0, "fields": {}}
        fields = {}
        for f in mentioned:
            try:
                fields[f] = _value(f, pred) == _value(f, target)
            except (KeyError, TypeError, ValueError, AttributeError):
                fields[f] = False
        return {"valid": True, "accuracy": sum(fields.values()) / len(fields) if fields else 1.0, "fields": fields}

    def expect_ok(pred, expect):
        if not isinstance(pred, dict) or pred.get("kit") != cfg.kit:
            return {k: False for k in expect}
        out = {}
        for key, want in expect.items():
            try:
                if key == "music":
                    out[key] = (pred.get("musicStyle") or {}).get("mood") == want
                elif key in cfg.list_fields:
                    out[key] = sorted(_value(key, pred)) == sorted(want)
                else:
                    out[key] = _value(key, pred) == want
            except (KeyError, TypeError, ValueError, AttributeError):
                out[key] = False
        return out

    return messages, build, score, expect_ok
