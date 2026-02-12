# Strategic Analysis: Major Architecture Changes for Contratos V-Lab

**Document Date:** February 10, 2026  
**Current Stack:** Next.js 15 + Firebase + Genkit  
**Proposed Stack:** Next.js 15 + Convex + Browser Agent Architecture  
**Approach:** Greenfield v2 Development

---

## Executive Summary

You're proposing three transformative changes that fundamentally alter the product's value proposition:

1. **Convex Migration** - Moving from Firebase to a reactive database
2. **Collaborative Projects** - Shifting from single-user to multi-user workflows
3. **Browser Agent Architecture** - Replacing template-based generation with AI agents working directly in Google Docs

**My Assessment:** These changes represent a strategic pivot from a "document generation tool" to a "collaborative contract workspace powered by AI agents." This is ambitious but could significantly differentiate your product. However, it introduces substantial complexity.

---

## Detailed Analysis of Each Change

### Change #1: Switch to Convex for Auth and Database

#### Current State Analysis
- **Firebase Strengths:** Mature ecosystem, excellent Auth, real-time capabilities, generous free tier
- **Current Pain Points:** Likely experiencing Firebase's limitations with complex queries, client-side filtering, lack of true reactivity for collaborative features

#### Convex Value Proposition
- **Reactive Queries:** Built-in real-time subscriptions (essential for collaborative editing)
- **Type Safety:** End-to-end TypeScript with generated types
- **Server Functions:** Better abstraction than Firebase Functions
- **Simpler Mental Model:** Everything is a function

#### Implementation Strategy (Greenfield)

```
Phase 1: Foundation (Weeks 1-2)
├── Set up new Convex project
├── Configure auth with Clerk (recommended) or Convex Auth
├── Design new schema optimized for multi-tenancy
└── Set up development environment alongside existing app

Phase 2: Core Data Migration (Weeks 3-4)
├── Export existing templates from Firebase
├── Create import scripts for contract models
├── Build parallel user onboarding flow
└── Test data integrity

Phase 3: Feature Parity (Weeks 5-8)
├── Rebuild document upload flow
├── Port AI flows to Convex actions
├── Reimplement contract generation
└── QA against existing app

Phase 4: Soft Launch (Week 9-10)
├── Beta with select users
├── Run both apps simultaneously
├── Gather feedback
└── Iterate
```

