# AWS Builder Center article — ShareTable / First Commit

Copy each field into https://builder.aws.com (Create an article).

---

## Title
*(58 / 255 characters)*

```
What we learned building ShareTable at First Commit
```

## Description
*(218 / 512 characters)*

```
College messes waste food while nearby NGOs never get a fast signal. At WeMakeDevs First Commit we shipped ShareTable on AWS App Runner, and learned what it takes to go from a campus problem to a live rescue flow in four days.
```

## Tags
*(pick up to 5)*

```
App Runner
EventBridge
S3
hackathon
food-rescue
```

Alternate set if those tags are unavailable:

```
AWS
containers
serverless
community
builders
```

---

## Body (Markdown)

```markdown
# What we learned building ShareTable at First Commit

Four days. One real problem. One live URL.

That was our First Commit week with WeMakeDevs and AWS, and it changed how we think about shipping.

## The problem that pulled us in

Walk through a college mess after lunch and you can feel it: trays of food that are still usable, and a quiet certainty that most of it will be thrown away. Nearby NGOs and community kitchens would take it. They just never get a fast, trustworthy signal.

That gap is not a blog post problem. It is an ops problem.

- Donors need a way to post surplus in minutes, with location and basic safety details.
- Recipients nearby need a claim that cannot double-book the same meals.
- Pickup has to finish inside a short window, or the food is gone anyway.
- Impact should only count meals that were actually picked up, not meals that looked good on a dashboard.

We built **ShareTable** for that loop:

**Donate → match within ~2.5 km → notify → claim → pickup code → mark picked up → impact.**

If nobody claims, the radius can widen to 4 km and then 6 km so the food gets a second and third chance before it expires.

Live demo: [https://vmcwfgh43e.ap-south-1.awsapprunner.com](https://vmcwfgh43e.ap-south-1.awsapprunner.com)

Public repo: [https://github.com/the-ivii/ShareTable](https://github.com/the-ivii/ShareTable)

## Why First Commit felt different

Hackathons can reward flashy slides. First Commit kept pushing us toward something harsher and better: **show the thing running**.

The Ship It track meant we could not hide behind localhost forever. Judges and mentors could open a real App Runner URL in `ap-south-1`. Our `/api/health` endpoint even returns `runtime: "ap-runner"`, which became a small proof that AWS was not just a buzzword in the README.

That pressure was exciting. Exhausting too. But exciting.

We were a two-person team:

- **Pratyksh Gupta** on the Express API, geospatial matching, atomic claims, assistant confirm flows, and AWS deploy path
- **Divyanshi Talreja** on the React + Vite product UI, maps, dashboards, and the experience that makes the rescue loop feel human

Splitting frontend and backend ownership forced clear contracts early. When the claim button had to feel instant, both sides had to agree on what “atomic” really meant.

## What we actually learned

### 1. Ship the core loop before the clever features

The first working path mattered more than polish: post food, notify nearby recipients, claim without overbooking, pick up with a code. Once that worked, urgency scores, escalation, and the assistant became multipliers instead of distractions.

### 2. Cloud constraints teach architecture faster than tutorials

App Runner’s small memory tier (0.5 GB) killed the fantasy of hosting a local LLM in the container. That one limit pushed us toward a clean provider switch: Groq for live helpers now, Amazon Bedrock Nova Micro wired in code for when account access opens.

EventBridge taught a different lesson. Rescue radius expansion cannot depend on someone refreshing the nearby list. A one-minute rule (`sharetable-rescue-tick`) calling `/api/internal/rescue-tick` made the product behave when the UI was idle.

S3 presigned uploads taught trust boundaries: the browser never needs AWS keys to put a meal photo in the bucket.

### 3. “Almost AI” is worse than confirm-before-send

We added a ShareTable Assistant for late notes, arrival updates, and pickup instructions. The important product rule was not the model. It was the human gate.

Nothing goes out until the user hits **Confirm** or types something like `send it`. That saved us from inventing food-safety promises and from leaking pickup codes into the wrong alerts.

### 4. Honesty about the stack builds trust

Our data lives in MongoDB Atlas. Auth is JWT. Live LLM calls currently run through Groq because Bedrock access was still gated. Saying that out loud in the writeup felt better than pretending everything was AWS-native.

AWS still sits at the center of the shipped product: **App Runner, ECR, S3, EventBridge, IAM**, plus the Bedrock SDK ready for the flip.

### 5. Energy compounds when the problem is local

Building for a campus-shaped problem (Polaris-area seed data, Bengaluru distances, one-hour pickup) kept us grounded. Every time we got tired, the story was still simple: food is about to be wasted, and someone nearby could use it tonight.

## The enthusiasm we are taking with us

First Commit did not feel like “add AWS stickers to a weekend project.” It felt like being invited to treat a student-built product as something that deserves a public URL, real IAM roles, and a demo under three minutes.

We leave the week more stubborn about end-to-end flows, more respectful of operational details (expiry, concurrency, scheduled ticks), and more excited to keep ShareTable alive past the submission form.

If you are a donor with leftover meals, or a recipient who can move quickly, try the live app. If you are a builder staring at a campus problem that looks “too ordinary” for a hackathon, take this as permission: ordinary problems are often the ones people will actually use.

Donate. Match. Claim. Pick up. Count only what was rescued.

That is ShareTable. And First Commit was the push that made us ship it.
```

---

## Cover image note

Optional. Prefer a clean screenshot of the ShareTable landing page or App Runner URL in the browser (1200×675, under 2 MB, little or no overlaid text). Skip a busy collage.
