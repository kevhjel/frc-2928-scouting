/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_autoAssign from "../actions/autoAssign.js";
import type * as actions_autoSync from "../actions/autoSync.js";
import type * as actions_createMockEvent from "../actions/createMockEvent.js";
import type * as actions_statboticsSync from "../actions/statboticsSync.js";
import type * as actions_tbaSync from "../actions/tbaSync.js";
import type * as appSettings from "../appSettings.js";
import type * as auth from "../auth.js";
import type * as autoAssignConfig from "../autoAssignConfig.js";
import type * as autoAssignInternal from "../autoAssignInternal.js";
import type * as crons from "../crons.js";
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as matchAnalysis from "../matchAnalysis.js";
import type * as matchAssignments from "../matchAssignments.js";
import type * as matchScouting from "../matchScouting.js";
import type * as matches from "../matches.js";
import type * as mockEventInternal from "../mockEventInternal.js";
import type * as passwordReset from "../passwordReset.js";
import type * as passwordResetInternal from "../passwordResetInternal.js";
import type * as pickList from "../pickList.js";
import type * as pitQuestions from "../pitQuestions.js";
import type * as pitScouting from "../pitScouting.js";
import type * as scoutAvailability from "../scoutAvailability.js";
import type * as scoutingConfig from "../scoutingConfig.js";
import type * as stats from "../stats.js";
import type * as teamFlags from "../teamFlags.js";
import type * as teams from "../teams.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/autoAssign": typeof actions_autoAssign;
  "actions/autoSync": typeof actions_autoSync;
  "actions/createMockEvent": typeof actions_createMockEvent;
  "actions/statboticsSync": typeof actions_statboticsSync;
  "actions/tbaSync": typeof actions_tbaSync;
  appSettings: typeof appSettings;
  auth: typeof auth;
  autoAssignConfig: typeof autoAssignConfig;
  autoAssignInternal: typeof autoAssignInternal;
  crons: typeof crons;
  events: typeof events;
  http: typeof http;
  matchAnalysis: typeof matchAnalysis;
  matchAssignments: typeof matchAssignments;
  matchScouting: typeof matchScouting;
  matches: typeof matches;
  mockEventInternal: typeof mockEventInternal;
  passwordReset: typeof passwordReset;
  passwordResetInternal: typeof passwordResetInternal;
  pickList: typeof pickList;
  pitQuestions: typeof pitQuestions;
  pitScouting: typeof pitScouting;
  scoutAvailability: typeof scoutAvailability;
  scoutingConfig: typeof scoutingConfig;
  stats: typeof stats;
  teamFlags: typeof teamFlags;
  teams: typeof teams;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