#### Recommended Schema for Convex

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users remain simple - Clerk handles auth
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // Projects (the new central concept)
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.id("users"),
    googleDocId: v.optional(v.string()), // Link to Google Doc
    status: v.union(
      v.literal("draft"),
      v.literal("analyzing"),
      v.literal("ready"),
      v.literal("completed")
    ),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_status", ["status"]),

  // Project Membership (collaboration)
  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
    invitedAt: v.number(),
    joinedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_project_user", ["projectId", "userId"]),

  // Source Documents
  documents: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    type: v.union(v.literal("pdf"), v.literal("docx"), v.literal("xlsx")),
    storageId: v.string(), // Convex file storage
    extractedText: v.optional(v.string()),
    extractedEntities: v.optional(v.any()), // JSON blob of extracted data
    uploadedBy: v.id("users"),
    uploadedAt: v.number(),
  }).index("by_project", ["projectId"]),

  // Placeholders discovered by agent
  placeholders: defineTable({
    projectId: v.id("projects"),
    name: v.string(), // {{NOME_DA_VARIAVEL}}
    discoveredValue: v.optional(v.string()), // Value found in doc
    currentValue: v.optional(v.string()), // User-edited value
    confidence: v.number(), // AI confidence score
    location: v.optional(v.string()), // Where in Google Doc
    status: v.union(
      v.literal("discovered"),
      v.literal("confirmed"),
      v.literal("modified"),
      v.literal("rejected")
    ),
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"]),

  // Agent Activity Log
  agentActivities: defineTable({
    projectId: v.id("projects"),
    type: v.union(
      v.literal("placeholder_discovered"),
      v.literal("placeholder_updated"),
      v.literal("document_analyzed"),
      v.literal("suggestion_made")
    ),
    details: v.any(),
    performedBy: v.id("users"), // Could be agent or user
    performedAt: v.number(),
  }).index("by_project", ["projectId"]),

  // Legacy: Templates (for migration/compatibility)
  templates: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    content: v.string(), // Markdown with placeholders
    isGlobal: v.boolean(),
    createdBy: v.optional(v.id("users")),
  }).index("by_global", ["isGlobal"]),
});
```

#### Critical Considerations

**✅ Pros:**
- Reactive subscriptions will make collaborative features feel magical
- Type safety across client/server boundary
- Better query composition than Firestore
- Built-in file storage (no need for Firebase Storage)

**⚠️ Challenges:**
- **Clerk Integration:** You'll need Clerk (or similar) for auth - Convex Auth is still maturing
- **AI Integration:** Genkit is Firebase-native; you'll need to adapt or switch to direct Gemini API
- **Migration Complexity:** Even greenfield means maintaining two apps or forcing user migration
- **Cost:** Convex charges per function call - AI-heavy workloads could be expensive

**🔴 Risk Level:** Medium-High (infrastructure change)

---

### Change #2: Multi-Project Collaboration (Google Docs-style)

#### Current State
- Single-user model: `/users/{userId}/filledContracts`
- No sharing mechanism
- Data isolated by user

#### Proposed Model
- Project-centric: Everything belongs to a project
- Fine-grained permissions: Owner/Editor/Viewer
- Real-time collaboration

#### Implementation Strategy

```
Core Concepts:
├── Project = A contract/workspace
├── Documents = Source files attached to project
├── Placeholders = Variables discovered across all docs
├── Members = Users with access to project
└── Activity = Agent actions + user edits
```

#### Permission Model

```typescript
// Permission hierarchy
enum ProjectRole {
  OWNER = "owner",     // Full control, can delete project
  EDITOR = "editor",   // Can edit placeholders, invite viewers
  VIEWER = "viewer",   // Read-only access
}

// Access Control Logic
async function canAccessProject(
  userId: string,
  projectId: string,
  requiredRole: ProjectRole
): Promise<boolean> {
  const membership = await db
    .query("projectMembers")
    .withIndex("by_project_user", (q) =>
      q.eq("projectId", projectId).eq("userId", userId)
    )
    .first();

  if (!membership) return false;
  
  const roleHierarchy = { viewer: 1, editor: 2, owner: 3 };
  return roleHierarchy[membership.role] >= roleHierarchy[requiredRole];
}
```

#### UI/UX Changes Required

**New Screens:**
1. **Projects Dashboard** - List all projects (owned + shared)
2. **Project Detail** - Central hub for a specific contract
3. **Member Management** - Invite/remove users, manage permissions
4. **Activity Feed** - See agent actions and user edits

**Modified Flow:**
```
Current: Upload → Match → Export → Done
New:     Create Project → Invite Members → Upload Docs → 
         Agent Analyzes → Review Placeholders → 
         Edit in Google Docs → Finalize
```

#### Critical Considerations

**✅ Pros:**
- Transforms tool into platform
- Network effects: Shared projects = organic growth
- Better aligns with how teams actually work
- Enables new use cases (legal teams, procurement departments)

**⚠️ Challenges:**
- **Complexity Explosion:** State management becomes significantly harder
- **Real-time Conflicts:** What if two users edit same placeholder?
- **Email/Notification System:** Need invites, updates, mentions
- **Billing Implications:** How to handle quota/usage across shared projects?

**🟡 Risk Level:** Medium (product complexity)

---

### Change #3: Browser Agent + Google Docs Integration

#### Current State
- Template-based: Upload docs → Extract entities → Match to placeholders → Export
- Format preservation handled by DOCX library (lossy)
- User edits in rich text editor, then exports

#### Proposed State
- Agent-driven: Agent works directly in Google Docs
- Format preservation via native Google Docs (perfect)
- Placeholders discovered and managed dynamically

#### Architecture Deep Dive

```
┌─────────────────────────────────────────────────────────────┐
│                     YOUR NEXT.JS APP                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Project    │  │   Agent      │  │   Google OAuth   │  │
│  │   Dashboard  │  │   Controller │  │   Integration    │  │
│  └──────────────┘  └──────┬───────┘  └──────────────────┘  │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   BROWSER AUTOMATION LAYER                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Options:                                             │  │
│  │  A) Puppeteer + Google Docs (complex, flaky)          │  │
│  │  B) Google Apps Script (limited, requires deployment) │  │
│  │  C) Google Docs API (read-only for complex formatting)│  │
│  │  D) Playwright + Chrome Extension (hybrid)            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     GOOGLE DOCS                             │
│  • Native formatting preserved                              │
│  • Real-time collaborative editing                          │
│  • Version history built-in                                 │
│  • Familiar UI for users                                    │
└─────────────────────────────────────────────────────────────┘
```

#### Recommended Approach: Hybrid Agent

Given the complexity of browser automation, I recommend a **hybrid approach**:

```typescript
// convex/agents/documentAgent.ts

