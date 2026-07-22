import { describe, expect, it } from 'vitest'
import { calculateStageScore, formatScore } from './scoring'

describe('calculateStageScore', () => {
  it('adds personal-stage scores directly', () => {
    expect(calculateStageScore([8, 9, 10], 'women')).toBe(27)
    expect(calculateStageScore([8, 9, 10], 'men')).toBe(27)
  })

  it('applies the 1.25 duo multiplier after summing three judges', () => {
    expect(calculateStageScore([8, 9, 10], 'duo')).toBe(33.75)
  })

  it('halves then multiplies the six-judge team score by 1.5', () => {
    expect(calculateStageScore([8, 9, 10, 7, 8, 9], 'team')).toBe(38.25)
  })

  it('only displays decimal places when needed', () => {
    expect(formatScore(27)).toBe('27')
    expect(formatScore(33.75)).toBe('33.75')
  })
})
