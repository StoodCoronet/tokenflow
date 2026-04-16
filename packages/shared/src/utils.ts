import { randomUUID } from 'crypto'
import { GRADE_THRESHOLDS } from './constants.js'

export function generateId(): string {
  return randomUUID()
}

export function calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= GRADE_THRESHOLDS.A) return 'A'
  if (score >= GRADE_THRESHOLDS.B) return 'B'
  if (score >= GRADE_THRESHOLDS.C) return 'C'
  return 'D'
}

export function expandTilde(path: string): string {
  if (path.startsWith('~/')) {
    return `${process.env.HOME}${path.slice(1)}`
  }
  return path
}

export function timestamp(): string {
  return new Date().toISOString()
}
