import React, { useLayoutEffect, useRef } from 'react'
import { formatAmountInput, normalizeAmountInput } from '../services/money'

export default function AmountInput({ value, onValueChange, ...props }) {
  const input = useRef(null)
  const caret = useRef(null)
  const display = formatAmountInput(value)
  useLayoutEffect(() => {
    if (caret.current === null || document.activeElement !== input.current) return
    let index = 0, count = 0
    while (index < display.length && count < caret.current) {
      if (/[\d,]/.test(display[index])) count++
      index++
    }
    input.current.setSelectionRange(index, index)
    caret.current = null
  }, [display])
  return <input {...props} ref={input} type="text" inputMode="decimal" autoComplete="off" value={display}
    onChange={event => {
      const raw = normalizeAmountInput(event.target.value)
      if (raw === null) return
      caret.current = (event.target.value.slice(0, event.target.selectionStart).match(/[\d.,]/g) || []).length
      onValueChange(raw)
    }} />
}
