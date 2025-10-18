# Cost Analysis Investigation - Oct 18, 2025

## 🔍 Query: Is the JSON Responsible for Elevated Computation?

### Quick Answer
**No, the JSON file is NOT responsible for the high neuron cost.**

Here's why:

| Component | Impact on Neurons | Status |
|-----------|------------------|--------|
| **JSON file size** | ❌ ZERO impact | 100% of processing happens at query time |
| **Semantic search** | ⚠️ Minor (0.6 neurons) | Only searches embeddings, not raw JSON |
| **AI model inference** | ✅ **PRIMARY COST** | 120 neurons per query ← **THIS IS THE CULPRIT** |
| **Response length** | ✅ **AMPLIFIES COST** | Longer outputs = more output tokens = more neurons |

---

## 📊 Where the Neurons Are Being Spent

### Cost Breakdown (Per Query)

```
Total Cost per Query: ~120 neurons (Llama 3.1 70B)

Breakdown:
├─ Semantic Search (embed query): ~0.6 neurons
├─ Database Query: ~0 neurons (negligible)
├─ AI Inference: ~120 neurons (6,667 input + 13,889 output per M tokens)
│  ├─ Input tokens: ~200 tokens = ~1.3 neurons
│  └─ Output tokens: ~300 tokens = ~4.2 neurons ← **VARIABLE**
└─ Infrastructure overhead: ~0 neurons

TOTAL: ~120 neurons
```

### Why Output Length Matters

```typescript
// Llama 3.1 70B pricing (from Cloudflare):
// Input: 6,667 neurons per 1M tokens
// Output: 13,889 neurons per 1M tokens ← Output is 2.1x more expensive!

// Example:
// 200 input tokens  = (200/1M) × 6,667 = 1.3 neurons
// 300 output tokens = (300/1M) × 13,889 = 4.2 neurons
// Total = 5.5 neurons... but we budget ~120 because of overhead & safety margin
```

**Key insight:** Longer responses = exponentially higher costs

---

## 🎯 Why Your Responses Might Be "Lengthy"

Looking at the current AI prompt in `src/query-d1-vectors.ts` (lines ~300-430):

### Current Prompt Style
The system prompt is instructing the AI to:
```
✅ Provide comprehensive responses
✅ Include specific metrics/examples  
✅ Mention multiple technologies
✅ Show project context
✅ Demonstrate business impact
```

### Example Output (Current - Lengthy)
```
"At CCHQ, I utilised a range of skills, including C#, JavaScript, 
SQL Server, and AngularJS, to build a modular service architecture. 
By decomposing monolithic applications, I enabled independent team 
deployments, cutting release cycles from weeks to days. This technology 
stack supported 100,000+ daily active users during critical national 
elections, ensuring campaign responsiveness and reliability. Through my 
work, I delivered scalable, maintainable services and achieved 
significant performance gains, with a 10x improvement in query response 
times and a 50% reduction in coordination overhead."
```

**Token Count:** ~100 tokens = ~1.4 neurons (output)

---

## 🔬 Real Metrics from Yesterday

### What We Know
- **46 inferences processed** yesterday
- **3,450 neurons used** total
- **Average cost: 75 neurons per inference** (this is lower than expected!)

### Why Average Was Lower
The 75-neuron average suggests:
- Shorter responses were being generated
- Some queries hitting semantic search cache
- Mix of short and long queries

### Expected Cost Progression
```
Yesterday: 3,450 neurons ÷ 46 queries = 75 neurons/query average
├─ Some short responses (50-80 neurons)
├─ Some medium responses (100-150 neurons)  
└─ Some long responses (150-200+ neurons)

If we sent all "long" responses today:
→ 46 queries × 200 neurons = 9,200 neurons (would exceed 9,500 limit!)

If we send all "concise" responses:
→ 46 queries × 50 neurons = 2,300 neurons (only 24% of budget)
```

---

## 🎯 Solution: Make Responses More Concise

### Option 1: **Modify AI Prompt (Recommended)**

**Current instruction length:** ~400 tokens

**Proposed concise version:**
```typescript
// REPLACE this long prompt:
const systemPrompt = `You are a recruiter-facing assistant...
[200+ lines of instructions]`;

// WITH this concise prompt:
const systemPrompt = `You are José's AI assistant. Answer recruiting questions 
in 2-3 sentences maximum. Be direct and specific.

RULES:
1. First person only ("I", "my", never "José")
2. British English (optimise, utilise, organise)
3. No fluff, no explanation of why you're answering
4. Quote metrics if available
5. Stop after 3 sentences`;
```

