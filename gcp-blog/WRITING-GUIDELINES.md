# Writing Guidelines: The Spirit of Technical Storytelling

*Based on the AWS Analytics Series narrative approach*

---

## Core Philosophy

**Technical writing that teaches through discovery, not instruction.**

Every blog post should feel like a colleague sharing hard-won insights over coffee, not a textbook explaining concepts. The reader should understand not just *what* was built, but *why* it matters and *what alternatives were rejected*.

---

## The Seven Principles

### 1. Problem-First Narrative

**Don't start with solutions. Start with problems.**

❌ **Encyclopedic:** "This post explains multi-cloud security patterns including HMAC signature validation, IAM policies, and secrets management."

✅ **Problem-First:** "I deployed the webhook receiver on Friday. By Monday morning, I had 47 fake events in my database. Someone was spoofing GitHub webhooks."

**Structure:**
- Open with a concrete failure, limitation, or question
- Establish stakes before introducing solutions
- Show vulnerability: "I didn't know...", "I couldn't see...", "It failed because..."

### 2. Constraint-Driven Design

**The £0/month constraint isn't a limitation—it's the organizing principle.**

Every architectural decision must be justified by this constraint. Don't apologize for frugality. Celebrate it as discipline.

❌ **Apologetic:** "While we're limited to free tier services..."

✅ **Principled:** "The £0 constraint eliminates expensive shortcuts. You can't throw money at problems. What remains are patterns that work regardless of budget."

**For every technical choice, explain:**
- Why this approach (tied to the constraint)
- What alternatives cost money
- What trade-offs were accepted

### 3. Explicit Non-Requirements

**Dedicate sections to what you chose NOT to build.**

This demonstrates judgment, not just capability. It shows editorial thinking.

**Structure:**
```markdown
### What I Chose Not to Build

**Kubernetes orchestration:** Portfolio projects don't need the operational overhead. Lambda + Cloud Functions provide sufficient compute without managing clusters.

**GraphQL gateway:** REST endpoints meet current needs. GraphQL adds complexity (schema management, resolver logic, caching strategies) without measurable benefit at current traffic levels.

**Real-time dashboards:** Weekly email summaries are sufficient. Real-time visibility would require CloudWatch Insights or QuickSight (both exceed free tier). Over-engineering for portfolio projects.
```

Show readers that **saying no** is as important as saying yes.

### 4. Measured Outcomes, Not Claims

**Replace claims with numbers. Replace intentions with results.**

❌ **Claims:** "The system is fast and reliable with excellent performance."

✅ **Measured:** "p50 latency: 11ms. p95 latency: 12ms. p99 latency: 18ms. Error rate: 0.03% (3 failures per 10,000 requests)."

**Every major section should include:**
- Actual deployment times
- Real error rates
- Surprising discoveries from production
- Failed attempts and what you learned

**Example structure:**
```markdown
## The Measured Outcome

After implementing [feature], I learned:

**Expected results:**
- [What you predicted]

**Actual results:**
- [What actually happened]
- [Specific numbers]

**Surprising discoveries:**
- [Something unexpected]
- [A failure that taught you something]
- [A metric that challenged assumptions]
```

### 5. Architecture Justified, Not Described

**Every architectural choice needs a "Why this?" defense.**

Don't just describe your architecture. Defend it against alternatives. Show the reader you considered other options and explain why you rejected them.

❌ **Descriptive:** "CV Analytics uses DynamoDB for storage."

✅ **Justified:** 

```markdown
### DynamoDB Storage (Not RDS or MongoDB)

**Why DynamoDB:**
- Free tier: 25 GB storage (always-free, never expires)
- Single-table design minimizes costs
- Automatic TTL cleanup after 90 days
- Pay-per-request billing aligns with traffic patterns

**Why not RDS:**
- RDS free tier expires after 12 months
- Provisioned instances cost £15/month minimum
- Connection pooling complexity
- Over-engineered for key-value access patterns

**Why not MongoDB Atlas:**
- Free tier limited to 512 MB
- No automatic TTL cleanup
- Network egress charges for multi-cloud
- Additional vendor lock-in
```

**Template:**
```markdown
### [Your Choice] (Not [Alternative A] or [Alternative B])

**Why [Your Choice]:**
- [Reason 1 tied to constraint]
- [Reason 2 tied to requirements]
- [Reason 3 tied to simplicity]

**Why not [Alternative A]:**
- [Cost/complexity/limitation]

**Why not [Alternative B]:**
- [Cost/complexity/limitation]
```

### 6. Conversational Precision

**Write like you speak. But speak precisely.**

❌ **Academic:** "The implementation of asynchronous event processing facilitates decoupling between system components."

✅ **Conversational:** "SQS queues let services talk without waiting for responses. Webhook receiver writes to queue, Lambda processes later. If Lambda fails, queue retries automatically. No tight coupling."

