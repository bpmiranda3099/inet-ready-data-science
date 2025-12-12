#!/usr/bin/env node
import { copyFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"

const projectRoot = process.cwd()

const dataFiles = [
  {
    name: "weather_history.csv",
    source: ["..", "dataset", "clean", "weather_history.csv"],
    target: ["public", "data", "weather_history.csv"],
  },
  {
    name: "cavite_demographics.csv",
    source: ["..", "dataset", "clean", "cavite_demographics.csv"],
    target: ["public", "data", "cavite_demographics.csv"],
  },
  {
    name: "safety_recommendations_cache.json",
    source: ["..", "dataset", "clean", "safety_recommendations_cache.json"],
    target: ["public", "data", "safety_recommendations_cache.json"],
  },
  {
    name: "heat_index_predictions.csv",
    source: ["..", "dataset", "prediction", "heat_index_predictions.csv"],
    target: ["public", "data", "heat_index_predictions.csv"],
  },
]

const copyDataset = async ({ name, source, target }) => {
  const sourcePath = resolve(projectRoot, ...source)
  const targetPath = resolve(projectRoot, ...target)

  if (!existsSync(sourcePath)) {
    console.warn(`sync-public-data: missing source file ${sourcePath}`)
    return
  }

  await mkdir(dirname(targetPath), { recursive: true })
  await copyFile(sourcePath, targetPath)
  console.log(`sync-public-data: copied ${name}`)
}

await Promise.all(dataFiles.map(copyDataset))
