# AGENTS.md

Hi, AI helper! Read this before you help with this project.

## About this project

**Pyinsect** is a website that looks at a photo of an insect, says what it is, and reports
**invasive** insects (bugs that harm nature where they don't belong). Our team of kids made it
for the FIRST LEGO League **Bio Glow** challenge, which is about using technology to protect
biodiversity.

## Who you are helping

Kids in elementary and middle school. Please:

- Use short sentences and simple words. Explain any new word.
- Make **one small change at a time**, then tell us what you changed and how to test it.
- Explain *why*, not just *what*, so we learn.
- Ask us a question if you are not sure what we want.
- Never pretend something works. If you didn't test it, say so.

## Where things are

| File or folder | What it does |
|---|---|
| `index.html` | The main page: splash, permissions, Home, Detect, Game, and Map screens |
| `assets/app.js` | The AI and report code: camera, photos, runs the model, sends reports |
| `assets/flow.js` | The screens and menu bar: splash, permissions, home, the 3 Detect steps, and the results pop-up |
| `assets/reportsmap.js` | The Map screen: our numbers and the reports map |
| `assets/site.css` | Colors, fonts, and layout |
| `assets/species.js` | Common names for each insect |
| `assets/models/` | Settings for each model version, like the invasive list |
| `assets/trees/` | Settings for each tree: the Detect step words and photos (with credits), and the damage signs |
| `model/` | The trained AI models (`.onnx` files) |
| `relay/worker.js` | Runs on Cloudflare and saves reports |
| `scripts/check.js` | Checks for mistakes. Run `node scripts/check.js` before sharing work |
| `.github/workflows/` | Makes GitHub run those checks on every pull request |
| `skills/shared/` | Team skills shared by all our projects (a git submodule, don't edit here) |
| `skills/` | Skills just for this project |
| `requirements.md` | Our list of planned features |
| `README.md` | How to set up the website |

## Project details

The shared skills read this section, so keep it up to date.

- **Repo:** `wizkidzai/pyinsect` (renamed from `Pyinsect-Site` in Oct 2026)
- **Live site:** https://wizkidzai.github.io/pyinsect/
- **Extra tools:** Python 3 (`python3 --version`, Windows: `python --version`) to run the site,
  and Node.js (`node --version`) to check the code.
- **Run it:** it's a plain website with no build step. Run `python3 -m http.server 8000`
  (Windows: `python`) in this folder, then open http://localhost:8000.
- **Check it:** `node scripts/check.js`. It looks for typing mistakes in the code, invasive lists
  that don't match, secrets, and report photos. GitHub runs it on every pull request.
- **Try it like a user:** pick an insect photo and check the result.
- **Where new features go:** page layout in `index.html`, code in `assets/app.js` (or a new file
  in `assets/`), and styles in `assets/site.css`.
- **Deploy:** GitHub Pages puts `main` online by itself after a merge. The relay
  (`relay/worker.js`) uses secret tokens, so only a grown-up deploys it (steps in `README.md`).
  If a pull request changes it, write "A grown-up needs to redeploy the relay." in the pull request.

## Rules

1. **New feature? Plan it first.** If someone asks for something the app can't do yet, follow
   `skills/shared/plan-a-feature/SKILL.md`. Don't write code until the feature is in
   `requirements.md`.
   (Bug fixes, small tweaks, and changes to things the app already does don't need this.)
2. **Keep secrets secret.** This code is public. Never put passwords, tokens, or keys in any file.
3. **Reports stay private.** Never save insect reports or photos in this repo.
4. **Don't touch the `model/` files** unless a grown-up says it's okay. They are big and important.
5. **The invasive list lives in two places:** `assets/models/` and `relay/worker.js`. If you
   change one, change the other too. The same goes for tree checks: each `assets/trees/` file
   needs a matching entry in `TREE_CHECKS` in `relay/worker.js`.
6. **Make it kind and easy.** Messages people see should be friendly and simple.
7. **Use `skills/shared/devops/SKILL.md` for setup, testing, git, GitHub, and deploying.** Each
   kid works on their own branch. A grown-up reviews and merges every pull request. Never push to `main`.

## Team skills

**Skills** are small instruction files that teach the AI how to do one job well. Shared skills
are in `skills/shared/<name>/SKILL.md`. Skills just for this project are in
`skills/<name>/SKILL.md`.

Before you start a task, look at the `description` at the top of each `SKILL.md` in both places.
If one fits, read the whole file and follow it. To make a new skill, use
`skills/shared/make-a-skill/SKILL.md`.
