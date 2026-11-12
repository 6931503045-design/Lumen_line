# Presentation Script — JOD tang · Team Lumen Inc.

Deck: https://claude.ai/artifact/WefEFteU9Ub2yVdJgUD5dc · 13 slides · about **14 minutes** + Q&A

## Who speaks when

| Speaker | Role | Slides | Time |
|---|---|---|---|
| **Thapanapat** | Project Manager | 1 Cover · 2 Quick question · 4 Solution · 11 Team · closing | ~3:30 |
| **Sorrawis** | Technical Writer | 3 Problem · 10 Testing | ~2:30 |
| **Teerapat** | Frontend | 5 User experience · 12 Try it now | ~2:15 |
| **Teerat** | Backend | 6 Core idea · 7 Golden rules | ~2:15 |
| **Aitthiphat** | Full-stack | 8 Router · 9 Tech stack · 13 Live demo | ~3:15 |

**Running long?** Cut slide 12 (Try it now) to 30 seconds, and only read G1–G4 on slide 7.

**Before you start:** open https://lumen-line.onrender.com and the bot chat 2 minutes early. Render's free tier sleeps when nobody uses it, so wake it up first. Keep screenshots ready in case the live demo fails.

`[brackets]` = an action, not something to say.

---

## Slide 1 · Cover — Thapanapat (0:30)

Good morning everyone. We are Lumen Inc., and today we’ll show you our project, **JOD tang**.
JOD tang is a money-tracking bot that lives inside LINE. You just chat with it, and it records your spending for you.
I’m Thapanapat, the project manager. Before we start, I have a quick question for you.

## Slide 2 · Quick question — Thapanapat (0:45)

Please raise your hand if you have ever downloaded an app to track your money.
`[pause, wait for hands]`
OK. Now keep your hand up if you **still use that app today**.
`[pause]`
As you can see, most hands went down. That is exactly the problem we wanted to solve. Sorrawis will explain why.

## Slide 3 · Problem — Sorrawis (1:00)

Thank you. I’m Sorrawis, the technical writer. I wrote our SRS and the final report.
We found two problems. **First, logging is too slow.** In most apps, you open the app, choose a category, type the amount and press save. That’s four steps for one coffee. So most people give up within two or three weeks.
**Second, even if you keep logging, the app only shows where your money went.** It doesn’t answer the questions students really care about: “How much can I spend today?” and “If I want to buy something, how much should I save each month?”
Our target users are university students, 18 to 24 years old, who get money once a month and need it to last.

## Slide 4 · Solution — Thapanapat (1:00)

Our solution has three pillars.
**Pillar A is the easiest logging possible.** You just type “กาแฟ 80” in LINE — that means coffee, 80 baht — and it’s saved. You can also send a photo of a payment slip, or let K PLUS bank emails come in automatically.
**Pillar B is realistic saving.** The bot calculates how much you can safely spend today, warns you when you reach 80% and 100% of a budget, and gives you three saving plans to choose from.
**Pillar C is safe AI.** Teerat will explain that soon. First, Teerapat will show you what using JOD tang feels like.

## Slide 5 · User experience — Teerapat (1:15)

Thanks. I’m Teerapat. I designed the chat cards, the Rich Menu and the user interface.
Using JOD tang is just like chatting with a friend.
If you type “กาแฟ 80”, the bot saves it **instantly** as an 80-baht food expense. It replies with a card that has two buttons: **Undo**, and **Change category**, in case it guessed wrong.
If you type “สรุปเดือนนี้” — this month’s summary — you get a card with your income and spending.
If you send a photo of a slip, the AI reads the amount, but **nothing is saved until you press Confirm**.
For bigger tasks, like charts or editing old items, there’s a web app that opens right inside LINE. No new app to install, no extra login.
Now Teerat will explain the most important idea behind the project.

## Slide 6 · Core idea — Teerat (0:45)

Thank you. I’m Teerat. I built the backend, the database and the money engine.
Our core idea is this: **AI is the interpreter, not the accountant.**
AI is great at understanding messy human language. But it works by predicting the next word — it doesn’t really calculate. If it makes one mistake with someone’s money, they will never trust the app again.
So in JOD tang, AI only guesses what the user means. **Every calculation and every save to the database is done by our own code.**

## Slide 7 · Seven golden rules — Teerat (1:30)

