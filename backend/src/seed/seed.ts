// Seeds a minimal but realistic set of sample content — enough to exercise
// every screen in the frontend prototypes without needing a real content
// pipeline yet. Run with: npm run seed

import { connectDB } from "../config/db";
import { Language } from "../models/Language";
import { Framework } from "../models/Framework";
import { Concept } from "../models/Concept";
import { Problem } from "../models/Problem";
import { Hint } from "../models/Hint";
import { Solution } from "../models/Solution";
import mongoose from "mongoose";

export async function seed(reset = true) {
  await connectDB();

  if (reset) {
    console.log("[seed] clearing existing content collections...");
    await Promise.all([
      Language.deleteMany({}),
      Framework.deleteMany({}),
      Concept.deleteMany({}),
      Problem.deleteMany({}),
      Hint.deleteMany({}),
      Solution.deleteMany({}),
    ]);
  }

  const javascript = await Language.create({
    slug: "javascript",
    name: "JavaScript",
    categories: [
      { slug: "fundamentals", name: "Fundamentals", order: 1 },
      { slug: "async", name: "Promises & Async", order: 8 },
    ],
  });

  const python = await Language.create({
    slug: "python",
    name: "Python",
    categories: [
      { slug: "fundamentals", name: "Fundamentals", order: 1 },
      { slug: "collections", name: "Collections", order: 4 },
    ],
  });

  await Framework.create({
    slug: "express",
    name: "Express.js",
    languageId: javascript._id,
    categories: [{ slug: "routing", name: "Routing", order: 1 }],
  });

  const promises = await Concept.create({
    slug: "promises",
    title: "Promises",
    languageId: javascript._id,
    categorySlug: "async",
    difficulty: "intermediate",
    estimatedMinutes: 4,
    content: {
      whatIsIt:
        "A promise represents a value that isn't ready yet. It's either still working (pending), finished successfully (fulfilled), or failed (rejected).",
      syntax: "const result = new Promise((resolve, reject) => {\n  if (success) resolve(data);\n  else reject(new Error('failed'));\n});",
      mentalModel: "Think of a promise as a claim ticket, not the item itself — you get the ticket immediately, and .then() is what you hand over later.",
      commonMistakes: [
        { title: "Forgetting to return inside a chain", body: "Without return, the next .then() runs before the previous async step finishes." },
        { title: "No .catch()", body: "An unhandled rejection fails silently in some environments and crashes others." },
      ],
      remember: "A promise is a placeholder for a future value — .then() to use it, .catch() to handle when it fails.",
      quickCheck: {
        question: "What state is a promise in before it resolves or rejects?",
        options: ["Fulfilled", "Pending", "Settled"],
        correctIndex: 1,
      },
    },
  });

  await Concept.create({
    slug: "decorators",
    title: "Decorators",
    languageId: python._id,
    categorySlug: "fundamentals",
    difficulty: "advanced",
    estimatedMinutes: 5,
    content: {
      whatIsIt: "A decorator wraps a function to extend its behavior without modifying its source.",
      syntax: "def logged(fn):\n    def wrapper(*args, **kwargs):\n        print(f\"calling {fn.__name__}\")\n        return fn(*args, **kwargs)\n    return wrapper\n\n@logged\ndef greet(name):\n    return f\"hi {name}\"",
      mentalModel: "A decorator is a function that takes a function and returns a new one — @decorator is just sugar for greet = logged(greet).",
      commonMistakes: [
        { title: "Forgetting *args/**kwargs", body: "Without them, the wrapper only works for functions that take no arguments." },
      ],
      remember: "Decorators wrap behavior around a function without changing what calls it look like.",
      quickCheck: {
        question: "What does @logged above `def greet` actually do?",
        options: ["Runs greet immediately", "Replaces greet with logged(greet)", "Renames greet to logged"],
        correctIndex: 1,
      },
    },
  });

  const promiseProblem = await Problem.create({
    conceptIds: [promises._id],
    title: "Return the first resolved value",
    type: "normal",
    description:
      "Write a function that takes an array of promises and returns a promise that resolves with the value of whichever one finishes first.",
    requirements: [
      "Resolve with the first settled value, in either state",
      "Don't wait for the remaining promises",
      "Handle an empty array by rejecting with an error",
    ],
    examples: [{ input: "[slow(300ms), fast(50ms)]", output: "fast's value, after ~50ms" }],
    constraints: ["Do not use array methods that wait for all promises"],
    starterCode: new Map([["javascript", "async function firstDone(tasks) {\n  // your code here\n}"]]),
    testCases: [
      { input: "[slow, fast]", expectedOutput: "fast_value", hidden: false },
      { input: "[]", expectedOutput: "Error", hidden: true },
    ],
  });

  await Hint.create([
    { problemId: promiseProblem._id, order: 1, text: "Which built-in Promise method settles as soon as any one of several promises settles?" },
    { problemId: promiseProblem._id, order: 2, text: "Promise.race() resolves or rejects with whichever promise finishes first." },
    { problemId: promiseProblem._id, order: 3, text: "Wrap it: return await Promise.race(tasks). Handle the empty-array case first." },
  ]);

  await Solution.create({
    problemId: promiseProblem._id,
    language: "javascript",
    code: "async function firstDone(tasks) {\n  if (!tasks.length) throw new Error('no tasks');\n  return await Promise.race(tasks);\n}",
    explanation: {
      whyItWorks: "Promise.race settles the instant the first input settles, ignoring the rest.",
      alternatives: "Manually attaching .then to each and calling one shared resolve — more code, same result.",
      commonMistakes: "Returning tasks[0] directly returns a pending Promise object, not its resolved value.",
    },
  });

  console.log("[seed] done.");
}

export async function ensureSeedData() {
  if (await Language.exists({})) return false;
  console.log("[seed] no catalog found; adding starter content...");
  await seed(false);
  return true;
}

if (require.main === module) {
  seed().then(() => mongoose.disconnect()).catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
}
