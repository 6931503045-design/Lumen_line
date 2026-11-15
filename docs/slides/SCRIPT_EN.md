# Final Demo Script — Team Lumen (JOD tang)

**5 speakers · ~9 minutes** (10 at most) · *[italic brackets]* = what to do, don't read aloud
**FR-xx** in bold = say it out loud (this earns the Golden Thread marks)
Messages typed into the bot stay in Thai — the bot reads Thai. The meaning is in brackets.

| # | Speaker | Topic | Time |
|---|---|---|---|
| 1 | Thapanapat | Problem and users | 0:00–1:30 |
| 2 | Teerapat | LINE chat demo | 1:30–3:30 |
| 3 | Aitthiphat | Web demo | 3:30–5:45 |
| 4 | Teerat | Money Engine + unhappy paths | 5:45–7:45 |
| 5 | Sorrawis | Golden Thread + lessons | 7:45–9:15 |

> ⏱️ If a rehearsal still runs over 10 minutes, cut the parts marked ✂️ first.

---

## 1 · Thapanapat — Problem and users (~1:30)

*[Open slide 1]*

> Hello everyone, we are Team Lumen, and today we're presenting **JOD tang**, a money-tracking bot on LINE.
>
> Quick question first: who has ever downloaded an expense app and quit within a few weeks? Raise your hand.
>
> *[Wait 2 seconds]*
>
> That's our first problem. Most apps take several steps per entry, so people stop logging within two or three weeks.
> The second problem: even if you log everything, the app only tells you where your money went. It doesn't answer the two questions you actually care about:
> **"How much can I still spend today?"** and **"I want this thing — how do I save for it?"**

*[Slide 2]*

> Our users are students who get their money as a monthly lump sum, and who already have LINE open all day.
> So we built it on LINE. No new app to install, and you log an expense in one message.
>
> **[Speaker 2's name]** will show you the real thing.

---

## 2 · Teerapat — LINE chat demo (~2:00)

*[Switch to the phone screen]*

> Say I just bought a coffee. I only type this.

*[Type `กาแฟ 80` ("coffee 80") → wait for the card]*

> The bot records it instantly, with a category and a budget bar. This is **FR-01, logging from a single message**.
>
> What about a word the system doesn't know, like the name of a shop near my dorm?

*[Type `ร้านป้าแดง 50` ("Auntie Daeng's shop 50") → tap the อาหาร (Food) button]*

> It files it under "Other" for now and lets me pick the category. Fixing it here is **FR-03**.
> And the system remembers. Next time I type that shop's name, it goes straight to Food.
>
> Now the first question. One word.

*[Type `เหลือ` ("left") → read the amount aloud]*

> Today I can still spend *[read amount]* baht. That's **FR-05**.
>
> So where did those entries go? **[Speaker 3's name]**.

🆘 *[If the bot doesn't reply within 10 seconds]* "The free server is waking up, so let's use the mock-up instead." → open `web/chat.html`

---

## 3 · Aitthiphat — Web demo (~2:15)

*[Tap the Rich Menu → open the website → Overview page]*

> You open the website straight from LINE and log in with your LINE account. No sign-up.
> The Overview page shows what you can spend today, the same number as in the chat, plus the entries we just typed. This is **FR-04**.

*[Transactions page → point at the "อีเมล" (Email) tag]*

> This entry has an "Email" tag. Nobody typed it. It came from a K PLUS bank email that was forwarded in, and it showed up on its own within 5 minutes. This is **FR-02**.

*[Categories page]*

> You set a budget for each category. At 80% and 100%, the bot warns you in the chat. This is **FR-06**.

*[Analysis page → create a plan: headphones, 3,000 → choose "Balanced"]*

> The second question: I want headphones for 3,000 baht. The system offers three options — fast, balanced, and relaxed — each showing how much to save per month and for how many months. This is **FR-07**.
> Once I pick one, I can move money into the plan and track progress, and the bot warns me if I fall behind. That's **FR-08**.

✂️

> Behind the scenes it's a Node.js server on Render with data in Supabase, and every push has to pass the tests before it deploys.

> So why can you trust these numbers? **[Speaker 4's name]**.

---

## 4 · Teerat — Money Engine and unhappy paths (~2:00)

> In a money app, one wrong number and users stop trusting it. Our principle is: **AI is an interpreter, not an accountant.**
> AI never calculates money. Money is stored as whole satang so decimals can't drift. And if AI wants to record anything, the user has to confirm first.
>
> Most messages are read by plain code. Out of 84 real chat messages, only 11% needed AI. Turn AI off and the app still works.
>
> Now let's look at what happens when things go wrong. If I type something incomplete:

*[Type `กาแฟ` ("coffee", no amount)]*

> The system doesn't guess. It says it couldn't read the message, shows the right format, and saves nothing.
>
> And if I type a long, natural sentence:

*[Type `เมื่อวานกินข้าวกับเพื่อนหมดไปสามร้อย` ("Yesterday I spent three hundred eating with friends")]*

> AI reads it as a 300-baht food expense, but look at the top of the card: "Not saved yet." I have to confirm first.

*[Tap ยืนยัน (Confirm)]*

> Only now is it saved. AI never gets to touch the money on its own.
>
> Next, **[Speaker 5's name]** will prove it.

🆘 *[If the bot is down]* open `web/chat.html` → the red "กาแฟ (ไม่มียอด)" button and the long-sentence button

---

## 5 · Sorrawis — Golden Thread and lessons (~1:30)

*[Slide 5 — Golden Thread]*

> This table proves everything connects. Take one row.
> The problem "How much can I still spend today?" becomes **FR-05**, designed in the Money Engine where AI is not allowed, delivered as the `เหลือ` command you just saw, and backed by a passing test.
> *[Point at the sequence diagram]* And this is the diagram for **FR-01**: the path the "coffee 80" message takes.
>
> Every time we change the code, **1,299 automated tests** must pass before anything reaches the live site.

✂️

> We once had budget-alert code, written with AI help, that looked right on every line — but it rounded 79.99966% up to 80% and warned too early. The tests caught it before any user did.

*[Slide 6]*

> We used AI to help write code, under rules our team wrote down. And our biggest lesson is:
> **"AI speeds up writing. It doesn't speed up knowing it's right."**
>
> Thank you. Any questions?

*[Invite the whole team to the front]*
