"""Asks an LLM on OpenRouter to name the insect in each photo, for the Pyinsect Benchmark page.

FOR A GROWN-UP (18 or older) with their own OpenRouter account. Read the rules of the model you pick,
and set a spending limit on your key. Photos are sent to OpenRouter and the model's company, so use only
photos with no people or private details. Never put your key in a file in this project.

    python3 benchmark/openrouter_test.py ~/Downloads/eab-test-photos --limit 1     (try one photo first)
    python3 benchmark/openrouter_test.py ~/Downloads/eab-test-photos

It asks for the key (typing stays hidden), or reads the OPENROUTER_API_KEY environment variable.
The answers are saved in openrouter-results.json inside the photo folder. Running it again skips photos
that already have an answer, so you don't pay twice. Needs only Python 3, nothing to install.
"""
import argparse
import base64
import getpass
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

URL = "https://openrouter.ai/api/v1/responses"
ASSETS = Path(__file__).resolve().parent.parent / "assets"
TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


def insect_names():
    """The same list of insects Pyinsect chooses from, with their common names."""
    model = (ASSETS / "models" / "pyinsect-2.8-oregon.js").read_text(encoding="utf-8")
    block = model[model.index("classes:"):]
    block = re.sub(r"//.*", "", block[:block.index("]")])
    classes = [c for c in re.findall(r'"([^"]+)"', block) if c != "other_insect"]
    species = (ASSETS / "species.js").read_text(encoding="utf-8")
    common = dict(re.findall(r'^\s*"([a-z0-9_]+)":\s*"([^"]*)"', species, re.M))
    return {c: common.get(c, c.replace("_", " ")) for c in classes}


def parse_answer(text, names):
    """Reads {"top3": [{"id": ..., "confidence": ...}]} out of the reply. Unknown ids don't count."""
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("the model didn't answer in the asked format")
    top3 = []
    for guess in json.loads(match.group(0)).get("top3", [])[:3]:
        name = str(guess.get("id", "")).strip()
        top3.append({"species": name if name in names else None, "said": name,
                     "confidence": float(guess.get("confidence") or 0)})
    if not top3:
        raise ValueError("the model gave no guesses")
    return top3


def ask(path, model, key, names):
    listing = "\n".join(f"{i} = {n}" for i, n in names.items())
    prompt = ("Name the insect (or the insect damage) in this photo. Choose only from this list of ids:\n"
              f"{listing}\n\nReply with only JSON, best guess first: "
              '{"top3": [{"id": "<id from the list>", "confidence": <0 to 100>}]}')
    data = base64.b64encode(path.read_bytes()).decode()
    body = {"model": model, "input": [{"role": "user", "content": [
        {"type": "input_text", "text": prompt},
        {"type": "input_image", "image_url": f"data:{TYPES[path.suffix.lower()]};base64,{data}", "detail": "auto"},
    ]}]}
    request = urllib.request.Request(URL, data=json.dumps(body).encode(),
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    start = time.monotonic()
    with urllib.request.urlopen(request, timeout=180) as response:
        reply = json.load(response)
    seconds = time.monotonic() - start
    text = "".join(part.get("text", "") for item in reply.get("output", []) if item.get("type") == "message"
                   for part in item.get("content", []) if part.get("type") == "output_text")
    cost = (reply.get("usage") or {}).get("cost")
    result = {"seconds": round(seconds, 2), "cost": cost}
    try:
        result["top3"] = parse_answer(text, names)
    except (ValueError, TypeError, AttributeError) as error:
        result["top3"] = []   # a reply we can't read counts as wrong, and was still paid for
        result["problem"] = str(error)
    return result


def explain(error):
    if isinstance(error, urllib.error.HTTPError):
        detail = error.read().decode(errors="replace")[:200]
        return f"OpenRouter said {error.code}: {detail}"
    return str(error)


def main():
    parser = argparse.ArgumentParser(description="Test an OpenRouter model on a folder of insect photos.")
    parser.add_argument("folder", help="folder of photos")
    parser.add_argument("--model", default="mistralai/pixtral-large-2502", help="OpenRouter model that reads images")
    parser.add_argument("--limit", type=int, help="only ask about this many new photos")
    parser.add_argument("--max-dollars", type=float, default=1.0, help="stop after spending about this much")
    parser.add_argument("--at-once", type=int, default=6, help="photos to ask about at the same time")
    args = parser.parse_args()

    folder = Path(args.folder).expanduser()
    if not folder.is_dir():
        sys.exit(f"No folder at {folder}")
    names = insect_names()
    output = folder / "openrouter-results.json"
    saved = json.loads(output.read_text(encoding="utf-8")) if output.exists() else None
    if saved and saved["model"] != args.model:
        sys.exit(f"{output} holds answers from {saved['model']}. Move it somewhere else to test another model.")
    saved = saved or {"model": args.model, "photos": {}}
    photos = sorted(p for p in folder.rglob("*") if p.suffix.lower() in TYPES)
    todo = [p for p in photos if p.name not in saved["photos"]][:args.limit]
    if len({p.name for p in photos}) != len(photos):
        sys.exit("Two photos have the same file name. Rename one, so each answer matches its photo.")
    if not todo:
        sys.exit(f"Nothing new to ask. Answers are in {output}")

    print(f"{len(todo)} photos will be sent to OpenRouter ({args.model}). This may cost money.")
    key = os.environ.get("OPENROUTER_API_KEY") or getpass.getpass("Grown-up's OpenRouter key: ").strip()
    if not key:
        sys.exit("No key, so nothing was sent.")

    spent, failed, waiting = 0.0, 0, list(todo)
    with ThreadPoolExecutor(max_workers=max(1, args.at_once)) as pool:
        while waiting:
            if spent >= args.max_dollars:
                print(f"Stopped: spent ${spent:.4f}, the limit is ${args.max_dollars:.2f}.")
                break
            batch, waiting = waiting[:max(1, args.at_once)], waiting[max(1, args.at_once):]
            jobs = {pool.submit(ask, p, args.model, key, names): p for p in batch}
            for job in as_completed(jobs):
                photo = jobs[job]
                try:
                    result = job.result()
                except (OSError, ValueError) as error:
                    failed += 1
                    print(f"  {photo.name}: failed. {explain(error)}")
                    continue
                saved["photos"][photo.name] = result
                spent += result["cost"] or 0
                best = result["top3"][0]["said"] if result["top3"] else result.get("problem")
                print(f"  {photo.name}: {best} ({result['seconds']} s)")
            output.write_text(json.dumps(saved, indent=1), encoding="utf-8")   # saved after every batch
            if failed == len(batch) and not saved["photos"]:
                print("Every photo failed, so I stopped. Check the key and the model name.")
                break
    print(f"Spent about ${spent:.4f}. {len(saved['photos'])} answers saved in {output}")


if __name__ == "__main__":
    main()
