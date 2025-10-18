# 🎯 Quick Reference Card - CV Assistant

## Production URLs
- **Production**: `https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}`
- **Development**: `https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}`

## Daily Capacity at a Glance
```
Daily Budget:     10,000 neurons (free tier)
Safety Buffer:    -500 neurons
Usable Budget:    9,500 neurons
Cost per Query:   120 neurons (Llama 3.1 70B)
Daily Capacity:   ~79 queries
Weekly Capacity:  ~395 queries (Mon-Fri only)
```

## Operating Schedule
| Aspect | Status |
|--------|--------|
| **Mon-Fri 08:00-20:00** | ✅ ACTIVE |
| **Outside Hours** | ❌ BLOCKED |
| **Saturday & Sunday** | ❌ DISABLED |
| **Time Zone** | GMT/BST (UK) |

## Query Limits by Type
| Query Type | Tokens | Cost | Daily Limit |
|-----------|--------|------|------------|
| Short | 50 input, 100 output | ~60 neurons | **158** |
| Average | 200 input, 300 output | **~120 neurons** | **79** |
| Long | 500 input, 500 output | ~200 neurons | **47** |

## Quota Alerts
| Usage | Status | Action |
|-------|--------|--------|
| 0-4,750 | ✅ OK | Proceed normally |
| 4,750-7,125 | ⚠️ Warning | Monitor usage |
| 7,125-9,500 | 🟡 Alert | Consider slowing down |
| >9,500 | 🔴 Error | Queries blocked |

## Check Quota
```bash
curl https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}/quota
```

## Response when Outside Hours
```
"Our assistant is available during UK business hours 
(Monday-Friday, 08:00-20:00 GMT/BST). Please return then."
```

## Key Features
- ✅ Llama 3.1 70B (10x better instruction-following)
- ✅ Semantic search with vector embeddings
- ✅ Project-aware query detection
- ✅ Multi-skill synthesis
- ✅ Measurable outcome inclusion
- ✅ Weekend disabling
- ✅ UK time zone (GMT/BST)
- ✅ Daily quota tracking
- ✅ Circuit breaker protection

## Model Quality
- **WPF Queries**: ⭐⭐⭐⭐⭐ Correctly identifies WPF
- **CCHQ Queries**: ⭐⭐⭐⭐⭐ Mentions multiple skills
- **Leadership Queries**: ⭐⭐⭐⭐⭐ Accurate classification

## What Changed (Oct 17, 2025)
- Mistral 7B → **Llama 3.1 70B** (main change)
- 75 neurons → **120 neurons** per query
- CET → **GMT/BST (UK time)**
- Added **weekend disabling**
- Enhanced **recruiting keyword support**
- Updated **quota tracking** and documentation

---
**Last Updated**: October 17, 2025  
**Status**: ✅ LIVE & VERIFIED