To make sure of this, we wrote seven golden rules. If a pull request breaks any one of them, we don’t merge it, no matter how good the code looks.
Let me highlight four.
**G1: AI never calculates money.** It only reads numbers the user typed.
**G2: AI never writes to the database.** Every AI action waits in a pending list until the user taps Confirm.
**G3: money is stored as whole satang** — integers, not decimals. In a computer, 0.1 plus 0.2 gives 0.30000000000000004. With satang, it is exactly 30 satang.
**G4: if we turn the AI off, every core feature still works.**
The other three rules protect privacy and security: we mask account, card and phone numbers before sending anything to the AI, we never trust a user ID sent by the client, and transfers between your own accounts are not counted as spending.
Aitthiphat will now show how a message actually moves through the system.

## Slide 8 · 4-layer router — Aitthiphat (1:30)

Thank you. I’m Aitthiphat, the full-stack developer. I built the web app and the API.
Every message goes through **four layers**.
**Layer 1** is a regex pattern. “กาแฟ 80” is caught here and saved instantly.
**Layer 2** is a shared keyword dictionary, for words like “ค่าไฟ”, the electricity bill.
**Layer 3** is your personal dictionary — for example, the name of your favourite food shop.
Only if all three fail do we go to **Layer 4, Gemini AI**, for a sentence like “had lunch with friends yesterday, 300 gone”. And that result goes to the pending list for you to confirm.
The best part: **the system learns.** Every time an entry is saved, the database remembers the new word in your personal dictionary. So the longer you use it, the fewer AI calls we need. It’s cheaper, faster, and it still works if Gemini is down.

## Slide 9 · Tech stack — Aitthiphat (0:45)

Here is our tech stack. The chat uses the **LINE Messaging API**. The backend is **Node.js with TypeScript and Express**, hosted on Render. Data is stored in **Supabase PostgreSQL**, with row-level security on every table. The web app is plain HTML, CSS and JavaScript with Chart.js. The AI is **Google Gemini**, and every AI call goes through one guarded service, so we can turn it off with one setting.
Everything runs on free tiers. Sorrawis will now talk about how we test it.

## Slide 10 · Testing — Sorrawis (1:30)

Because this app handles money, testing is very important.
We have **39 automated test files** using Vitest, and the real Gemini is never called in tests.
Before every deploy, five checks must pass: all tests pass **with AI turned off**; a fake webhook is rejected with **401**; tapping Confirm five times saves **only once**; adding 10 satang ten thousand times gives **exactly 1,000 baht**; and row-level security is on for **all 13 tables**.
One thing we learned: **AI helps us write code faster, but it doesn’t tell us if the code is correct.** For example, AI wrote budget warning code that looked right, but it compared a rounded percentage. So 79.99966% became 80%, and the warning fired too early. We only caught it because we had a test for that exact case.

## Slide 11 · Team — Thapanapat (0:45)

Thank you, Sorrawis. This is our team: me as project manager, Teerat on backend, Aitthiphat on full-stack, Teerapat on frontend, and Sorrawis on documentation.
We used an **incremental process**: one working version every week for four weeks. One rule we followed: we were **not allowed to connect the AI until the non-AI version worked well.**
Now it’s your turn to try it. Teerapat?

## Slide 12 · Try it now — Teerapat (1:00)

Please take out your phones and **scan the QR code** to add JOD tang on LINE.
Try typing “กาแฟ 80”, and see how fast it replies. Then type “สรุป” for your summary, or “เหลือ” to see how much you can spend today.
Notice that it replies instantly. No AI is used here — this is our Layer 1 fast path.
`[give the audience about one minute]`

## Slide 13 · Live demo & closing — Aitthiphat, then Thapanapat (1:30)

**Aitthiphat:** Now let me show a quick live demo on the big screen.
`[type “กาแฟ 80” → point at the card]`
`[type “เหลือ” → read the daily amount out loud]`
`[open the web app inside LINE → show the coffee on the transactions page]`

**Thapanapat:** So that’s JOD tang: log your money in one message, with AI that helps but never touches your money. Thank you for listening. Do you have any questions?

---

## Likely questions (anyone can answer)

| Question | Short answer | Best person |
|---|---|---|
| Why store money in satang, not decimals? | Decimals in computers are not exact (0.1 + 0.2 = 0.30000000000000004). Whole satang are always exact. (G3) | Teerat |
| Why not let AI calculate? | AI predicts words; it doesn’t really do math. One mistake with real money breaks trust. (G1) | Teerat |
| What if Gemini goes down? | Layers 1–3 still work, so users can still log, see summaries, budgets and plans. (G4) | Aitthiphat |
| Isn’t confirming every time annoying? | You only confirm when AI guessed (Layer 4) or for slips. Normal messages save instantly. | Teerapat |
| Is my data safe? | Row-level security on all tables, user ID comes only from LINE’s signature, and private numbers are masked before AI. | Teerat |
| How did you split the work? | GitHub Issues, one owner per task, every PR reviewed and tests must pass before merge. | Thapanapat |
