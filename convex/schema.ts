import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const scoutingFieldValidator = v.object({
  id: v.string(),
  label: v.string(),
  type: v.union(
    v.literal("number"),
    v.literal("boolean"),
    v.literal("select"),
    v.literal("multiselect"),
    v.literal("text"),
    v.literal("counter"),
    v.literal("rating"),
  ),
  options: v.optional(v.array(v.string())),
  section: v.string(),
  defaultValue: v.optional(v.union(v.string(), v.number(), v.boolean())),
  aggregatable: v.boolean(),
  higherIsBetter: v.optional(v.boolean()),
  required: v.optional(v.boolean()),
  increment: v.optional(v.number()),
});

export default defineSchema({
  ...authTables,

  userProfiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    role: v.union(
      v.literal("scout"),
      v.literal("analyst"),
      v.literal("admin"),
    ),
    assignedTeamNumbers: v.optional(v.array(v.number())),
  }).index("by_userId", ["userId"]),

  events: defineTable({
    eventKey: v.string(),
    name: v.string(),
    year: v.number(),
    startDate: v.string(),
    endDate: v.string(),
    location: v.string(),
    isActive: v.boolean(),
    tbaLastSynced: v.optional(v.number()),
  })
    .index("by_eventKey", ["eventKey"])
    .index("by_active", ["isActive"]),

  teams: defineTable({
    eventKey: v.string(),
    teamNumber: v.number(),
    teamKey: v.string(),
    nickname: v.string(),
    city: v.optional(v.string()),
    stateMprovince: v.optional(v.string()),
    country: v.optional(v.string()),
    rookieYear: v.optional(v.number()),
    opr: v.optional(v.number()),
    dpr: v.optional(v.number()),
    ccwm: v.optional(v.number()),
    epa: v.optional(v.number()),
    epaRank: v.optional(v.number()),
    statboticsLastSynced: v.optional(v.number()),
    robotPhotoUrl: v.optional(v.string()),
    pitPhotoStorageId: v.optional(v.id("_storage")),
  })
    .index("by_eventKey", ["eventKey"])
    .index("by_eventKey_teamNumber", ["eventKey", "teamNumber"]),

  matches: defineTable({
    eventKey: v.string(),
    matchKey: v.string(),
    compLevel: v.union(
      v.literal("qm"),
      v.literal("ef"),
      v.literal("qf"),
      v.literal("sf"),
      v.literal("f"),
    ),
    matchNumber: v.number(),
    setNumber: v.number(),
    redAlliance: v.array(v.number()),
    blueAlliance: v.array(v.number()),
    redScore: v.optional(v.number()),
    blueScore: v.optional(v.number()),
    predictedTime: v.optional(v.number()),
    actualTime: v.optional(v.number()),
    status: v.union(
      v.literal("upcoming"),
      v.literal("in_progress"),
      v.literal("completed"),
    ),
    videoUrl: v.optional(v.string()),
  })
    .index("by_eventKey", ["eventKey"])
    .index("by_eventKey_matchKey", ["eventKey", "matchKey"])
    .index("by_eventKey_compLevel", ["eventKey", "compLevel"]),

  matchScoutingEntries: defineTable({
    eventKey: v.string(),
    matchKey: v.string(),
    teamNumber: v.number(),
    scoutUserId: v.id("users"),
    configId: v.id("scoutingConfigs"),
    alliance: v.union(v.literal("red"), v.literal("blue")),
    alliancePosition: v.union(v.literal(1), v.literal(2), v.literal(3)),
    data: v.record(
      v.string(),
      v.union(v.string(), v.number(), v.boolean(), v.null()),
    ),
    notes: v.optional(v.string()),
    submittedAt: v.number(),
    isOfflineEntry: v.optional(v.boolean()),
  })
    .index("by_eventKey", ["eventKey"])
    .index("by_eventKey_teamNumber", ["eventKey", "teamNumber"])
    .index("by_eventKey_matchKey", ["eventKey", "matchKey"])
    .index("by_scoutUser", ["scoutUserId"])
    .index("by_matchKey_teamNumber", ["matchKey", "teamNumber"]),

  pitScoutingEntries: defineTable({
    eventKey: v.string(),
    teamNumber: v.number(),
    scoutUserId: v.id("users"),
    configId: v.id("scoutingConfigs"),
    data: v.record(
      v.string(),
      v.union(v.string(), v.number(), v.boolean(), v.null()),
    ),
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
    notes: v.optional(v.string()),
    submittedAt: v.number(),
    lastEditedAt: v.optional(v.number()),
  })
    .index("by_eventKey", ["eventKey"])
    .index("by_eventKey_teamNumber", ["eventKey", "teamNumber"])
    .index("by_scoutUser", ["scoutUserId"]),

  scoutingConfigs: defineTable({
    year: v.number(),
    name: v.string(),
    isActive: v.boolean(),
    matchFields: v.array(scoutingFieldValidator),
    pitFields: v.array(scoutingFieldValidator),
    matchSections: v.array(v.string()),
    pitSections: v.array(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_year", ["year"])
    .index("by_active", ["isActive"]),

  pickLists: defineTable({
    eventKey: v.string(),
    userId: v.id("users"),
    rankedTeams: v.array(
      v.object({
        teamNumber: v.number(),
        rank: v.number(),
        notes: v.optional(v.string()),
        dnp: v.optional(v.boolean()),
      }),
    ),
    isSubmitted: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_eventKey", ["eventKey"])
    .index("by_eventKey_userId", ["eventKey", "userId"]),

  consensusPickLists: defineTable({
    eventKey: v.string(),
    rankedTeams: v.array(
      v.object({
        teamNumber: v.number(),
        bordaScore: v.number(),
        averageRank: v.number(),
        submissionCount: v.number(),
        dnpCount: v.number(),
        isConfirmed: v.boolean(),
        notes: v.optional(v.string()),
      }),
    ),
    algorithm: v.union(v.literal("borda"), v.literal("average_rank")),
    lastCalculatedAt: v.number(),
    calculatedFromListIds: v.array(v.id("pickLists")),
  }).index("by_eventKey", ["eventKey"]),

  teamFlags: defineTable({
    eventKey: v.string(),
    teamNumber: v.number(),
    flaggedBy: v.id("users"),
    tag: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_eventKey", ["eventKey"])
    .index("by_eventKey_teamNumber", ["eventKey", "teamNumber"]),

  matchAssignments: defineTable({
    eventKey: v.string(),
    matchKey: v.string(),
    userId: v.id("users"),
    alliance: v.union(v.literal("red"), v.literal("blue")),
    position: v.union(v.literal(1), v.literal(2), v.literal(3)),
  })
    .index("by_eventKey", ["eventKey"])
    .index("by_eventKey_userId", ["eventKey", "userId"])
    .index("by_matchKey", ["matchKey"]),

  appSettings: defineTable({
    key: v.string(),
    value: v.string(),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  passwordResetTokens: defineTable({
    email: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
  }).index("by_email", ["email"]),

  scoutAvailability: defineTable({
    eventKey: v.string(),
    userId: v.id("users"),
    date: v.string(),
    available: v.boolean(),
  })
    .index("by_eventKey", ["eventKey"])
    .index("by_eventKey_userId", ["eventKey", "userId"]),

  autoAssignConfig: defineTable({
    eventKey: v.string(),
    shiftSize: v.number(),
    lastGeneratedAt: v.optional(v.number()),
    lastGeneratedBy: v.optional(v.id("users")),
  }).index("by_eventKey", ["eventKey"]),

  pitQuestions: defineTable({
    eventKey: v.string(),
    teamNumber: v.number(),
    question: v.string(),
    askedBy: v.id("users"),
    askedAt: v.number(),
    answer: v.optional(v.string()),
    answeredBy: v.optional(v.id("users")),
    answeredAt: v.optional(v.number()),
  })
    .index("by_eventKey", ["eventKey"])
    .index("by_eventKey_teamNumber", ["eventKey", "teamNumber"]),
});