/**
 * Agent Workflow:
 * 1. User creates project, uploads documents
 * 2. Agent analyzes documents using Gemini (existing flows)
 * 3. Agent creates Google Doc from template OR clones existing doc
 * 4. Agent uses Google Docs API to insert placeholders as suggestions/comments
 * 5. User edits directly in Google Docs
 * 6. Webhook/listener detects changes, syncs back to Convex
 * 7. Agent can propose additional changes via comments
 */

export const analyzeAndCreateDocument = action({
  args: {
    projectId: v.id("projects"),
    templateGoogleDocId: v.optional(v.string()),
    sourceDocumentIds: v.array(v.id("documents")),
  },
  handler: async (ctx, args) => {
    // 1. Fetch source documents
    const documents = await Promise.all(
      args.sourceDocumentIds.map((id) => ctx.runQuery(api.documents.get, { id }))
    );

    // 2. Analyze with Gemini
    const analysis = await analyzeDocumentsWithAI(documents);
    
    // 3. Create or clone Google Doc
    const googleDocId = args.templateGoogleDocId
      ? await cloneGoogleDoc(args.templateGoogleDocId)
      : await createGoogleDoc(analysis.title);

    // 4. Insert placeholders as suggestions
    await insertPlaceholdersAsSuggestions(
      googleDocId,
      analysis.discoveredEntities
    );

    // 5. Update project
    await ctx.runMutation(api.projects.update, {
      id: args.projectId,
      googleDocId,
      status: "ready",
    });

    // 6. Create placeholder records
    await Promise.all(
      analysis.discoveredEntities.map((entity) =>
        ctx.runMutation(api.placeholders.create, {
          projectId: args.projectId,
          name: entity.name,
          discoveredValue: entity.value,
          confidence: entity.confidence,
          status: "discovered",
        })
      )
    );

    return { googleDocId, placeholderCount: analysis.discoveredEntities.length };
  },
});
```

#### Placeholder Discovery Strategy

Since the agent "discovers and creates" placeholders:

```typescript
// Discovery algorithm
interface DiscoveredPlaceholder {
  name: string;           // e.g., "{{NOME_COORDENADOR}}"
  value: string;          // e.g., "João Silva"
  confidence: number;     // 0-1
  context: string;        // Surrounding text
  position?: {            // In Google Doc
    startIndex: number;
    endIndex: number;
  };
  type: "entity" | "date" | "value" | "custom";
}