**Guidelines:**
- Short paragraphs (2-4 sentences maximum)
- Rhetorical questions that guide thinking
- Strong opinions clearly stated
- Active voice, not passive
- Contractions are fine (don't, can't, won't)
- Technical precision in simple language

**Example:**
```markdown
Why batch messages? Cost.

Without batching:
- 1,000 messages = 1,000 Lambda invocations
- Cost: £0.20 per million = £0.0002

With batching (size 10):
- 1,000 messages = 100 Lambda invocations
- Cost: £0.00002
- **90% reduction**

Trade-off: 5-second latency. Analytics don't need instant processing.
```

### 7. Teach Through Reflection, Not Instruction

**Share what you learned, not what you knew.**

Don't position yourself as the expert lecturing beginners. Position yourself as the practitioner sharing discoveries.

❌ **Instructional:** "You should always use HMAC signatures to validate webhooks."

✅ **Reflective:** "I deployed without HMAC validation first. Within 24 hours, someone discovered the endpoint and flooded it with fake events. HMAC signatures solved this—GitHub signs every webhook, you verify the signature, reject anything that doesn't match."

**Voice patterns:**
- "Here's what I learned..."
- "This surprised me..."
- "I tried X first, but it failed because..."
- "After three attempts, I discovered..."

---

## Structural Templates

### Opening Template

```markdown
# [Title]: [The Specific Problem]

*[One-sentence philosophy that challenges assumptions]*

## The Dilemma

[Concrete situation that exposes the problem]

[Personal statement of what you couldn't do/see/understand]

[Why this matters: the stakes]

---
```

### Architecture Section Template

```markdown
## The Architecture Decision

[Diagram]

### Why This Architecture?

**[Component A] ([why not alternative]):**

- [Benefit 1 tied to constraint]
- [Benefit 2 tied to requirements]
- [Trade-off accepted]

**[Component B] ([why not alternative]):**

- [Benefit 1 tied to constraint]
- [Benefit 2 tied to requirements]
- [Trade-off accepted]

[Summary statement tying back to constraint]
```

### Closing Template

```markdown
## The Measured Outcome

After implementing [feature], I learned:

**[Category 1]:**
- [Specific result with number]
- [Specific result with number]

**[Category 2]:**
- [Specific result with number]

**Surprising discoveries:**
- [Unexpected finding]
- [Failed assumption]
- [New question raised]

[How this changed your understanding]

---

## The Core Principle

[One-sentence philosophy that ties back to opening]

[Why this matters beyond the specific implementation]

[What the reader should take away]

---

**Next:** [Link to next post in series]
```

---

## Editing Checklist

Before publishing, verify every post includes:

### Opening
- ☐ Starts with a concrete problem/failure/limitation
- ☐ Establishes stakes in first 3 paragraphs
- ☐ Shows vulnerability or discovery

### Body
- ☐ Every architecture choice defended against alternatives
- ☐ "What I Chose Not to Build" section present
- ☐ Trade-offs explicitly stated
- ☐ £0 constraint referenced in multiple places
- ☐ Conversational tone maintained (short paragraphs, active voice)

### Evidence
- ☐ Specific numbers provided (latencies, costs, error rates)
- ☐ "Measured Outcome" or "Results" section present
- ☐ Surprising discoveries shared
- ☐ Failed attempts acknowledged

### Voice
- ☐ Reflective, not instructional
- ☐ "I learned" not "You should"
- ☐ Strong opinions clearly stated
- ☐ Technical precision in simple language

---

## Anti-Patterns to Avoid

### ❌ Tutorial Voice
"First, we'll set up the Lambda function. Then, we'll configure the SQS trigger. Finally, we'll test the integration."

### ✅ Discovery Voice
"I configured Lambda to poll SQS every 30 seconds. Cost: £0.50/month. Then I discovered event source mapping—Lambda polls automatically, free tier included. Removed polling code."

---

### ❌ Feature List
"The system includes: webhook validation, async processing, batch processing, scheduled reporting, and email notifications."

### ✅ Problem-Solution Pairing
"Webhook floods exhausted my free tier in 3 hours. HMAC signatures fixed this. Queue backlogs delayed reports by 2 days. Batch processing (size 10) fixed this."

---

### ❌ Theoretical Benefits
"Microservices provide better scalability, fault isolation, and team autonomy."

### ✅ Concrete Trade-offs
"Microservices let me deploy the dashboard without touching the webhook receiver. Trade-off: 3 repositories to maintain instead of 1. Worth it—I deploy the dashboard 5× more often than other services."

---

## The Test

**Ask yourself before publishing:**

1. **Could I explain this to a colleague in a coffee shop?** If not, it's too formal.

2. **Did I justify every architectural choice?** If not, add "Why X (not Y)" sections.

3. **Did I share what I learned, or what I knew?** Readers want discovery, not lectures.

4. **Would I believe my own claims?** If not, add measured outcomes.

5. **Did I show what I chose NOT to build?** Judgment matters as much as capability.

If you can't answer "yes" to all five, revise.

---

## Examples: Before and After

### Before (Encyclopedic)
"This post explains multi-cloud security patterns. We will cover HMAC signature validation, IAM role configuration, secrets management in CI/CD pipelines, and database security rules. These patterns ensure secure communication between services."

### After (Problem-First)
"I deployed the webhook receiver on Friday afternoon. By Monday morning, I had 347 fake events in my database—someone had discovered my endpoint and was spamming it. My analytics were useless. I needed webhook authentication, but free tier couldn't run an API gateway. HMAC signatures solved this: GitHub signs every webhook, I verify the signature, cost: £0."

---

**The goal:** Technical writing that respects the reader's intelligence while sharing authentic discovery. Not teaching from authority, but learning in public.