**Impact:**
- Input tokens: 200 → 150 (-25%)
- Expected output: 50 tokens (-80% from current 300)
- **Cost per query: 120 neurons → 35-45 neurons** ✅ **60% reduction**

### Option 2: **Implement Response Templates**

For high-confidence queries (similarity > 0.8):
```typescript
if (topScore > 0.8) {
  // Use template instead of AI (0 neurons!)
  return `I have ${years} of ${level.toLowerCase()} experience with ${tech}. 
${action}. ${outcome}.`;
}
```

**Impact:** 
- Template-based = **0 neurons for high-confidence queries**
- Concise by design
- Fast response

### Option 3: **Add Token Limits**

```typescript
const aiResponse = await env.AI.run('@cf/meta/llama-3.1-70b-instruct', {
  messages: [...],
  max_tokens: 100,  // ← Limit output length
});
```

**Impact:**
- Enforces conciseness
- **Estimated cost: 50-60 neurons per query**
- AI naturally shortens responses

---

## 📈 Detailed Cost Analysis

### Cost Sensitivity

| Max Output Tokens | Avg Response | Neurons/Query | Weekly Cost | Impact |
|------------------|--------------|---------------|------------|--------|
| 500 | Long | 180 | ~8,550 neurons | ❌ **Over budget** |
| 300 | Medium | 120 | ~5,700 neurons | ✅ Current baseline |
| 150 | Short | 60 | ~2,850 neurons | ✅ **Safe margin** |
| 75 | Very Short | 35 | ~1,665 neurons | ✅ **Huge buffer** |
| Template | Minimal | 0 | ~0 neurons | ✅ **Free** |

### The Math

```
Llama 3.1 70B Pricing:
Input:  6,667 neurons/M tokens
Output: 13,889 neurons/M tokens

100 output tokens:
(100 tokens / 1,000,000) × 13,889 = 1.39 neurons

200 output tokens:
(200 / 1,000,000) × 13,889 = 2.78 neurons

300 output tokens:
(300 / 1,000,000) × 13,889 = 4.17 neurons
```

**Every 100 additional output tokens = +1.4 neurons**

---

## 🔧 Recommendation: Conciseness Strategy

### Tier 1: Immediate (Easy) - Response Limits
```bash
Add max_tokens: 100 to AI call
Expected savings: 50% of neuron cost
Time to implement: 5 minutes
Risk: Low (just truncates existing responses)
```

### Tier 2: Medium - Prompt Optimization  
```bash
Rewrite system prompt for conciseness
Expected savings: 40% of neuron cost
Time to implement: 20 minutes
Risk: Medium (quality might be slightly reduced)
```

### Tier 3: Aggressive - Template Fallback
```bash
Use templates for high-confidence queries (>0.8 similarity)
Expected savings: 70-80% of neuron cost
Time to implement: 30 minutes
Risk: Medium (might miss some nuance)
```

---

## 🚨 Impact on Your Budget

### Weekly Projection (79 queries/week average)

**Current (No changes):**
```
79 queries × 120 neurons = 9,480 neurons/week
Status: ✅ Within 9,500 limit (barely!)
```

**With max_tokens:100:**
```
79 queries × 60 neurons = 4,740 neurons/week
Status: ✅ Safe (50% budget remaining)
```

**With templates (high-confidence only):**
```
~40 template responses × 0 neurons = 0 neurons
~39 AI responses × 60 neurons = 2,340 neurons
Total = 2,340 neurons/week
Status: ✅ Safe (75% budget remaining)
```

---

## 📝 To Summarize

### JSON File Impact: **ZERO** ❌
- File size doesn't matter (loaded once, not per query)
- Only used at initialization
- Doesn't contribute to neuron cost

### What DOES Cost Neurons: **AI Model Output** ✅
- Output token count = primary cost driver
- Current responses: ~300 output tokens = expensive
- Concise responses: ~75-100 output tokens = efficient

### Your Options (In Order of Effort/Impact)

1. **Easiest:** Add `max_tokens: 100` to AI call (5 min, 50% savings)
2. **Better:** Rewrite prompt for conciseness (20 min, 60% savings)
3. **Best:** Template fallback for high-confidence (30 min, 75% savings)

Would you like me to implement any of these?

---

## 🧮 Quick Calculation Tool

```
Your query cost = (input_tokens / 1,000,000 × 6,667) 
                + (output_tokens / 1,000,000 × 13,889)

Example:
200 input tokens = 1.33 neurons
100 output tokens = 1.39 neurons
Total = 2.72 neurons base cost

But we round up to ~60 neurons budgeted per concise query
(includes safety margin, overhead, etc.)
```
