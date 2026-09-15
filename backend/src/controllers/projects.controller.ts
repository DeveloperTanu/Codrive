import { Response } from "express";
import { Project } from "../models/Project";
import { ProjectFile } from "../models/ProjectFile";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { AuthedRequest } from "../middleware/auth.middleware";
import { Types } from "mongoose";

export const list = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const projects = await Project.find({ userId: req.userId }).sort({ updatedAt: -1 });
  res.json({ projects });
});

export const create = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { title, templateSlug } = req.body;
  if (!title || !templateSlug) throw new ApiError(400, "title and templateSlug are required.");

  const project = await Project.create({ userId: req.userId, title, templateSlug, status: "in_progress" });
  res.status(201).json({ project });
});

export const getFiles = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
  if (!project) throw new ApiError(404, "Project not found.");

  const files = await ProjectFile.find({ projectId: project._id });
  res.json({ files });
});

// File-level granularity — saving one file never touches the others, and
// never re-writes the whole project as one document.
export const upsertFile = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
  if (!project) throw new ApiError(404, "Project not found.");

  const { path, content } = req.body;
  if (!path) throw new ApiError(400, "path is required.");

  const file = await ProjectFile.findOneAndUpdate(
    { projectId: project._id, path },
    { $set: { content: content ?? "", updatedAt: new Date() } },
    { upsert: true, new: true }
  );

  project.updatedAt = new Date();
  await project.save();

  res.json({ file });
});

export const deleteFile = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
  if (!project) throw new ApiError(404, "Project not found.");

  await ProjectFile.deleteOne({ projectId: project._id, path: req.body.path });
  res.status(204).send();
});
