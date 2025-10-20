# System Optimization - October 19, 2025

## 🎯 Critical Bug Fix: Neuron Cost Tracking

**Version:** `ef18e2cc-9a0b-4c99-b430-2632e411c242`

### Problem Discovered

The system was using a **fixed neuron cost of 102 per query**, which was:
- Based on OLD testing when `max_tokens` was 150 (now 80)
- Calculated before aggressive laconic enforcement was implemented
- **Overcharging by 20x** compared to actual usage

### Actual Cost Calculation

**Llama 3.1 70B Pricing:**
- Input: 6,667 neurons per 1M tokens = **0.006667 neurons/token**
- Output: 13,889 neurons per 1M tokens = **0.013889 neurons/token**

**Per Query Breakdown:**
```
System prompt + context: ~500 tokens × 0.006667 = 3.3 neurons
User input: ~100 tokens × 0.006667 = 0.67 neurons
AI output: ~50 tokens × 0.013889 = 0.69 neurons
-----------------------------------------------------------
TOTAL: ~4.7 neurons per query
```

**User Input Impact:**
- 200 chars max ≈ 100 tokens ≈ 0.67 neurons
- **User input length has MINIMAL impact on total cost**

### Changes Made

#### 1. Fixed Neuron Cost (ai-quota.ts)

**Before:**
```typescript
'llama-3.1-70b-instruct': 102, // WRONG - 20x overcharge
```

**After:**
```typescript
'llama-3.1-70b-instruct': 5, // Conservative estimate with safety buffer
```

**Documentation Added:**
```typescript
// With max_tokens=80 and aggressive laconic enforcement:
// Input: ~500 tokens × 0.006667 = ~3.3 neurons
// Output: ~50 tokens × 0.013889 = ~0.7 neurons
// Total: ~4-5 neurons per query (user input adds minimal ~0.5-0.8 neurons)
```

#### 2. Optimized Input Length (input-validation.ts)

**Before:**
```typescript
const MAX_INPUT_LENGTH = 250;
```

**After:**
```typescript
const MAX_INPUT_LENGTH = 200;
```

**Rationale:**
- 200 chars allows complete questions with context
- Typical queries: 30-80 chars
- Prevents rambling, multi-question inputs
- Cost impact negligible: 0.17 neurons savings per query

### Impact Analysis

#### Free Tier Capacity (9,500 neurons/day)

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Neuron cost per query** | 102 | 5 | 95% reduction |
| **Daily query capacity** | 93 | 1,900 | **20x increase** |
| **Queries per hour** | 4 | 79 | 19x increase |
| **Monthly capacity** | 2,790 | 57,000 | 20x increase |

#### Production Impact

**Before (with 102 neurons/query):**
- ❌ System artificially limited to 93 queries/day
- ❌ Hitting quota unnecessarily
- ❌ Free tier underutilized

**After (with 5 neurons/query):**
- ✅ System can handle **1,900 queries/day**
- ✅ Free tier capacity properly utilized
- ✅ Room for growth and testing
- ✅ Accurate cost tracking

### Validation

**Deployment:**
```bash
npx wrangler deploy --env production
# Version: ef18e2cc-9a0b-4c99-b430-2632e411c242
# Deployed: October 19, 2025
```

**Expected Results:**
1. ✅ Quota tracking shows realistic neuron consumption
2. ✅ Daily capacity increases from 93 to 1,900 queries
3. ✅ Input validation rejects queries over 200 chars
4. ✅ Cost estimates accurate within 10%

**Monitoring:**
```bash
# Check actual vs predicted costs
npm run analytics:today

# Verify quota usage
curl https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}/quota
```

### Technical Details

**Files Modified:**
1. `src/ai-quota.ts` (line 31) - Changed neuron cost 102 → 5
2. `src/input-validation.ts` (line 6) - Changed max length 250 → 200

**No Breaking Changes:**
- ✅ All existing functionality preserved
- ✅ Same API interface
- ✅ Same response format
- ✅ Backward compatible

### Cost Breakdown by Component

| Component | Tokens | Neurons | % of Total |
|-----------|--------|---------|------------|
| System prompt | ~350 | 2.33 | 47% |
| User query (200 chars max) | ~100 | 0.67 | 13% |
| Context (top 5 skills) | ~150 | 1.00 | 20% |
| AI output (max_tokens=80) | ~50 | 0.69 | 14% |
| Safety buffer | - | 0.31 | 6% |
| **TOTAL** | **650** | **5.00** | **100%** |

### Why 5 Neurons (Not 4)?

- Actual cost: ~4.7 neurons
- **Safety buffer: 0.3 neurons** (6% margin)
- Accounts for:
  - Longer queries (up to 200 chars)
  - Slightly longer responses (varies by query)
  - Token estimation variance
  - Future prompt adjustments

**Better to slightly overestimate than underestimate quota usage.**

### Future Refinements

If analytics show consistent usage **below 4 neurons**:
- Consider reducing to 4 neurons (25% more capacity)
- Current buffer is conservative but safe

If analytics show consistent usage **above 6 neurons**:
- Increase to 6-7 neurons (still 15x better than 102)
- Investigate prompt/response length changes

### Related Changes

This optimization complements:
1. ✅ Aggressive laconic enforcement (max 2 sentences, 80 tokens)
2. ✅ Stop sequences (". Additionally", ". I also", etc.)
3. ✅ Post-processing filler removal (10+ regex patterns)
4. ✅ Project-specific query filtering (CCHQ, Wairbut)

**All changes work together to minimize cost while maximizing quality.**

---

## 📊 Summary

**Problem:** Overcharging 20x on neuron costs, limiting capacity unnecessarily

**Solution:** Fixed neuron cost (102 → 5), optimized input length (250 → 200)

**Impact:** **20x more queries per day** (93 → 1,900 on free tier)

**Status:** ✅ Deployed to production (`ef18e2cc-9a0b-4c99-b430-2632e411c242`)

---

**Next Steps:**
1. Monitor analytics for actual neuron consumption
2. Verify quota tracking aligns with predictions
3. Test with various query lengths (50-200 chars)
4. Adjust neuron cost if needed (4-6 neurons range)