// The agent runs this flow:
async function discoverPlaceholders(
  documentText: string,
  existingSchema?: string[]
): Promise<DiscoveredPlaceholder[]> {
  const prompt = `
    Analyze this contract document and identify all variables/placeholders.
    
    Look for:
    1. Names of people (COORDENADOR, REITOR, etc.)
    2. Dates (DATA_ASSINATURA, VIGENCIA_INICIO, etc.)
    3. Monetary values (VALOR_TOTAL, VALOR_PARCELA)
    4. Descriptions (OBJETO, JUSTIFICATIVA)
    5. Any other variable information
    
    Return as JSON array with:
    - suggested_placeholder_name (UPPER_SNAKE_CASE with {{}})
    - discovered_value
    - confidence (0-1)
    - context (surrounding 50 chars)
    
    Document:
    ${documentText}
  `;

  const response = await gemini.generate(prompt);
  return JSON.parse(response);
}
```

#### Google Docs Integration Options Comparison

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| **Google Docs API** | Official, stable, good permissions | Limited formatting control, no real-time sync | Medium |
| **Puppeteer/Playwright** | Full control, can do anything | Brittle, breaks with UI changes, requires hosting | High |
| **Google Apps Script** | Runs in Google's infra, free | Limited runtime, deployment complexity, auth headaches | Medium |
| **Chrome Extension** | Best UX, real-time | Requires user installation, limited to Chrome | High |
| **Hybrid (Recommended)** | API for reads/writes, Extension for advanced | Most complex to build, best long-term | Very High |

#### Recommended: API + Optional Extension

```
Core Flow (Works without extension):
├── User uploads documents
├── Agent analyzes and creates placeholders
├── Agent creates Google Doc with suggestions
├── User edits in Google Docs
├── Periodic sync pulls changes back
└── User exports/finalizes

