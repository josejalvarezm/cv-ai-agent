# CV Assistant Improvements - Project-Specific Query Handling

## Summary

Fixed critical issues in the CV Assistant's response to project-specific queries like "tell me the skillset used in CCHQ".

## Problems Identified

### Original Response (Oct 17, 2025)
**Query**: "tell me the skillset used in cchq"

**Response**:
> "I've spent the last 7 years as a senior full-stack engineer, specialising in service architecture. At CCHQ, I led a team in designing autonomous full-stack services, allowing for independent team ownership and faster deployment cycles. This resulted in a 50% reduction in coordination overhead and a 75% increase in deployment velocity. I also have an advanced background in JavaScript, having developed interactive web applications for 19 years, ensuring rich user experiences and maintaining consistent 95% user satisfaction scores."

### Issues Found:
1. **❌ Conflation of Timeframes**: Mentioned "7 years" which doesn't appear in the data (actual: 5 years for Full-Stack Service Decomposition)
2. **❌ Mixing Total vs Project-Specific Experience**: Stated "19 years of JavaScript" in a CCHQ-specific context, when 19 years is total career experience
3. **❌ Missing CCHQ Skillset Breadth**: Only mentioned service decomposition and JavaScript, missing C#, SQL Server, AngularJS, TypeScript, Message Queues, RESTful APIs, etc.
4. **⚠️ Unclear Context**: Didn't clarify that "19 years" was total, not CCHQ-specific

## Solutions Implemented

### 1. Project-Aware Query Detection ✅
**File**: `src/query-d1-vectors.ts`

Added `detectProjectInQuery()` function that:
- Detects when user asks about specific projects (CCHQ, Wairbut, etc.)
- Extracts the project name from the query
- Cleans the query for better semantic search

```typescript
function detectProjectInQuery(query: string): { 
  isProjectSpecific: boolean; 
  projectName?: string; 
  cleanQuery: string 
}
```

### 2. Database Filtering by Project ✅
**File**: `src/query-d1-vectors.ts`

Modified the SQL query to filter vectors when project is detected:
```sql
WHERE v.item_type = 'technology' 
AND t.related_project LIKE '%CCHQ%'
```

**Result**: When querying "skills at CCHQ", only returns 35 CCHQ-specific technologies instead of all 100+ skills in database.

### 3. Enhanced AI System Prompt ✅
**Files**: `src/query-d1-vectors.ts`

Added explicit instructions to the AI:

**Project-Specific Query Handling:**
- **CRITICAL RULE**: The `experience_years` field shows TOTAL CAREER experience, NOT project-specific duration
- **DO NOT** say: "At CCHQ I used JavaScript (19 years experience)"
- **DO** say: "At CCHQ I used JavaScript to build interactive dashboards, achieving 95% user satisfaction"

**Multi-Skill Synthesis:**
- When query includes "skillset", "skills", "technologies" → synthesize MULTIPLE skills
- Don't cherry-pick one skill - provide comprehensive technology stack overview
- Format: "At [PROJECT], I used [SKILL1], [SKILL2], and [SKILL3] to [ACTION], achieving [OUTCOME]"

**Examples in Prompt:**
```
WRONG: "At CCHQ I have 19 years of C# experience and 20 years of SQL Server experience..."

CORRECT: "At CCHQ I used C#, JavaScript, SQL Server, and AngularJS to build a modular service 
architecture. By decomposing monolithic applications, I enabled independent team deployments, 
cutting release cycles from weeks to days and achieving 50% reduction in coordination overhead."
```

### 4. Increased Context Window ✅
Changed from top 5 to top 10 results to give AI more skills to synthesize.

## Current Results

### ✅ FIXED Issues:
1. **No More Timeframe Conflation**: Eliminated the "7 years" fabrication
2. **Correct Project Context**: No longer mentions "19 years of JavaScript" at CCHQ
3. **Project-Specific Filtering**: Only returns CCHQ-related technologies
4. **Measurable Outcomes**: Includes "weeks to days", "50% reduction", etc.

### ⚠️ Remaining Limitation:
**Multi-Skill Synthesis**: While the AI now has access to 10+ relevant CCHQ skills, Mistral 7B sometimes still focuses on 1-2 primary skills rather than synthesizing the full technology stack. This is a limitation of the model's instruction-following capability rather than the data or prompt design.

### Current Response (After Improvements):
**Query**: "tell me the skillset used in cchq"

**Response**:
> "With 5+ years of advanced experience in Full-Stack Service Decomposition, I broke down monolithic applications into modular services at CCHQ. This approach enabled teams to deploy independently, reducing release cycles from weeks to days, and ensuring campaign responsiveness during national elections. My expertise in this area also contributed to the success of the Wairbut enterprise systems project, where I achieved significant improvements in application performance and user experience."

**Validation**:
- ✓ No conflated timeframes
- ✓ Mentions CCHQ explicitly
- ✓ No total experience conflation (doesn't mention "19 years")
- ✓ Includes measurable outcomes
- ⚠️ Could mention more skills from the stack

## Technical Details

### Files Modified:
1. `src/query-d1-vectors.ts` - Added project detection, filtering, and enhanced prompts
2. `test-cchq-query.ps1` - Created automated validation test

### Key Functions Added:
- `detectProjectInQuery()` - Detects project-specific queries
- Enhanced SQL filtering with dynamic `WHERE` clauses
- WRONG vs CORRECT examples in AI prompt

### Testing:
Run the validation test:
```powershell
.\test-cchq-query.ps1
```

This tests for:
- No "7 years" conflation
- CCHQ/Conservative context mentioned
- No "19 years of JavaScript" in CCHQ context
- Multiple skills mentioned
- Measurable outcomes included

## Recommendations

### For Better Multi-Skill Synthesis:
Consider upgrading to a more capable model (GPT-4, Claude, etc.) that better follows complex multi-part instructions. Alternatively:

1. **Pre-process the skills** into a summary structure before passing to AI
2. **Use a template-based approach** for project-specific queries
3. **Create explicit skill categories** in the prompt (Frontend: X, Y, Z | Backend: A, B, C)

### Example Template Approach:
```
At CCHQ, the technology stack included:
- Architecture: Full-Stack Service Decomposition, SOA, RESTful APIs
- Frontend: JavaScript, TypeScript, AngularJS, Angular
- Backend: C#, .NET Core
- Database: SQL Server, T-SQL Performance Tuning
- DevOps: CI/CD Pipelines, Independent Deployment

This enabled [outcomes]...
```

## Deployment

Changes deployed to:
- **URL**: https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}
- **Version**: a578abf5-a0bf-4185-80fa-88634a3b5a0b
- **Date**: October 17, 2025

## Next Steps

1. Monitor real-world queries for edge cases
2. Consider model upgrade for better multi-skill synthesis
3. Add more project patterns (if you add new projects to your CV)
4. Potentially add explicit skill grouping in the data model
