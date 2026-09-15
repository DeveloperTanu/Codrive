import { Response } from "express";
import { Problem } from "../models/Problem";
import { Hint } from "../models/Hint";
import { Solution } from "../models/Solution";
import { Submission } from "../models/Submission";
import { Progress } from "../models/Progress";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { AuthedRequest } from "../middleware/auth.middleware";
import { enqueueExecution, getExecutionResult } from "../services/execution.service";
import { Types } from "mongoose";

export const getById = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const problem = await Problem.findById(req.params.id).lean();
  if (!problem) throw new ApiError(404, "Problem not found.");

  // Never send hidden test cases or expected outputs to the client — only
  // the ones marked visible, and only their input/output shape.
  const visibleTestCases = problem.testCases
    .filter((tc) => !tc.hidden)
    .map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput }));

  res.json({ problem: { ...problem, testCases: visibleTestCases } });
});

// Lets the frontend resolve "the problem for this concept" without needing
// to know a Problem's real ObjectId ahead of time — it only knows the
// concept's ObjectId (fetched from /concepts/:languageSlug/:categorySlug).
export const getByConceptId = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const problem = await Problem.findOne({ conceptIds: req.params.conceptId }).lean();
  if (!problem) throw new ApiError(404, "No problem found for that concept yet.");

  const visibleTestCases = problem.testCases
    .filter((tc) => !tc.hidden)
    .map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput }));

  res.json({ problem: { ...problem, testCases: visibleTestCases } });
});

// Returns exactly ONE hint at a time — never the whole array — so the
// frontend can't accidentally reveal hint 3 before hint 1.
export const getHint = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id, order } = req.params;
  const hint = await Hint.findOne({ problemId: id, order: parseInt(order, 10) });
  if (!hint) throw new ApiError(404, "No hint at that position.");
  res.json({ hint: { order: hint.order, text: hint.text } });
});

// Solution is only ever fetched via an explicit reveal action on the client —
// this route logs that reveal against the user's most recent submission so
// "solved independently vs. viewed solution" stays accurate for Progress.
export const getSolution = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const language = (req.query.language as string) || "javascript";

  const solution = await Solution.findOne({ problemId: id, language });
  if (!solution) throw new ApiError(404, "No solution available for that language yet.");

  if (req.userId) {
    await Submission.findOneAndUpdate(
      { userId: req.userId, problemId: id },
      { $set: { viewedSolution: true } },
      { sort: { submittedAt: -1 } }
    );
  }

  res.json({ solution });
});

export const submit = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const { code, language, usedHints } = req.body;
  if (!code || !language) throw new ApiError(400, "code and language are required.");

  const problem = await Problem.findById(id).lean();
  if (!problem) throw new ApiError(404, "Problem not found.");

  const jobId = await enqueueExecution(language, code, problem.testCases);

  // In a real deployment the client polls GET /execute/:jobId or subscribes
  // over WebSocket; for this scaffold's in-memory stand-in the result is
  // available on the same tick, so resolve it here directly for convenience.
  const result = await getExecutionResult(jobId);
  const passed = result?.testResults?.every((t) => t.passed) ?? false;

  const submission = await Submission.create({
    userId: req.userId,
    problemId: id,
    code,
    language,
    passed,
    testResults: (result?.testResults ?? []).map((t, i) => ({ testCaseIndex: i, passed: t.passed, actualOutput: t.actualOutput })),
    usedHints: usedHints || 0,
    viewedSolution: false,
  });

  if (req.userId && problem.conceptIds?.length) {
    await Progress.updateMany(
      { userId: new Types.ObjectId(req.userId), conceptId: { $in: problem.conceptIds } },
      { $inc: { problemsAttempted: 1, ...(passed ? { problemsSolved: 1 } : {}) } },
      { upsert: true }
    );
  }

  res.json({ submission, jobId });
});