Enhanced Flow (With extension):
├── All of above PLUS
├── Real-time sync as user types
├── Inline placeholder validation
├── One-click accept/reject suggestions
└── Advanced formatting preserved perfectly
```

#### Critical Considerations

**✅ Pros:**
- **Format Preservation:** Google Docs handles formatting better than any library
- **Familiar UX:** Users already know Google Docs
- **Real Collaboration:** Multiple users can edit simultaneously
- **Version Control:** Built-in history and restore
- **No Export Step:** Document lives where users work

**⚠️ MASSIVE Challenges:**
- **Google Auth Complexity:** OAuth 2.0, refresh tokens, consent screens
- **API Limitations:** Rate limits (300 requests/60 seconds per user)
- **Webhook Reliability:** Need to handle Google Drive webhooks or polling
- **Offline Scenarios:** What happens when Google is down?
- **Enterprise Lock-in:** Hard to migrate away from Google Workspace
- **Cost:** Google Workspace required for some features
- **Testing Nightmare:** Hard to test Google integrations

**🔴 Risk Level:** VERY HIGH (architectural complexity + external dependency)

---

## Implementation Roadmap

Given the complexity, I recommend a **phased approach** over 3-4 months:

### Phase 1: Foundation (Weeks 1-3)
**Goal:** New app with basic Convex + Projects structure

- [ ] Set up new Next.js project with Convex
- [ ] Configure Clerk for authentication
- [ ] Design and implement core schema
- [ ] Build Projects CRUD (create, list, basic details)
- [ ] Port existing AI flows to Convex actions
- [ ] **Milestone:** Can create project, upload docs, see analysis

### Phase 2: Collaboration Core (Weeks 4-6)
**Goal:** Multi-user project support

- [ ] Implement project membership system
- [ ] Build invitation flow (email-based)
- [ ] Add permission checks to all queries/mutations
- [ ] Create activity feed
- [ ] Real-time updates for project members
- [ ] **Milestone:** Two users can collaborate on same project

### Phase 3: Google Docs Integration (Weeks 7-10)
**Goal:** Agent working in Google Docs

- [ ] Set up Google Cloud Project + OAuth
- [ ] Implement Google Docs API wrapper
- [ ] Build document creation flow
- [ ] Implement placeholder discovery agent
- [ ] Create sync mechanism (webhooks or polling)
- [ ] Add suggestion/comments integration
- [ ] **Milestone:** Agent creates doc, user edits, changes sync back

### Phase 4: Polish & Migration (Weeks 11-12)
**Goal:** Production-ready with migration path

- [ ] Performance optimization
- [ ] Error handling and recovery
- [ ] Build data migration tool from Firebase
- [ ] Beta testing with select users
- [ ] Documentation
- [ ] **Milestone:** Users can migrate from v1 to v2

---

## Risk Assessment Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Google API changes/breakage** | Medium | Critical | Abstraction layer, fallback to manual mode |
| **Convex costs balloon** | Medium | High | Monitoring, caching layer, optimization |
| **Agent unreliability** | High | High | Human-in-the-loop, manual override always available |
| **Complexity overwhelms team** | Medium | Critical | Cut scope, phase rollout, hire if needed |
| **User resistance to change** | Medium | Medium | Keep v1 running, gradual migration, training |
| **OAuth/Security issues** | Low | Critical | Security audit, penetration testing |

---

## Alternative Approaches to Consider

### Option A: All Three Changes (Your Proposal)
**Effort:** 3-4 months, 2-3 engineers  
**Risk:** High  
**Reward:** Maximum differentiation

### Option B: Convex + Collaboration Only
**Effort:** 2 months, 1-2 engineers  
**Risk:** Medium  
**Reward:** Solid foundation, can add Google Docs later

### Option C: Google Docs Integration on Existing Stack
**Effort:** 1.5 months, 1 engineer  
**Risk:** Medium  
**Reward:** Validate agent approach before big migration

### Option D: Incremental Evolution
**Effort:** Ongoing, 1 engineer  
**Risk:** Low  
**Reward:** Continuous improvement without disruption

**My Recommendation:** Start with **Option C** (Google Docs on existing Firebase stack) to validate the agent concept. If successful, proceed with full migration to Convex with collaboration features.

---

## Technical Recommendations

### 1. Auth Strategy
**Use Clerk** instead of Convex Auth or Firebase Auth:
- Mature, well-documented
- Built-in organization/team support (fits your collaboration model)
- Great Next.js integration
- Handles all OAuth complexity

### 2. Google Integration
**Start with Google Docs API**, not browser automation:
- More reliable
- Better permissions model
- Can add Puppeteer later for advanced features

### 3. AI Architecture
**Keep Genkit but adapt for Convex:**
- Genkit's flow concept works well with Convex actions
- Can keep existing prompts with minor modifications
- Consider migrating to direct Gemini API if Genkit becomes limiting

### 4. State Management
**Use Convex for everything:**
- Server state: Convex queries/mutations
- Client state: React Query (TanStack Query) for caching
- Form state: React Hook Form (keep existing)
- URL state: Next.js routing

### 5. Testing Strategy
- **Unit tests:** Vitest for utilities
- **Integration tests:** Test AI flows with mocked Gemini
- **E2E tests:** Playwright for critical paths (avoid testing Google integration)
- **Contract tests:** Ensure API stability between frontend/Convex

---

## Key Questions to Resolve Before Starting

1. **Team Size:** How many engineers will work on this? Solo development of all three changes could take 6+ months.

2. **Google Workspace Dependency:** Are all users guaranteed to have Google accounts? What about Microsoft 365 users?

3. **Budget:** Convex pricing scales with usage. Have you estimated costs for AI-heavy workloads?

4. **User Migration:** Will you force migrate users or run both apps in parallel indefinitely?

5. **Offline Support:** How important is offline functionality? Google Docs requires internet.

6. **Data Residency:** Any compliance requirements (LGPD, GDPR) that affect database choice?

---

## Conclusion

Your proposed changes represent a bold vision that could transform Contratos V-Lab from a tool into a platform. However, the combination of three major architectural shifts simultaneously carries significant risk.

### Final Recommendation

**Validated Approach (Lower Risk):**
1. **Week 1-2:** Build Google Docs integration proof-of-concept on existing Firebase stack
2. **Week 3-4:** Test with 3-5 beta users, gather feedback
3. **Decision Point:** If successful, proceed with full Convex migration + collaboration
4. **Month 2-4:** Build v2 with validated approach

**This reduces risk by:**
- Validating the riskiest assumption (agent working in Google Docs) first
- Keeping existing app stable while experimenting
- Not committing to full migration until approach is proven
- Allowing you to keep Firebase if Google Docs integration doesn't work

### Success Metrics

Define these before starting:
- **Agent accuracy:** >90% placeholder discovery accuracy
- **User adoption:** >70% of beta users prefer new approach
- **Performance:** <2s page load, real-time sync <500ms
- **Reliability:** <1% error rate on Google API calls

Would you like me to elaborate on any specific section, create detailed technical specifications for a particular component, or help you scope out the proof-of-concept phase?
